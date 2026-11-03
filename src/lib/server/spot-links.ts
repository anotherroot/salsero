/**
 * Sections of a video linked to figure versions and drills. See
 * `docs/superpowers/specs/2026-10-15-video-section-links-design.md`.
 *
 * Every rule the table cannot carry lives here: a section and not a point, one
 * space (a person's or a group's side of one dance), drills only. Imported BY `spots.ts`, `figures.ts` and `lessons.ts` —
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
	LinkCreateField,
	LinkedSection,
	SectionGroup,
	SectionLinkChip,
	SectionTarget,
	SectionVideo,
	Spot,
	SpotOwner,
	VideoSection
} from '$lib/types';
import { allows, spotAccess, type Reach } from './access';
import { reconcileEntries } from './entries';
import { lessonsReaching } from './lesson-links';
import { inSpace, isTeam, ownedBy, spaceOfRow, type Space } from './scope';
import { actingIn, logChange, spotRoot } from './changes';
import { spotWords, trashRows, type TrashRows } from './trash';

/**
 * A link that cannot be made. `status` is what the route answers with; `field`,
 * when a create step's field is the reason, is where the Link popup shows it.
 */
export class SpotLinkError extends Error {
	constructor(
		message: string,
		readonly status: 400 | 409 = 400,
		readonly field?: LinkCreateField
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
			lessonUser: lessons.userId,
			lessonTeam: lessons.teamId,
			figureDance: figures.dance,
			figureUser: figures.userId,
			figureTeam: figures.teamId
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
	return {
		owner,
		dance: (row.lessonDance ?? row.figureDance)!,
		/** Whose video it is: its lesson's or its figure's owner, a person or a team. */
		userId: row.lessonDance !== null ? row.lessonUser : row.figureUser,
		teamId: row.lessonDance !== null ? row.lessonTeam : row.figureTeam,
		isSection: row.endMs !== null
	};
}

/**
 * What a reader may see of a group's videos and links: their reach. Lists that
 * take one leave out every video (a lesson's, a recording's) and every link
 * target outside it, so a draft's things never reach a member's page (risk 20).
 * Omitted, a list shows the whole space, as its editors and a person see it.
 */
export type Visible = Pick<Reach, 'lessons' | 'recordings' | 'variations' | 'drills'>;

/** Whether a row has this space's owner, whatever its dance. */
const sameOwner = (row: { userId: string | null; teamId: number | null }, space: Space) =>
	inSpace({ ...row, dance: space.dance }, space);

/**
 * The target's dance, if its owner is the space's. Throws for a missing target,
 * another owner's (the same answer: telling them apart would confirm the id
 * exists), or an exercise that is not a drill.
 */
function targetDance(db: Db, space: Space, target: SectionTarget): string {
	if ('figureId' in target) {
		const f = db
			.select({ dance: figures.dance, userId: figures.userId, teamId: figures.teamId })
			.from(figures)
			.where(eq(figures.id, target.figureId))
			.get();
		if (!f || !sameOwner(f, space)) throw new SpotLinkError('No such figure.');
		return f.dance;
	}
	const e = db
		.select({
			dance: exercises.dance,
			userId: exercises.userId,
			teamId: exercises.teamId,
			source: exercises.source
		})
		.from(exercises)
		.where(eq(exercises.id, target.exerciseId))
		.get();
	if (!e || !sameOwner(e, space)) throw new SpotLinkError('No such exercise.');
	if (e.source !== 'custom') throw new SpotLinkError('Only a drill can have sections of its own.');
	return e.dance;
}

/**
 * The space of a section, for the person asking, when they may change it:
 * their own, or a group's they edit. Null for a missing section, another
 * person's, and a group's they only read or cannot see — all one answer.
 */
export function sectionSpace(db: Db, userId: string, spotId: number): Space | null {
	const video = videoOfSpot(db, spotId);
	if (!video || !allows(spotAccess(db, userId, spotId), 'edit')) return null;
	return spaceOfRow(video, userId);
}

export const targetColumn = (target: SectionTarget) =>
	'figureId' in target
		? eq(spotLinks.figureId, target.figureId)
		: eq(spotLinks.exerciseId, target.exerciseId);

/**
 * The new link's id, linking a section `userId` may edit (their own, or a
 * group's they edit) to a target of the same owner. Throws `SpotLinkError` for
 * a point, another dance, a non-drill, a duplicate — and for a section or
 * target of another owner's, with the answer a missing one gets.
 */
export function linkSpot(db: Db, userId: string, spotId: number, target: SectionTarget): number {
	const space = sectionSpace(db, userId, spotId);
	if (!space) throw new SpotLinkError('No such section.');
	return linkInSpace(db, space, spotId, target);
}

/**
 * `linkSpot` within one space: the section and the target must both be its
 * owner's — a person's or a group's, never one of each. The caller has
 * already decided that whoever asks may edit this space.
 */
export function linkInSpace(db: Db, space: Space, spotId: number, target: SectionTarget): number {
	const video = videoOfSpot(db, spotId);
	if (!video || !inSpace(video, space)) throw new SpotLinkError('No such section.');
	if (!video.isSection) throw new SpotLinkError('Only a section can be linked, not a point.');
	if (targetDance(db, space, target) !== video.dance) {
		throw new SpotLinkError('That section is from the other dance.');
	}
	const taken = db
		.select({ id: spotLinks.id })
		.from(spotLinks)
		.where(and(eq(spotLinks.spotId, spotId), targetColumn(target)))
		.get();
	if (taken) throw new SpotLinkError('Already linked.', 409);
	return db.transaction((tx) => {
		const id = tx
			.insert(spotLinks)
			.values({ spotId, ...target })
			.returning({ id: spotLinks.id })
			.get().id;
		logSectionLink(tx, space, 'add', { id, spotId, target }, Date.now());
		return id;
	});
}

/** The name History shows for what a section is linked to ("Enchufla · Doble", a drill's). */
function targetName(db: Db, target: SectionTarget): string | null {
	if ('figureId' in target) {
		const row = db
			.select({ figure: figureGroups.name, name: figures.name })
			.from(figures)
			.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
			.where(eq(figures.id, target.figureId))
			.get();
		return row ? `${row.figure} · ${row.name}` : null;
	}
	return (
		db
			.select({ name: exercises.name })
			.from(exercises)
			.where(eq(exercises.id, target.exerciseId))
			.get()?.name ?? null
	);
}

/**
 * History's line for a section link made or removed, filed under the
 * section's video's lesson (or its recording's figure). `space` is the
 * section's, with who acts.
 */
function logSectionLink(
	tx: Db,
	space: Space,
	verb: 'add' | 'remove',
	link: { id: number; spotId: number; target: SectionTarget },
	now: number,
	trashId: number | null = null
): void {
	const root = spotRoot(tx, link.spotId);
	if (!root) return;
	const named = { name: targetName(tx, link.target) };
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
 * Whether a row went. Scoped to the target, so another target's link id deletes nothing.
 * A group section's link going can take a drill or variation off its lesson:
 * members' entries follow (`reconcileEntries`).
 */
export function unlinkSpot(
	db: Db,
	id: number,
	target: SectionTarget,
	now = Date.now(),
	by?: string
): boolean {
	return db.transaction((tx) => {
		const link = tx
			.delete(spotLinks)
			.where(and(eq(spotLinks.id, id), targetColumn(target)))
			.returning()
			.get();
		if (!link) return false;
		reconcileSpot(tx, link.spotId, now);
		logUnlinked(tx, { id, spotId: link.spotId, target }, by, now, { spot_links: [link] });
		return true;
	});
}

/**
 * `logSectionLink` for an unlink: the section's space, acted in by `by`. A
 * group's goes to Recently deleted first, with the rows the unlink removed.
 */
function logUnlinked(
	tx: Db,
	link: { id: number; spotId: number; target: SectionTarget },
	by: string | undefined,
	now: number,
	rows: TrashRows
): void {
	const video = videoOfSpot(tx, link.spotId);
	if (!video) return;
	const space = actingIn(video, by);
	let trashId: number | null = null;
	const root = isTeam(space) ? spotRoot(tx, link.spotId) : null;
	if (root && isTeam(space)) {
		const spot = tx.select().from(videoSpots).where(eq(videoSpots.id, link.spotId)).get();
		const label = `${spot ? spotWords(spot) : 'A section'} · ${targetName(tx, link.target) ?? '?'}`;
		const at = { rootKind: root.rootKind, rootId: root.rootId };
		trashId = trashRows(tx, space, 'spot-link', label, at, rows, [], 0, now);
	}
	logSectionLink(tx, space, 'remove', link, now, trashId);
}

/** After a group section loses a link, in the same transaction (risk 25). */
function reconcileSpot(tx: Db, spotId: number, now: number): void {
	const teamId = videoOfSpot(tx, spotId)?.teamId ?? null;
	if (teamId !== null) reconcileEntries(tx, teamId, now);
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
	alsoLesson: boolean,
	now = Date.now(),
	by?: string
): boolean {
	return db.transaction((tx) => {
		const link = getSpotLink(tx, linkId);
		if (!link || link.spotId !== spotId) return false;
		const rows: TrashRows = {
			spot_links: tx.delete(spotLinks).where(eq(spotLinks.id, linkId)).returning().all()
		};
		if (alsoLesson) {
			const lesson = tx
				.select({ id: lessonVideos.lessonId })
				.from(videoSpots)
				.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
				.where(eq(videoSpots.id, spotId))
				.get();
			if (lesson && 'figureId' in link.target) {
				rows.lesson_figures = tx
					.delete(lessonFigures)
					.where(
						and(
							eq(lessonFigures.lessonId, lesson.id),
							eq(lessonFigures.figureId, link.target.figureId)
						)
					)
					.returning()
					.all();
			} else if (lesson && 'exerciseId' in link.target) {
				rows.lesson_exercises = tx
					.delete(lessonExercises)
					.where(
						and(
							eq(lessonExercises.lessonId, lesson.id),
							eq(lessonExercises.exerciseId, link.target.exerciseId)
						)
					)
					.returning()
					.all();
			}
		}
		reconcileSpot(tx, spotId, now);
		logUnlinked(tx, link, by, now, rows);
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
 * spot. A variation counts as archived when its figure is. With `visible`, a
 * link to anything outside it is left out.
 */
export function linkChips(
	db: Db,
	spotIds: number[],
	visible?: Visible
): Map<number, SectionLinkChip[]> {
	const out = new Map<number, SectionLinkChip[]>();
	if (spotIds.length === 0) return out;
	const rows = db
		.select({
			id: spotLinks.id,
			spotId: spotLinks.spotId,
			figureId: spotLinks.figureId,
			exerciseId: spotLinks.exerciseId,
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
		if (
			visible &&
			!(r.figureId !== null
				? visible.variations.has(r.figureId)
				: visible.drills.has(r.exerciseId!))
		)
			continue;
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
 * Every live video in a space, in the sheet's order: lesson videos newest
 * lesson first, then figure recordings by figure. Archived lessons and figures
 * are gone from every list, so their videos are gone from this one. With
 * `visible`, only the videos of its lessons and its recordings.
 */
function videosOf(db: Db, space: Space, visible?: Visible): SectionVideo[] {
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
		.where(and(ownedBy(lessons, space), isNull(lessons.archivedAt)))
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
		.where(and(ownedBy(figures, space), isNull(figures.archivedAt), eq(recordings.kind, 'video')))
		.orderBy(asc(figureGroups.name), asc(figures.name), asc(recordings.id))
		.all();
	const shown = <T>(rows: T[], keep: (r: T) => boolean) => (visible ? rows.filter(keep) : rows);
	return [
		...shown(lessonRows, (r) => visible!.lessons.has(r.lessonId)).map((r) => ({
			owner: { lessonVideoId: r.id },
			src: `/lesson-videos/${r.file}`,
			from: {
				kind: 'lesson' as const,
				lessonId: r.lessonId,
				title: r.title,
				lessonDay: r.lessonDay
			}
		})),
		...shown(recRows, (r) => visible!.recordings.has(r.id)).map((r) => ({
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
 * A target's space (dance and owner) and the lessons it is taught in (a
 * variation's own links only). Null for a target that does not exist.
 */
function targetContext(db: Db, target: SectionTarget) {
	if ('figureId' in target) {
		const f = db
			.select({ dance: figures.dance, userId: figures.userId, teamId: figures.teamId })
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
			space: spaceOfRow(f, ''),
			taught: new Set([...rows.map((r) => r.id), ...lessonsReaching(db, target)])
		};
	}
	const e = db
		.select({ dance: exercises.dance, userId: exercises.userId, teamId: exercises.teamId })
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
		space: spaceOfRow(e, ''),
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

function labelled(db: Db, spots: BareSpot[], visible?: Visible): Spot[] {
	const chips = linkChips(
		db,
		spots.map((s) => s.id),
		visible
	);
	return spots.map((s) => ({ ...s, linkedTo: (chips.get(s.id) ?? []).map((c) => c.label) }));
}

/**
 * The "Link a section" picker: every section in the target's space — its owner's,
 * of its dance — grouped by video, the ones already linked to it flagged. Lessons it is taught in come first.
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
	const groups = videosOf(db, context.space)
		.map((video) => ({
			video,
			taughtHere: video.from.kind === 'lesson' && context.taught.has(video.from.lessonId),
			sections: labelled(db, byVideo.get(ownerKey(video.owner)) ?? []).map((s) => ({
				...s,
				linked: linked.has(s.id)
			}))
		}))
		.filter((g) => g.sections.length > 0);
	return [...groups.filter((g) => g.taughtHere), ...groups.filter((g) => !g.taughtHere)];
}

/**
 * The cards of a figure version or a drill, in the sheet's video order. A link
 * whose video's lesson or figure is archived drops out with it, and comes back
 * with it; it still blocks a delete meanwhile. With `visible` (a reader's
 * page), only the sections on its videos, and only its links.
 */
export function sectionsFor(db: Db, target: SectionTarget, visible?: Visible): LinkedSection[] {
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
	// One space per link, so every linked section's video is among these; a
	// link that crosses spaces (only old data could hold one) shows nothing.
	return videosOf(db, context.space, visible).flatMap((video) =>
		labelled(db, byVideo.get(ownerKey(video.owner)) ?? [], visible).map((spot) => ({
			linkId: linkOf.get(spot.id)!,
			spot,
			video
		}))
	);
}

/**
 * A video's sections with their links — the lesson page's list. With
 * `visible` (a reader's page), only the links to what it holds.
 */
export function videoSections(db: Db, owner: SpotOwner, visible?: Visible): VideoSection[] {
	const where =
		'recordingId' in owner
			? eq(videoSpots.recordingId, owner.recordingId)
			: eq(videoSpots.lessonVideoId, owner.lessonVideoId);
	const spots = sectionsByVideo(db, and(isNotNull(videoSpots.endMs), where)).get(ownerKey(owner));
	if (!spots) return [];
	const chips = linkChips(
		db,
		spots.map((s) => s.id),
		visible
	);
	return spots.map((s) => ({ ...s, endMs: s.endMs!, links: chips.get(s.id) ?? [] }));
}
