/**
 * What the pickers show of a figure (picker preview): its positions, its
 * length and its picture. The picture is the section the figure page leads
 * with (`topVideo(sectionsFor(...))`), picked here for a whole list at once:
 * one `videosOf` per place, the same reader filter (`judgeFigure`'s reach),
 * the same order (lessons newest first, then recordings, each video's
 * sections by start), and the viewer's own sections after a group's.
 * `pictures.spec.ts` holds the two to the same answer.
 */
import { and, asc, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from '../db';
import {
	figureEndPositions,
	figures,
	figureStartPositions,
	positions,
	spotLinks,
	videoSpots
} from '../db/schema';
import { allows, judgeFigure } from '../access';
import { keepUsable, spotsByVideo, videosOf } from '../spot-links';
import { isTeam, spaceOfRow, type Space, type Wall } from '../scope';
import { handsLine } from '$lib/routines/page';
import { pictureOf } from '$lib/video/loops';
import type { LoopSpan } from '$lib/video/loop-names';
import type { DanceSlug } from '$lib/dances/dances';
import type { FigureLook, Picture, SectionVideo, SpotOwner } from '$lib/types';

const ownerKey = (o: SpotOwner) =>
	'recordingId' in o ? `r${o.recordingId}` : `l${o.lessonVideoId}`;

/**
 * The look of each figure, by id. `ownSections`: a group's figure may also take
 * the viewer's own sections, after the group's (the figure page does this
 * outside group mode).
 */
export function looksFor(
	db: Db,
	figureIds: number[],
	opts: { viewer: string; ownSections: boolean }
): Map<number, FigureLook> {
	const out = new Map<number, FigureLook>();
	if (figureIds.length === 0) return out;
	const rows = db
		.select({
			id: figures.id,
			dance: figures.dance,
			userId: figures.userId,
			teamId: figures.teamId,
			lengthCounts: figures.lengthCounts,
			lengthFree: figures.lengthFree
		})
		.from(figures)
		.where(inArray(figures.id, figureIds))
		.all();
	if (rows.length === 0) return out;
	const ids = rows.map((r) => r.id);

	// Positions: each side's ids, then their names.
	const starts = new Map<number, number[]>();
	const ends = new Map<number, number[]>();
	for (const [table, into] of [
		[figureStartPositions, starts],
		[figureEndPositions, ends]
	] as const) {
		for (const r of db
			.select({ figureId: table.figureId, positionId: table.positionId })
			.from(table)
			.where(inArray(table.figureId, ids))
			.all())
			into.set(r.figureId, [...(into.get(r.figureId) ?? []), r.positionId]);
	}
	const posIds = [...new Set([...starts.values(), ...ends.values()].flat())];
	const names = new Map(
		posIds.length === 0
			? []
			: db
					.select({ id: positions.id, name: positions.name })
					.from(positions)
					.where(inArray(positions.id, posIds))
					.all()
					.map((p) => [p.id, p.name])
	);

	// Sections linked to these figures, by video, each list by start.
	const linked = new Map<number, Set<number>>();
	for (const l of db
		.select({ spotId: spotLinks.spotId, figureId: spotLinks.figureId })
		.from(spotLinks)
		.where(inArray(spotLinks.figureId, ids))
		.all())
		linked.set(l.spotId, (linked.get(l.spotId) ?? new Set()).add(l.figureId!));
	const byVideo =
		linked.size === 0
			? new Map()
			: spotsByVideo(
					db,
					and(inArray(videoSpots.id, [...linked.keys()]), isNotNull(videoSpots.endMs))!
				);

	// One list of videos per place (and per reader filter), as the figure page reads it.
	const videoLists = new Map<string, SectionVideo[]>();
	const videosIn = (space: Space, key: string, visible?: Parameters<typeof videosOf>[2]) => {
		let list = videoLists.get(key);
		if (!list) videoLists.set(key, (list = videosOf(db, space, visible)));
		return list;
	};
	const reachOf = new Map<number, Parameters<typeof videosOf>[2]>();
	const mine: Wall = { userId: opts.viewer, dance: rows[0].dance as DanceSlug };
	const usable = keepUsable(db, mine);
	const first = (videos: SectionVideo[], figureId: number) => {
		for (const v of videos)
			for (const s of byVideo.get(ownerKey(v.owner)) ?? [])
				if (linked.get(s.id)?.has(figureId))
					return { id: s.id, startMs: s.startMs, endMs: s.endMs! };
		return null;
	};

	const look = (r: (typeof rows)[number], section: LoopSpan | null): FigureLook => ({
		hands: handsLine(starts.get(r.id) ?? [], ends.get(r.id) ?? [], (id) => names.get(id) ?? ''),
		length: r.lengthFree ? null : r.lengthCounts,
		picture: pictureOf(section)
	});

	for (const r of rows) {
		let section: LoopSpan | null = null;
		if (linked.size > 0) {
			const space = spaceOfRow(r, opts.viewer);
			if (isTeam(space)) {
				// Each group figure judged as the viewer: one they may not read gets no picture,
				// and only a readable one's judgement sets the group's reach for the rest.
				let visible = reachOf.get(r.teamId!);
				if (!reachOf.has(r.teamId!)) {
					const judged = judgeFigure(db, opts.viewer, r);
					if (!allows(judged.access, 'read')) {
						out.set(r.id, look(r, null));
						continue;
					}
					visible = judged.reach ?? undefined;
					reachOf.set(r.teamId!, visible);
				} else if (visible && !visible.variations.has(r.id)) {
					out.set(r.id, look(r, null));
					continue;
				}
				section = first(videosIn(space, `t${r.teamId}:${visible ? 'r' : 'a'}`, visible), r.id);
				if (
					!section &&
					opts.ownSections &&
					usable({ figureId: r.id, exerciseId: null, userId: r.userId, teamId: r.teamId })
				)
					section = first(videosIn({ ...mine, dance: r.dance as DanceSlug }, `u${r.dance}`), r.id);
			} else {
				section = first(videosIn(space, `o${r.userId}:${r.dance}`), r.id);
			}
		}
		out.set(r.id, look(r, section));
	}
	return out;
}

/** The viewer `looksFor` reads as in a space: its person, or the group editor acting there. */
const viewerOf = (space: Space) => (isTeam(space) ? space.actorId : space.userId);

/** `looksFor` as a space's own lists read it: a group's alone in group mode, a person's own with theirs. */
export const looksIn = (
	db: Db,
	figureIds: number[],
	space: Space,
	viewer = viewerOf(space)
): Map<number, FigureLook> => looksFor(db, figureIds, { viewer, ownSections: !isTeam(space) });

/** Each move's picture: its first live variation's, in id order, that has one; null when none has. */
export function movePictures(
	db: Db,
	moveIds: number[],
	space: Space,
	viewer = viewerOf(space)
): Map<number, Picture> {
	const out = new Map<number, Picture>();
	if (moveIds.length === 0) return out;
	const vs = db
		.select({ id: figures.id, groupId: figures.groupId })
		.from(figures)
		.where(and(inArray(figures.groupId, moveIds), isNull(figures.archivedAt)))
		.orderBy(asc(figures.id))
		.all();
	const looks = looksIn(
		db,
		vs.map((v) => v.id),
		space,
		viewer
	);
	for (const id of moveIds) out.set(id, null);
	for (const v of vs) {
		const picture = looks.get(v.id)?.picture ?? null;
		if (picture && out.get(v.groupId!) === null) out.set(v.groupId!, picture);
	}
	return out;
}

/** Variations with their look, as a space's pickers show them. */
export function withLooks<T extends { id: number }>(
	db: Db,
	rows: T[],
	space: Space
): (T & { look?: FigureLook })[] {
	const looks = looksIn(
		db,
		rows.map((r) => r.id),
		space
	);
	return rows.map((r) => {
		const look = looks.get(r.id);
		return look ? { ...r, look } : r;
	});
}

/** Moves with their picture, as a space's pickers show them. */
export function withPictures<T extends { id: number }>(
	db: Db,
	moves: T[],
	space: Space,
	viewer = viewerOf(space)
): (T & { picture: Picture })[] {
	const pictures = movePictures(
		db,
		moves.map((m) => m.id),
		space,
		viewer
	);
	return moves.map((m) => ({ ...m, picture: pictures.get(m.id) ?? null }));
}
