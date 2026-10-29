/**
 * Sections of a video linked to figure versions and drills. See
 * `docs/superpowers/specs/2026-10-15-video-section-links-design.md`.
 *
 * Every rule the table cannot carry lives here: a section and not a point, one
 * dance, drills only. Imported BY `spots.ts`, `figures.ts` and `lessons.ts` —
 * their deletes ask `assertUnlinked` first — so it imports none of them.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	lessonExercises,
	lessonFigures,
	lessons,
	lessonVideos,
	recordings,
	spotLinks,
	videoSpots
} from './db/schema';
import type {
	LinkedSection,
	SectionGroup,
	SectionLinkChip,
	SectionTarget,
	SectionVideo,
	Spot,
	SpotOwner,
	VideoSection
} from '$lib/types';
import { lessonsReaching } from './lesson-links';

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

/**
 * Unlink from the section's side — the Link popup's ×. Only a link of this
 * spot. With `alsoLesson`, a lesson video's hand link from its lesson to the
 * same target goes too, in the same transaction.
 */
export function unlinkFromSection(
	db: Db,
	spotId: number,
	linkId: number,
	alsoLesson: boolean
): boolean {
	return db.transaction((tx) => {
		const link = getSpotLink(tx, linkId);
		if (!link || link.spotId !== spotId) return false;
		tx.delete(spotLinks).where(eq(spotLinks.id, linkId)).run();
		if (alsoLesson) {
			const lesson = tx
				.select({ id: lessonVideos.lessonId })
				.from(videoSpots)
				.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
				.where(eq(videoSpots.id, spotId))
				.get();
			if (lesson && 'figureId' in link.target) {
				tx.delete(lessonFigures)
					.where(
						and(
							eq(lessonFigures.lessonId, lesson.id),
							eq(lessonFigures.figureId, link.target.figureId)
						)
					)
					.run();
			} else if (lesson && 'exerciseId' in link.target) {
				tx.delete(lessonExercises)
					.where(
						and(
							eq(lessonExercises.lessonId, lesson.id),
							eq(lessonExercises.exerciseId, link.target.exerciseId)
						)
					)
					.run();
			}
		}
		return true;
	});
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
	const rows = db
		.select({
			id: spotLinks.id,
			spotId: spotLinks.spotId,
			figure: figureGroups.name,
			variation: figures.name,
			figureArchived: figures.archivedAt,
			groupArchived: figureGroups.archivedAt,
			drill: exercises.name,
			drillArchived: exercises.archivedAt
		})
		.from(spotLinks)
		.leftJoin(figures, eq(figures.id, spotLinks.figureId))
		.leftJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.leftJoin(exercises, eq(exercises.id, spotLinks.exerciseId))
		.where(inArray(spotLinks.spotId, spotIds))
		.all();
	for (const r of rows) {
		const label = r.figure !== null ? `${r.figure} · ${r.variation}` : r.drill!;
		const archived =
			r.figure !== null
				? r.figureArchived !== null || r.groupArchived !== null
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

/* ── Reads: the cards, the link sheet, a video's list ──────────────────── */

type BareSpot = Omit<Spot, 'linkedTo'>;

/**
 * Every live video of a dance, in the sheet's order: lesson videos newest
 * lesson first, then figure recordings by figure. Archived lessons and figures
 * are gone from every list, so their videos are gone from this one.
 */
function videosOf(db: Db, dance: string): SectionVideo[] {
	const lessonRows = db
		.select({
			id: lessonVideos.id,
			file: lessonVideos.file,
			lessonId: lessons.id,
			title: lessons.title,
			lessonDay: lessons.lessonDay
		})
		.from(lessonVideos)
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(and(eq(lessons.dance, dance), isNull(lessons.archivedAt)))
		.orderBy(desc(lessons.lessonDay), desc(lessons.id), asc(lessonVideos.id))
		.all();
	const recRows = db
		.select({
			id: recordings.id,
			file: recordings.file,
			figure: figureGroups.name,
			name: figures.name
		})
		.from(recordings)
		.innerJoin(figures, eq(figures.id, recordings.figureId))
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt), eq(recordings.kind, 'video')))
		.orderBy(asc(figureGroups.name), asc(figures.name), asc(recordings.id))
		.all();
	return [
		...lessonRows.map((r) => ({
			owner: { lessonVideoId: r.id },
			src: `/lesson-videos/${r.file}`,
			from: {
				kind: 'lesson' as const,
				lessonId: r.lessonId,
				title: r.title,
				lessonDay: r.lessonDay
			}
		})),
		...recRows.map((r) => ({
			owner: { recordingId: r.id },
			src: `/recordings/${r.file}`,
			from: {
				kind: 'recording' as const,
				figure: `${r.figure} · ${r.name}`
			}
		}))
	];
}

/**
 * A target's dance and the lessons it is taught in (a variation's own links only).
 * Null for a target that does not exist.
 */
function targetContext(db: Db, target: SectionTarget) {
	if ('figureId' in target) {
		const f = db
			.select({ dance: figures.dance })
			.from(figures)
			.where(eq(figures.id, target.figureId))
			.get();
		if (!f) return null;
		const rows = db
			.select({ id: lessonFigures.lessonId })
			.from(lessonFigures)
			.where(eq(lessonFigures.figureId, target.figureId))
			.all();
		return {
			dance: f.dance,
			taught: new Set([...rows.map((r) => r.id), ...lessonsReaching(db, target)])
		};
	}
	const e = db
		.select({ dance: exercises.dance })
		.from(exercises)
		.where(eq(exercises.id, target.exerciseId))
		.get();
	if (!e) return null;
	const rows = db
		.select({ id: lessonExercises.lessonId })
		.from(lessonExercises)
		.where(eq(lessonExercises.exerciseId, target.exerciseId))
		.all();
	return {
		dance: e.dance,
		taught: new Set([...rows.map((r) => r.id), ...lessonsReaching(db, target)])
	};
}

const ownerKey = (o: SpotOwner) =>
	'recordingId' in o ? `r${o.recordingId}` : `l${o.lessonVideoId}`;

/** Sections — never points — keyed by their video, each list by start time. */
function sectionsByVideo(db: Db, where = isNotNull(videoSpots.endMs)): Map<string, BareSpot[]> {
	const rows = db
		.select({
			id: videoSpots.id,
			startMs: videoSpots.startMs,
			endMs: videoSpots.endMs,
			label: videoSpots.label,
			recordingId: videoSpots.recordingId,
			lessonVideoId: videoSpots.lessonVideoId
		})
		.from(videoSpots)
		.where(where)
		.orderBy(asc(videoSpots.startMs), asc(videoSpots.id))
		.all();
	const out = new Map<string, BareSpot[]>();
	for (const { recordingId, lessonVideoId, ...spot } of rows) {
		const key = recordingId !== null ? `r${recordingId}` : `l${lessonVideoId}`;
		out.set(key, [...(out.get(key) ?? []), spot]);
	}
	return out;
}

function labelled(db: Db, spots: BareSpot[]): Spot[] {
	const chips = linkChips(
		db,
		spots.map((s) => s.id)
	);
	return spots.map((s) => ({ ...s, linkedTo: (chips.get(s.id) ?? []).map((c) => c.label) }));
}

/**
 * The "+ Link a section" sheet: every section of the target's dance not yet
 * linked to it, grouped by video. Lessons it is taught in come first.
 */
export function linkableSections(db: Db, target: SectionTarget): SectionGroup[] {
	const context = targetContext(db, target);
	if (!context) return [];
	const linked = new Set(
		db
			.select({ id: spotLinks.spotId })
			.from(spotLinks)
			.where(targetColumn(target))
			.all()
			.map((r) => r.id)
	);
	const byVideo = sectionsByVideo(db);
	const groups = videosOf(db, context.dance)
		.map((video) => ({
			video,
			taughtHere: video.from.kind === 'lesson' && context.taught.has(video.from.lessonId),
			sections: labelled(
				db,
				(byVideo.get(ownerKey(video.owner)) ?? []).filter((s) => !linked.has(s.id))
			)
		}))
		.filter((g) => g.sections.length > 0);
	return [...groups.filter((g) => g.taughtHere), ...groups.filter((g) => !g.taughtHere)];
}

/**
 * The cards of a figure version or a drill, in the sheet's video order. A link
 * whose video's lesson or figure is archived drops out with it, and comes back
 * with it; it still blocks a delete meanwhile.
 */
export function sectionsFor(db: Db, target: SectionTarget): LinkedSection[] {
	const context = targetContext(db, target);
	if (!context) return [];
	const linkOf = new Map(
		db
			.select({ linkId: spotLinks.id, spotId: spotLinks.spotId })
			.from(spotLinks)
			.where(targetColumn(target))
			.all()
			.map((l) => [l.spotId, l.linkId])
	);
	if (linkOf.size === 0) return [];
	const byVideo = sectionsByVideo(db, inArray(videoSpots.id, [...linkOf.keys()]));
	// One dance per link, so every linked section's video is among these.
	return videosOf(db, context.dance).flatMap((video) =>
		labelled(db, byVideo.get(ownerKey(video.owner)) ?? []).map((spot) => ({
			linkId: linkOf.get(spot.id)!,
			spot,
			video
		}))
	);
}

/** A video's sections with their links — the lesson page's list. */
export function videoSections(db: Db, owner: SpotOwner): VideoSection[] {
	const where =
		'recordingId' in owner
			? eq(videoSpots.recordingId, owner.recordingId)
			: eq(videoSpots.lessonVideoId, owner.lessonVideoId);
	const spots = sectionsByVideo(db, and(isNotNull(videoSpots.endMs), where)).get(ownerKey(owner));
	if (!spots) return [];
	const chips = linkChips(
		db,
		spots.map((s) => s.id)
	);
	return spots.map((s) => ({ ...s, endMs: s.endMs!, links: chips.get(s.id) ?? [] }));
}
