/**
 * Sections and points of a video linked to positions (`spot_position_links`),
 * and the lessons a position is taught in. See "Links" in
 * `docs/superpowers/specs/2026-11-04-positions-design.md` and rulings 10–11.
 *
 * Unlike a section link (`spot-links.ts`), a POINT may link a position: a
 * point is one moment, and can be the position's picture. A linked spot
 * refuses to delete until it is unlinked (`linksBlocking` reads this table).
 * A group's spot links only its group's positions; a person's spot links
 * their own, or a group's position they may use (`usableOf`). A group's
 * unlink goes to Recently deleted, kind `'position-link'` (ruling 11).
 */
import { and, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import type { Db } from './db';
import {
	lessonPositions,
	lessonVideos,
	lessons,
	positions,
	spotPositionLinks,
	teams,
	videoSpots
} from './db/schema';
import type { ChangeValues, LinkedSpot, SectionGroup } from '$lib/types';
import { reconcileEntries } from './entries';
import { lessonsReaching } from './lesson-links';
import { inSpace, isTeam, ownedBy, spaceOfRow, type Space, type Wall } from './scope';
import { usableBy, usableOf, type Usable } from './usable';
import { actingIn, logChange, spotRoot } from './changes';
import { spotWords, trashRows, type TrashRows } from './trash';
import {
	clearPictureOf,
	keepFor,
	keepUsable,
	labelled,
	ownerKey,
	sameOwner,
	sectionSpace,
	SpotLinkError,
	spotsByVideo,
	videoOfSpot,
	videosOf,
	type Keep,
	type Visible
} from './spot-links';

/**
 * The new link's id: a section or point `userId` may edit (their own, or a
 * group's they edit) linked to a live position of the same owner, or, on
 * their own spot, to a group's position they may use. Throws `SpotLinkError`:
 * "No such section." for a spot they may not change, "No such position." for
 * a missing, archived or other owner's position, "Already linked." (409).
 */
export function linkSpotToPosition(
	db: Db,
	userId: string,
	spotId: number,
	positionId: number,
	now = Date.now()
): number {
	const space = sectionSpace(db, userId, spotId);
	if (!space) throw new SpotLinkError('No such section.');
	return linkPositionInSpace(db, space, spotId, positionId, now);
}

/**
 * `linkSpotToPosition` within one space, already known to be the asker's to
 * edit: the spot must be the space's, the position the space's own or, for a
 * person's space, a group's they may use.
 */
export function linkPositionInSpace(
	db: Db,
	space: Space,
	spotId: number,
	positionId: number,
	now = Date.now()
): number {
	const video = videoOfSpot(db, spotId);
	if (!video || !inSpace(video, space)) throw new SpotLinkError('No such section.');
	const p = db
		.select({
			id: positions.id,
			dance: positions.dance,
			userId: positions.userId,
			teamId: positions.teamId,
			archivedAt: positions.archivedAt
		})
		.from(positions)
		.where(eq(positions.id, positionId))
		.get();
	if (
		!p ||
		p.archivedAt !== null ||
		p.dance !== video.dance ||
		!(sameOwner(p, space) || usableBy(db, space, 'positions', p))
	) {
		throw new SpotLinkError('No such position.');
	}
	const taken = db
		.select({ id: spotPositionLinks.id })
		.from(spotPositionLinks)
		.where(and(eq(spotPositionLinks.spotId, spotId), eq(spotPositionLinks.positionId, positionId)))
		.get();
	if (taken) throw new SpotLinkError('Already linked.', 409);
	return db.transaction((tx) => {
		const id = tx
			.insert(spotPositionLinks)
			.values({ spotId, positionId, createdAt: now })
			.returning({ id: spotPositionLinks.id })
			.get().id;
		logPositionLink(tx, space, 'add', { id, spotId, positionId }, now);
		return id;
	});
}

const positionName = (db: Db, id: number) =>
	db.select({ name: positions.name }).from(positions).where(eq(positions.id, id)).get()?.name ??
	null;

/**
 * History's line for a spot's position link made or removed, filed under the
 * spot's video's lesson (or its recording's figure), as a section link's is.
 */
function logPositionLink(
	tx: Db,
	space: Space,
	verb: 'add' | 'remove',
	link: { id: number; spotId: number; positionId: number },
	now: number,
	trashId: number | null = null
): void {
	const root = spotRoot(tx, link.spotId);
	if (!root) return;
	const spot = tx
		.select({ endMs: videoSpots.endMs })
		.from(videoSpots)
		.where(eq(videoSpots.id, link.spotId))
		.get();
	// `point: 1` makes History say "a point" (a spot with no end).
	const named: ChangeValues = {
		name: positionName(tx, link.positionId),
		...(spot?.endMs === null ? { point: 1 } : {})
	};
	logChange(
		tx,
		space,
		{
			rootKind: root.rootKind,
			rootId: root.rootId,
			verb,
			subject: 'section-link',
			subjectId: link.id,
			...(verb === 'add' ? { after: named } : { before: named }),
			trashId
		},
		now
	);
}

/**
 * Whether a link went. A group's goes to Recently deleted first (ruling 11),
 * with the row, and members' entries follow the reach it took
 * (`reconcileEntries`), as a section link's unlink does. `by` is who, for History.
 *
 * From the spot's side (the Link popup's ×), `spotId` names the spot: a link
 * of another spot is refused (false) and nothing goes. With `alsoLesson`, the
 * spot's lesson's hand link to the same position goes too, in the same
 * transaction and the same Recently deleted entry, as `unlinkFromSection`
 * takes a lesson's hand link to a variation.
 */
export function unlinkSpotFromPosition(
	db: Db,
	linkId: number,
	now = Date.now(),
	by?: string,
	opts: { spotId?: number; alsoLesson?: boolean } = {}
): boolean {
	return db.transaction((tx) => {
		const link = tx.select().from(spotPositionLinks).where(eq(spotPositionLinks.id, linkId)).get();
		if (!link) return false;
		if (opts.spotId !== undefined && link.spotId !== opts.spotId) return false;
		const video = videoOfSpot(tx, link.spotId);
		const root = spotRoot(tx, link.spotId);
		const spot = tx.select().from(videoSpots).where(eq(videoSpots.id, link.spotId)).get();
		tx.delete(spotPositionLinks).where(eq(spotPositionLinks.id, linkId)).run();
		clearPictureOf(tx, link.positionId, [link.spotId]);
		const rows: TrashRows = { spot_position_links: [link] };
		if (opts.alsoLesson && spot?.lessonVideoId != null) {
			const lesson = tx
				.select({ id: lessonVideos.lessonId })
				.from(lessonVideos)
				.where(eq(lessonVideos.id, spot.lessonVideoId))
				.get();
			if (lesson) {
				rows.lesson_positions = tx
					.delete(lessonPositions)
					.where(
						and(
							eq(lessonPositions.lessonId, lesson.id),
							eq(lessonPositions.positionId, link.positionId)
						)
					)
					.returning()
					.all();
			}
		}
		if (!video) return true;
		const space = actingIn(video, by);
		let trashId: number | null = null;
		if (isTeam(space) && root) {
			const label = `${spot ? spotWords(spot) : 'A spot'} · ${positionName(tx, link.positionId) ?? '?'}`;
			trashId = trashRows(
				tx,
				space,
				'position-link',
				label,
				{ rootKind: root.rootKind, rootId: root.rootId },
				rows,
				[],
				0,
				now
			);
			reconcileEntries(tx, space.teamId, now);
		}
		logPositionLink(tx, space, 'remove', link, now, trashId);
		return true;
	});
}

/**
 * The names of the positions each spot links, for a spot's list beside its
 * variations and drills (`Spot.linkedTo`). With `shown` (a reader of a
 * group's video), only the positions it holds. Otherwise as the video's owner
 * lists them: a group's spot, every one; a person's, their own and a group's
 * only while they may use it, as `keepUsable` does for the other links.
 */
export function positionNamesOf(
	db: Db,
	spotIds: number[],
	space: Space,
	shown?: ReadonlySet<number>
): Map<number, string[]> {
	const out = new Map<number, string[]>();
	if (spotIds.length === 0) return out;
	const rows = db
		.select({
			spotId: spotPositionLinks.spotId,
			id: positions.id,
			name: positions.name,
			dance: positions.dance,
			userId: positions.userId,
			teamId: positions.teamId
		})
		.from(spotPositionLinks)
		.innerJoin(positions, eq(positions.id, spotPositionLinks.positionId))
		.where(inArray(spotPositionLinks.spotId, spotIds))
		.all();
	let usable: Usable | undefined;
	const keep = (r: (typeof rows)[number]) => {
		if (shown) return shown.has(r.id);
		if (isTeam(space) || sameOwner(r, space)) return true;
		usable ??= usableOf(db, space);
		return usableBy(db, space, 'positions', r, usable);
	};
	for (const r of rows) {
		if (!keep(r)) continue;
		out.set(r.spotId, [...(out.get(r.spotId) ?? []), r.name]);
	}
	return out;
}

/** A position's space (dance and owner) and the lessons it is taught in. Null when it does not exist. */
function positionContext(db: Db, positionId: number) {
	const p = db
		.select({
			id: positions.id,
			dance: positions.dance,
			userId: positions.userId,
			teamId: positions.teamId
		})
		.from(positions)
		.where(eq(positions.id, positionId))
		.get();
	if (!p) return null;
	const hand = db
		.select({ id: lessonPositions.lessonId })
		.from(lessonPositions)
		.where(eq(lessonPositions.positionId, positionId))
		.all()
		.map((r) => r.id);
	return {
		row: p,
		space: spaceOfRow(p, ''),
		taught: new Set([...hand, ...lessonsReaching(db, { positionId })])
	};
}

/**
 * A position's cards: its sections and points, in the sheet's video order
 * (lesson videos newest lesson first, then recordings by figure), each video's
 * spots by start time. A spot whose lesson or figure is archived drops out
 * with it. With `visible` (a reader's page), only the spots on its videos.
 *
 * With `viewer`, for a group's position: the viewer's own spots linked to it
 * follow the group's, while they may use it. Nobody else's own spots show.
 */
export function spotsOfPosition(
	db: Db,
	positionId: number,
	visible?: Visible,
	viewer?: string
): LinkedSpot[] {
	const context = positionContext(db, positionId);
	if (!context) return [];
	const linkOf = new Map(
		db
			.select({ linkId: spotPositionLinks.id, spotId: spotPositionLinks.spotId })
			.from(spotPositionLinks)
			.where(eq(spotPositionLinks.positionId, positionId))
			.all()
			.map((l) => [l.spotId, l.linkId])
	);
	if (linkOf.size === 0) return [];
	const byVideo = spotsByVideo(db, inArray(videoSpots.id, [...linkOf.keys()]));
	const cards = (space: Space, shown: Visible | undefined, keep: Keep | undefined) =>
		videosOf(db, space, shown).flatMap((video) =>
			labelled(db, byVideo.get(ownerKey(video.owner)) ?? [], keep).map((spot) => ({
				linkId: linkOf.get(spot.id)!,
				spot,
				video,
				point: spot.endMs === null
			}))
		);
	const out = cards(context.space, visible, keepFor(db, context.space, visible));
	if (viewer === undefined || !isTeam(context.space)) return out;
	const mine: Wall = { userId: viewer, dance: context.space.dance };
	return usableBy(db, mine, 'positions', context.row)
		? [...out, ...cards(mine, undefined, keepUsable(db, mine))]
		: out;
}

/**
 * The "Link a section or point" picker: every section and point of the
 * position's owner's videos, grouped by video, the ones already linked to it
 * marked. The lessons it is taught in come first.
 */
export function linkableSpots(db: Db, positionId: number): SectionGroup[] {
	const context = positionContext(db, positionId);
	if (!context) return [];
	const linked = new Set(
		db
			.select({ id: spotPositionLinks.spotId })
			.from(spotPositionLinks)
			.where(eq(spotPositionLinks.positionId, positionId))
			.all()
			.map((r) => r.id)
	);
	const videos = videosOf(db, context.space);
	const lessonVideoIds = videos.flatMap((v) =>
		'lessonVideoId' in v.owner ? [v.owner.lessonVideoId] : []
	);
	const recordingIds = videos.flatMap((v) =>
		'recordingId' in v.owner ? [v.owner.recordingId] : []
	);
	const byVideo = spotsByVideo(
		db,
		or(
			inArray(videoSpots.lessonVideoId, lessonVideoIds),
			inArray(videoSpots.recordingId, recordingIds)
		)!
	);
	const keep = keepFor(db, context.space);
	const groups = videos
		.map((video) => ({
			video,
			taughtHere: video.from.kind === 'lesson' && context.taught.has(video.from.lessonId),
			sections: labelled(db, byVideo.get(ownerKey(video.owner)) ?? [], keep).map((s) => ({
				...s,
				linked: linked.has(s.id)
			}))
		}))
		.filter((g) => g.sections.length > 0);
	return [...groups.filter((g) => g.taughtHere), ...groups.filter((g) => !g.taughtHere)];
}

/**
 * The lessons a position is taught in: linked by hand, or reaching it through
 * a section or point of one of their videos. Only the space's live lessons,
 * newest class first. `teamName` is the lesson's group's (null for a
 * person's), `via` whether a spot of its videos links it, `byHand` whether
 * it is linked by hand.
 */
export function positionTaughtIn(
	db: Db,
	space: Space,
	positionId: number
): {
	id: number;
	title: string;
	lessonDay: string;
	teamName: string | null;
	byHand: boolean;
	via: boolean;
}[] {
	const hand = new Set(
		db
			.select({ id: lessonPositions.lessonId })
			.from(lessonPositions)
			.where(eq(lessonPositions.positionId, positionId))
			.all()
			.map((r) => r.id)
	);
	const via = new Set(lessonsReaching(db, { positionId }));
	const ids = [...new Set([...hand, ...via])];
	if (ids.length === 0) return [];
	return db
		.select({
			id: lessons.id,
			title: lessons.title,
			lessonDay: lessons.lessonDay,
			teamName: teams.name
		})
		.from(lessons)
		.leftJoin(teams, eq(teams.id, lessons.teamId))
		.where(and(inArray(lessons.id, ids), ownedBy(lessons, space), isNull(lessons.archivedAt)))
		.orderBy(desc(lessons.lessonDay), desc(lessons.id))
		.all()
		.map((l) => ({ ...l, byHand: hand.has(l.id), via: via.has(l.id) }));
}
