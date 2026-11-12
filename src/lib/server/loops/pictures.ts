/**
 * What the pickers show of a figure (picker preview): its positions, its
 * length and its picture. The picture is the section the figure page leads
 * with (`topVideo(sectionsFor(...))`), picked here for a whole list at once:
 * one `videosOf` per place, the same reader filter (`judgeFigure`'s reach),
 * the same order (lessons newest first, then recordings, each video's
 * sections by start), and the viewer's own sections after a group's.
 * `pictures.spec.ts` holds the two to the same answer.
 */
import { and, inArray, isNotNull } from 'drizzle-orm';
import type { Db } from '../db';
import {
	figureEndPositions,
	figures,
	figureStartPositions,
	positions,
	spotLinks,
	videoSpots
} from '../db/schema';
import { judgeFigure } from '../access';
import { keepUsable, spotsByVideo, videosOf } from '../spot-links';
import { isTeam, spaceOfRow, type Space, type Wall } from '../scope';
import { handsLine } from '$lib/routines/page';
import { pictureOf } from '$lib/video/loops';
import type { DanceSlug } from '$lib/dances/dances';
import type { FigureLook, SectionVideo, SpotOwner } from '$lib/types';

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

	for (const r of rows) {
		let section = null;
		if (linked.size > 0) {
			const space = spaceOfRow(r, opts.viewer);
			if (isTeam(space)) {
				if (!reachOf.has(r.teamId!))
					reachOf.set(r.teamId!, judgeFigure(db, opts.viewer, r).reach ?? undefined);
				const visible = reachOf.get(r.teamId!);
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
		out.set(r.id, {
			hands: handsLine(starts.get(r.id) ?? [], ends.get(r.id) ?? [], (id) => names.get(id) ?? ''),
			length: r.lengthFree ? null : r.lengthCounts,
			picture: pictureOf(section)
		});
	}
	return out;
}
