/**
 * Sections of a video linked to figure versions and drills. See
 * `docs/superpowers/specs/2026-10-15-video-section-links-design.md`.
 *
 * Every rule the table cannot carry lives here: a section and not a point, one
 * dance, drills only. Imported BY `spots.ts`, `figures.ts` and `lessons.ts` —
 * their deletes ask `assertUnlinked` first — so it imports none of them.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { Db } from './db';
import {
	exercises,
	figures,
	lessons,
	lessonVideos,
	recordings,
	spotLinks,
	videoSpots
} from './db/schema';
import type { SectionLinkChip, SectionTarget, SpotOwner } from '$lib/types';

/** A link that cannot be made. `status` is what the route answers with. */
export class SpotLinkError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 409 = 400
	) {
		super(message);
	}
}

/** A delete refused because a section is linked. The message names what to unlink. */
export class SpotLinkedError extends Error {
	constructor(readonly labels: string[]) {
		super(`Linked to ${labels.join(', ')} — unlink it first.`);
	}
}

/** A form's `figure:<id>` or `exercise:<id>`, else null. */
export function targetFrom(raw: string | undefined | null): SectionTarget | null {
	const m = /^(figure|exercise):(\d+)$/.exec(raw ?? '');
	if (!m) return null;
	const id = Number(m[2]);
	if (!Number.isSafeInteger(id) || id < 1) return null;
	return m[1] === 'figure' ? { figureId: id } : { exerciseId: id };
}

/** The video a spot lives in, that video's dance, and whether the spot is a section. */
export function videoOfSpot(db: Db, spotId: number) {
	const row = db
		.select({
			endMs: videoSpots.endMs,
			lessonVideoId: videoSpots.lessonVideoId,
			recordingId: videoSpots.recordingId,
			lessonDance: lessons.dance,
			figureDance: figures.dance
		})
		.from(videoSpots)
		.leftJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.leftJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.leftJoin(recordings, eq(recordings.id, videoSpots.recordingId))
		.leftJoin(figures, eq(figures.id, recordings.figureId))
		.where(eq(videoSpots.id, spotId))
		.get();
	if (!row) return null;
	const owner: SpotOwner =
		row.lessonVideoId !== null
			? { lessonVideoId: row.lessonVideoId }
			: { recordingId: row.recordingId! };
	return { owner, dance: (row.lessonDance ?? row.figureDance)!, isSection: row.endMs !== null };
}

/** The target's dance. Throws for a missing target or an exercise that is not a drill. */
function targetDance(db: Db, target: SectionTarget): string {
	if ('figureId' in target) {
		const f = db
			.select({ dance: figures.dance })
			.from(figures)
			.where(eq(figures.id, target.figureId))
			.get();
		if (!f) throw new SpotLinkError('No such figure.');
		return f.dance;
	}
	const e = db
		.select({ dance: exercises.dance, source: exercises.source })
		.from(exercises)
		.where(eq(exercises.id, target.exerciseId))
		.get();
	if (!e) throw new SpotLinkError('No such exercise.');
	if (e.source !== 'custom') throw new SpotLinkError('Only a drill can have sections of its own.');
	return e.dance;
}

export const targetColumn = (target: SectionTarget) =>
	'figureId' in target
		? eq(spotLinks.figureId, target.figureId)
		: eq(spotLinks.exerciseId, target.exerciseId);

/** The new link's id. Throws `SpotLinkError` for a point, another dance, a non-drill, a duplicate. */
export function linkSpot(db: Db, spotId: number, target: SectionTarget): number {
	const video = videoOfSpot(db, spotId);
	if (!video) throw new SpotLinkError('No such section.');
	if (!video.isSection) throw new SpotLinkError('Only a section can be linked, not a point.');
	if (targetDance(db, target) !== video.dance) {
		throw new SpotLinkError('That section is from the other dance.');
	}
	const taken = db
		.select({ id: spotLinks.id })
		.from(spotLinks)
		.where(and(eq(spotLinks.spotId, spotId), targetColumn(target)))
		.get();
	if (taken) throw new SpotLinkError('Already linked.', 409);
	return db
		.insert(spotLinks)
		.values({ spotId, ...target })
		.returning({ id: spotLinks.id })
		.get().id;
}

/** Whether a row went. Scoped to the target, so another target's link id deletes nothing. */
export function unlinkSpot(db: Db, id: number, target: SectionTarget): boolean {
	return (
		db
			.delete(spotLinks)
			.where(and(eq(spotLinks.id, id), targetColumn(target)))
			.run().changes > 0
	);
}

export function getSpotLink(db: Db, id: number) {
	const row = db.select().from(spotLinks).where(eq(spotLinks.id, id)).get();
	if (!row) return null;
	const target: SectionTarget =
		row.figureId !== null ? { figureId: row.figureId } : { exerciseId: row.exerciseId! };
	return { id: row.id, spotId: row.spotId, target };
}

/**
 * Every link of these spots, labelled "Enchufla · Doble", alphabetical per
 * spot. A variation counts as archived when its figure is.
 */
export function linkChips(db: Db, spotIds: number[]): Map<number, SectionLinkChip[]> {
	const out = new Map<number, SectionLinkChip[]>();
	if (spotIds.length === 0) return out;
	const parent = alias(figures, 'parent');
	const rows = db
		.select({
			id: spotLinks.id,
			spotId: spotLinks.spotId,
			figure: figures.name,
			figureArchived: figures.archivedAt,
			parent: parent.name,
			parentArchived: parent.archivedAt,
			drill: exercises.name,
			drillArchived: exercises.archivedAt
		})
		.from(spotLinks)
		.leftJoin(figures, eq(figures.id, spotLinks.figureId))
		.leftJoin(parent, eq(parent.id, figures.parentId))
		.leftJoin(exercises, eq(exercises.id, spotLinks.exerciseId))
		.where(inArray(spotLinks.spotId, spotIds))
		.all();
	for (const r of rows) {
		const label =
			r.figure !== null ? (r.parent !== null ? `${r.parent} · ${r.figure}` : r.figure) : r.drill!;
		const archived =
			r.figure !== null
				? r.figureArchived !== null || r.parentArchived !== null
				: r.drillArchived !== null;
		const list = out.get(r.spotId) ?? [];
		list.push({ id: r.id, label, archived });
		out.set(r.spotId, list);
	}
	for (const list of out.values()) list.sort((a, b) => a.label.localeCompare(b.label));
	return out;
}

function spotIdsOf(db: Db, scope: { spotId: number } | SpotOwner): number[] {
	if ('spotId' in scope) return [scope.spotId];
	const where =
		'recordingId' in scope
			? eq(videoSpots.recordingId, scope.recordingId)
			: eq(videoSpots.lessonVideoId, scope.lessonVideoId);
	return db
		.select({ id: videoSpots.id })
		.from(videoSpots)
		.where(where)
		.all()
		.map((r) => r.id);
}

/** What stops this spot, or this video, from being deleted. Empty when nothing does. */
export function linksBlocking(db: Db, scope: { spotId: number } | SpotOwner): string[] {
	const labels = [...linkChips(db, spotIdsOf(db, scope)).values()]
		.flat()
		.map((c) => (c.archived ? `${c.label} (archived)` : c.label));
	return [...new Set(labels)].sort((a, b) => a.localeCompare(b));
}

/** Throws `SpotLinkedError` while any section of the scope is linked. */
export function assertUnlinked(db: Db, scope: { spotId: number } | SpotOwner): void {
	const labels = linksBlocking(db, scope);
	if (labels.length > 0) throw new SpotLinkedError(labels);
}
