/**
 * Move to… a group (board C4 p3, spec point 8): Copy to… plus Drop my copy in
 * one step, for the person's own lesson. The lesson lands in a group they own
 * or edit as a draft (`copyTo`) and leaves their lessons (archived, its
 * practice with it). For each figure, routine and drill of theirs it brings,
 * they keep theirs as well, or use the group's from now on: theirs is
 * dropped (archived) and their other lessons and routines are re-pointed to
 * the group's copy (`repoint`).
 *
 * Practice cannot follow (ruling 11): the group's lesson is a draft, so
 * nothing in it can be added (R8). Every dropped thing's practice stays with
 * the archived copy, and "Keep mine as well" is the default for anything the
 * person's other lessons or routines use, or that they practise; "Use the
 * group’s" only for what only this lesson used.
 *
 * The moved lesson's own links stay on the person's copies: it is archived
 * as it was, so restoring it brings back theirs. The group logs only the
 * copy's `add` (ruling 7); everything else is the person's own.
 */
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { CloneKind, MoveItem, MoveOffer, MovePreview } from '$lib/types';
import { moveWhy } from '$lib/clones/view';
import type { Db } from '../db';
import {
	exercises,
	figures,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessons,
	lessonVideos,
	routines,
	routineStepOptions,
	routineSteps,
	sets,
	spotLinks,
	videoSpots
} from '../db/schema';
import { inSpace, ownedBy, type TeamSpace, type Wall } from '../scope';
import { archiveVariation } from '../figures';
import { archiveRoutine } from '../routines';
import { archiveExercise } from '../exercises';
import { archiveLesson } from '../lessons';
import { planClone, useKey, type CloneResult } from './clone';
import { copyPlan, copyTargets, copyTo } from './copy-to';
import { geneOf, memberIn } from './genes';
import { repoint } from './repoint';
import { ENTRY, keepNestedEmbeds } from './rescue';
import type { CloneFiles } from './files';
import { rowOf } from './edit';

type ItemKind = MoveItem['kind'];
type Choice = 'keep' | 'group';

const DENIED = { ok: false, reason: 'denied' } as const;
const ITEM_KINDS = new Set<string>(['figure', 'routine', 'drill']);
const OWNER = { figure: figures, routine: routines, drill: exercises } as const;

/** A choice's key in the form: `figure:12`. */
export const moveKey = (kind: ItemKind, id: number) => `${kind}:${id}`;

const teamSpace = (wall: Wall, teamId: number): TeamSpace => ({
	dance: wall.dance,
	teamId,
	actorId: wall.userId
});

/** The person's own live lesson of the wall's dance, or null. */
function ownLesson(db: Db, wall: Wall, id: number) {
	const lesson = db.select().from(lessons).where(eq(lessons.id, id)).get();
	return lesson && lesson.archivedAt === null && inSpace(lesson, wall) ? lesson : null;
}

/** The groups the lesson can move to: Copy to…'s, where the lesson's family has no member yet. */
function moveTargets(db: Db, wall: Wall, lessonId: number) {
	if (!ownLesson(db, wall, lessonId)) return [];
	return copyTargets(db, wall.userId, 'lesson', lessonId).filter(
		(t) => t.place.kind === 'team' && t.existing === null
	);
}

/**
 * Move to… on the lesson's page: its title and the groups it can go to (the
 * live groups of its dance the person owns or edits, which hold no copy of
 * it yet: there, Copy to… compares). Null for a lesson that is not the
 * person's own and live, or when there is no such group.
 */
export function moveOffer(db: Db, wall: Wall, lessonId: number): MoveOffer | null {
	const targets = moveTargets(db, wall, lessonId);
	if (targets.length === 0) return null;
	return { title: ownLesson(db, wall, lessonId)!.title, targets };
}

/** Whether the row of the kind is the person's own, in the wall's dance. */
function isMine(db: Db, wall: Wall, kind: ItemKind, id: number): boolean {
	const t = OWNER[kind];
	const row = db
		.select({ userId: t.userId, teamId: t.teamId, dance: t.dance })
		.from(t)
		.where(eq(t.id, id))
		.get();
	return !!row && inSpace(row, wall);
}

/** The person's other live lessons that link it: by hand, or through a section on their videos. */
function otherLessons(db: Db, wall: Wall, kind: ItemKind, id: number, lessonId: number): number {
	const live = and(ownedBy(lessons, wall), isNull(lessons.archivedAt), ne(lessons.id, lessonId));
	const ids = new Set<number>();
	const hand =
		kind === 'figure'
			? { t: lessonFigures, col: lessonFigures.figureId, lesson: lessonFigures.lessonId }
			: kind === 'routine'
				? { t: lessonRoutines, col: lessonRoutines.routineId, lesson: lessonRoutines.lessonId }
				: { t: lessonExercises, col: lessonExercises.exerciseId, lesson: lessonExercises.lessonId };
	for (const r of db
		.select({ id: lessons.id })
		.from(hand.t)
		.innerJoin(lessons, eq(lessons.id, hand.lesson))
		.where(and(eq(hand.col, id), live))
		.all())
		ids.add(r.id);
	const spotCol =
		kind === 'figure' ? spotLinks.figureId : kind === 'drill' ? spotLinks.exerciseId : null;
	if (spotCol) {
		for (const r of db
			.select({ id: lessons.id })
			.from(spotLinks)
			.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
			.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
			.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
			.where(and(eq(spotCol, id), live))
			.all())
			ids.add(r.id);
	}
	return ids.size;
}

/** The person's live routines using it: a figure in a slot, a routine embedded. By name. */
function routinesUsing(
	db: Db,
	wall: Wall,
	kind: ItemKind,
	id: number
): { id: number; name: string }[] {
	const live = and(ownedBy(routines, wall), isNull(routines.archivedAt));
	const rows =
		kind === 'figure'
			? db
					.select({ id: routines.id, name: routines.name })
					.from(routineStepOptions)
					.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
					.innerJoin(routines, eq(routines.id, routineSteps.routineId))
					.where(and(eq(routineStepOptions.figureId, id), live))
					.all()
			: kind === 'routine'
				? db
						.select({ id: routines.id, name: routines.name })
						.from(routineSteps)
						.innerJoin(routines, eq(routines.id, routineSteps.routineId))
						.where(and(eq(routineSteps.childRoutineId, id), live))
						.all()
				: [];
	const byId = new Map(rows.map((r) => [r.id, r]));
	return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

/**
 * Whether the person practises it: their live entry on it (a drill: the drill
 * itself, live) is on Today (active) or has sets logged.
 */
function practised(db: Db, wall: Wall, kind: ItemKind, id: number): boolean {
	const entry =
		kind === 'drill'
			? db
					.select()
					.from(exercises)
					.where(and(eq(exercises.id, id), isNull(exercises.archivedAt)))
					.get()
			: db
					.select()
					.from(exercises)
					.where(and(ownedBy(exercises, wall), eq(ENTRY[kind], id), isNull(exercises.archivedAt)))
					.get();
	if (!entry) return false;
	if (entry.active) return true;
	return (
		db.select({ id: sets.id }).from(sets).where(eq(sets.exerciseId, entry.id)).get() !== undefined
	);
}

/**
 * The person's own figures, routines and drills the copy would bring into
 * the group (copied, or reused from a live member there), in the copy's
 * order, each with why it is kept by default. Kept: what the person's other
 * live lessons or routines use, or what they practise; a routine the lesson
 * brings counts as a user only while it is kept itself. The rest is "Only
 * this lesson", whose default is the group's.
 */
function itemsOf(db: Db, wall: Wall, lessonId: number, into: TeamSpace): MoveItem[] {
	const plan = planClone(db, { kind: 'lesson', id: lessonId, into, recordings: true });
	const found: { kind: ItemKind; id: number }[] = [];
	const seen = new Set<string>();
	const push = (kind: CloneKind | string, id: number) => {
		if (!ITEM_KINDS.has(kind)) return;
		const k = moveKey(kind as ItemKind, id);
		if (seen.has(k) || !isMine(db, wall, kind as ItemKind, id)) return;
		seen.add(k);
		found.push({ kind: kind as ItemKind, id });
	};
	for (const r of plan.rows.slice(1)) push(r.kind, r.from);
	// An archived member there is no group's version to use: the person's stays.
	for (const r of plan.reused)
		if (rowOf(db, r.kind, r.at)?.archivedAt === null) push(r.kind, r.from);

	const uses = found.map((f) => ({
		...f,
		lessons: otherLessons(db, wall, f.kind, f.id, lessonId),
		routines: routinesUsing(db, wall, f.kind, f.id),
		practised: practised(db, wall, f.kind, f.id)
	}));
	const brought = new Set(found.filter((f) => f.kind === 'routine').map((f) => f.id));
	const keep = new Map<string, boolean>();
	for (const u of uses)
		keep.set(
			moveKey(u.kind, u.id),
			u.lessons > 0 || u.practised || u.routines.some((r) => !brought.has(r.id))
		);
	// A routine this lesson brings uses it only while that routine is kept.
	const keptRoutine = (id: number) => keep.get(moveKey('routine', id)) === true;
	for (let changed = true; changed;) {
		changed = false;
		for (const u of uses) {
			const k = moveKey(u.kind, u.id);
			if (keep.get(k)) continue;
			if (u.routines.some((r) => brought.has(r.id) && keptRoutine(r.id))) {
				keep.set(k, true);
				changed = true;
			}
		}
	}
	return uses.map((u) => {
		const users = u.routines.filter((r) => !brought.has(r.id) || keptRoutine(r.id));
		return {
			kind: u.kind,
			id: u.id,
			label: rowOf(db, u.kind, u.id)?.title ?? '',
			why: moveWhy({
				lessons: u.lessons,
				routines: users.map((r) => r.name),
				practised: u.practised
			}),
			keepByDefault: keep.get(moveKey(u.kind, u.id)) === true,
			practised: u.practised
		};
	});
}

/** The lesson's own `use` key: its twins question is not asked, the lesson that moves is this one. */
const rootKey = (db: Db, lessonId: number) =>
	useKey('lesson', { id: lessonId, geneId: geneOf(db, 'lesson', lessonId) });

/**
 * What moving the person's own lesson into `teamId` would do (board C4 p3):
 * Copy to…'s plan (what goes, what the group has already, the twins
 * questions, the lesson's own left out), and each thing of theirs it brings
 * with why and the default (`itemsOf`). Reads only. Null when the lesson is
 * not theirs and live, or the group is not one it can move to.
 */
export function movePreview(
	db: Db,
	wall: Wall,
	lessonId: number,
	teamId: number,
	tz = 'UTC'
): MovePreview | null {
	if (
		!moveTargets(db, wall, lessonId).some(
			(t) => t.place.kind === 'team' && t.place.teamId === teamId
		)
	)
		return null;
	const into = teamSpace(wall, teamId);
	const plan = copyPlan(db, wall.userId, 'lesson', lessonId, into, tz);
	const root = rootKey(db, lessonId);
	return {
		...plan,
		twins: plan.twins.filter((q) => q.gene !== root),
		items: itemsOf(db, wall, lessonId, into)
	};
}

/** The person's own row of the kind archived with what its archive takes (its own practice). */
function archiveMine(tx: Db, kind: ItemKind, id: number, now: number): boolean {
	switch (kind) {
		case 'figure':
			return archiveVariation(tx, id, now) !== null;
		case 'routine':
			return archiveRoutine(tx, id, now);
		case 'drill':
			return archiveExercise(tx, id, now);
	}
}

/** The lesson's links as they are: its hand links and its videos' section links. */
function linksOf(tx: Db, lessonId: number) {
	const spotIds = tx
		.select({ id: videoSpots.id })
		.from(videoSpots)
		.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.where(eq(lessonVideos.lessonId, lessonId))
		.all()
		.map((r) => r.id);
	return {
		figures: tx.select().from(lessonFigures).where(eq(lessonFigures.lessonId, lessonId)).all(),
		routines: tx.select().from(lessonRoutines).where(eq(lessonRoutines.lessonId, lessonId)).all(),
		drills: tx.select().from(lessonExercises).where(eq(lessonExercises.lessonId, lessonId)).all(),
		spotIds,
		spotLinks:
			spotIds.length === 0
				? []
				: tx.select().from(spotLinks).where(inArray(spotLinks.spotId, spotIds)).all()
	};
}

/** Put the lesson's links back as `linksOf` read them (`repoint` moved them with the person's rows). */
function restoreLinks(tx: Db, lessonId: number, was: ReturnType<typeof linksOf>): void {
	tx.delete(lessonFigures).where(eq(lessonFigures.lessonId, lessonId)).run();
	tx.delete(lessonRoutines).where(eq(lessonRoutines.lessonId, lessonId)).run();
	tx.delete(lessonExercises).where(eq(lessonExercises.lessonId, lessonId)).run();
	if (was.figures.length > 0) tx.insert(lessonFigures).values(was.figures).run();
	if (was.routines.length > 0) tx.insert(lessonRoutines).values(was.routines).run();
	if (was.drills.length > 0) tx.insert(lessonExercises).values(was.drills).run();
	if (was.spotIds.length > 0) {
		tx.delete(spotLinks).where(inArray(spotLinks.spotId, was.spotIds)).run();
		if (was.spotLinks.length > 0) tx.insert(spotLinks).values(was.spotLinks).run();
	}
}

/** A refusal inside the write: rolls the copy back with everything after it. */
class Refused extends Error {}

/**
 * Move the person's own lesson into `teamId` (board C4 p3), in one
 * transaction with the copy (`copyTo`'s `after`): the lesson copied there as
 * a draft, the twins answered by `use` (the lesson's own question is never
 * asked); then for each thing of theirs it brings whose choice is `'group'`
 * (`choices` by `moveKey`; one left out takes its default), their rows
 * re-pointed onto the group's copy without their practice, and theirs
 * archived; then the lesson archived, with its practice. `denied` for a
 * lesson or group `movePreview` would not show, or a choice it does not
 * offer; `room` and `name` as the copy's. Answers the group's new lesson.
 */
export async function moveLesson(
	db: Db,
	wall: Wall,
	lessonId: number,
	teamId: number,
	choices: Record<string, Choice>,
	use: Record<string, number>,
	files: CloneFiles,
	now: number,
	freeDiskBytes: number
): Promise<CloneResult> {
	const preview = movePreview(db, wall, lessonId, teamId);
	if (!preview) return DENIED;
	const offered = new Map(preview.items.map((i) => [moveKey(i.kind, i.id), i]));
	for (const [key, choice] of Object.entries(choices))
		if (!offered.has(key) || (choice !== 'keep' && choice !== 'group')) return DENIED;
	const answers = { ...use };
	delete answers[rootKey(db, lessonId)];
	// Each dropped thing with the row its family's copy is made from: its own, or the twin chosen.
	const drop = preview.items
		.filter(
			(i) => (choices[moveKey(i.kind, i.id)] ?? (i.keepByDefault ? 'keep' : 'group')) === 'group'
		)
		.map((i) => ({
			...i,
			source: answers[useKey(i.kind, { id: i.id, geneId: geneOf(db, i.kind, i.id) })] ?? i.id
		}));
	const into = teamSpace(wall, teamId);

	try {
		const res = await copyTo(
			db,
			wall.userId,
			'lesson',
			lessonId,
			into,
			answers,
			files,
			now,
			freeDiskBytes,
			{
				after: (tx, copied) => {
					// The group holds the lesson already (a race): Copy to… compares, Move does nothing.
					if (!copied.made) throw new Refused();
					const was = linksOf(tx, lessonId);
					for (const item of drop) {
						const gene = geneOf(tx, item.kind, item.source);
						const theirs = gene === null ? null : memberIn(tx, item.kind, gene, into);
						if (!theirs || theirs.archived) throw new Refused();
						repoint(
							tx,
							wall.userId,
							wall.dance,
							item.kind,
							item.id,
							theirs.id,
							{ entries: false },
							now
						);
						if (item.kind === 'routine') keepNestedEmbeds(tx, wall, item.id, theirs.id);
					}
					restoreLinks(tx, lessonId, was);
					for (const item of drop)
						if (!archiveMine(tx, item.kind, item.id, now)) throw new Refused();
					if (!archiveLesson(tx, lessonId, now)) throw new Refused();
				}
			}
		);
		return res.ok && !res.made ? DENIED : res;
	} catch (err) {
		if (err instanceof Refused) return DENIED;
		throw err;
	}
}
