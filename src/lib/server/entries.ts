/**
 * Entries: a person's own `exercises` rows that practise someone else's thing
 * (a group's lesson, routine, variation or drill), and adding a group lesson
 * to one's own. Adding copies nothing: it writes a `lesson_adds` row and the
 * entries the person ticked; content is always read from the target.
 */
import { and, eq, inArray, isNotNull, isNull, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { Db } from './db';
import {
	exercises,
	figures,
	lessonAdds,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessons,
	lessonVideos,
	routines,
	spotLinks,
	videoSpots,
	type Lesson
} from './db/schema';
import { allows, lessonAccess, reachFrom, type Reach } from './access';
import { addFigureExercise, figureLabels } from './figures';
import { reviewName } from './lessons';
import { getTeam } from './teams';
import type { TeamSpace } from './scope';
import type { AddItem, AddOffer, AddPicks } from '$lib/types';

type Exercise = typeof exercises.$inferSelect;

/**
 * What an entry practises: a lesson, a routine, a variation or a drill. Many
 * people can have an entry for the same target (a group's), so "the exercise
 * of X" is always "MY exercise of X": it takes the person with it.
 */
export type EntryTarget =
	{ lessonId: number } | { routineId: number } | { figureId: number } | { drillId: number };

function targetCondition(target: EntryTarget): SQL {
	if ('lessonId' in target) return eq(exercises.lessonId, target.lessonId);
	if ('routineId' in target) return eq(exercises.routineId, target.routineId);
	if ('figureId' in target) return eq(exercises.figureId, target.figureId);
	return eq(exercises.drillId, target.drillId);
}

/** This person's entry for the target, archived included (callers decide), or null. */
export function entryFor(db: Db, userId: string, target: EntryTarget): Exercise | null {
	return (
		db
			.select()
			.from(exercises)
			.where(and(targetCondition(target), eq(exercises.userId, userId)))
			.get() ?? null
	);
}

/** The `leftJoin(exercises, …)` condition that picks one person's entry, never two rows. */
export function entryJoin(userId: string, on: SQL): SQL {
	return and(on, eq(exercises.userId, userId))!;
}

const liveEntry = (db: Db, userId: string, target: EntryTarget) =>
	entryFor(db, userId, target)?.archivedAt === null;

/**
 * A group lesson this person may add: published, live, and one they read
 * (risk 21: the id comes from a form). Null for anything else, a personal
 * lesson included.
 */
function addableLesson(db: Db, userId: string, lessonId: number): Lesson | null {
	const lesson = db.select().from(lessons).where(eq(lessons.id, lessonId)).get();
	if (!lesson || lesson.teamId === null) return null;
	if (lesson.publishedAt === null || lesson.archivedAt !== null) return null;
	return allows(lessonAccess(db, userId, lesson), 'read') ? lesson : null;
}

/**
 * What the lesson itself holds, by hand or through its videos' sections, and
 * since when: each id maps to the earliest link that still brings it in. Only
 * what is in `reach` (the group's own, live rows). Embedded routines and slot
 * variations are in the lesson's reach but not "held": the sheet and "new"
 * show what the lesson page lists.
 */
function heldBy(db: Db, lessonId: number, reach: Reach) {
	const routineAt = new Map<number, number>();
	const drillAt = new Map<number, number>();
	const figureAt = new Map<number, number>();
	const keep = (map: Map<number, number>, ok: Set<number>, id: number | null, at: number) => {
		if (id === null || !ok.has(id)) return;
		const was = map.get(id);
		if (was === undefined || at < was) map.set(id, at);
	};
	for (const r of db
		.select({ id: lessonRoutines.routineId, at: lessonRoutines.createdAt })
		.from(lessonRoutines)
		.where(eq(lessonRoutines.lessonId, lessonId))
		.all())
		keep(routineAt, reach.routines, r.id, r.at);
	for (const r of db
		.select({ id: lessonExercises.exerciseId, at: lessonExercises.createdAt })
		.from(lessonExercises)
		.where(eq(lessonExercises.lessonId, lessonId))
		.all())
		keep(drillAt, reach.drills, r.id, r.at);
	for (const r of db
		.select({ id: lessonFigures.figureId, at: lessonFigures.createdAt })
		.from(lessonFigures)
		.where(eq(lessonFigures.lessonId, lessonId))
		.all())
		keep(figureAt, reach.variations, r.id, r.at);
	for (const r of db
		.select({
			figureId: spotLinks.figureId,
			drillId: spotLinks.exerciseId,
			at: spotLinks.createdAt
		})
		.from(spotLinks)
		.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
		.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.where(and(eq(lessonVideos.lessonId, lessonId), isNotNull(videoSpots.endMs)))
		.all()) {
		keep(figureAt, reach.variations, r.figureId, r.at);
		keep(drillAt, reach.drills, r.drillId, r.at);
	}
	return { routineAt, drillAt, figureAt };
}

const byName = (a: AddItem, b: AddItem) => a.name.localeCompare(b.name) || a.id - b.id;

function routineItems(db: Db, ids: number[]): AddItem[] {
	if (ids.length === 0) return [];
	return db
		.select({ id: routines.id, name: routines.name })
		.from(routines)
		.where(inArray(routines.id, ids))
		.all()
		.map((r) => ({ kind: 'routine' as const, id: r.id, name: r.name, ticked: true }))
		.sort(byName);
}

function drillItems(db: Db, ids: number[]): AddItem[] {
	if (ids.length === 0) return [];
	return db
		.select({ id: exercises.id, name: exercises.name })
		.from(exercises)
		.where(inArray(exercises.id, ids))
		.all()
		.map((r) => ({ kind: 'drill' as const, id: r.id, name: r.name, ticked: true }))
		.sort(byName);
}

/**
 * The Add sheet for a group lesson: how much it holds, and what can go on
 * Today. The lesson, its routines and drills come ticked; its figures are
 * listed unticked (a tick only decides Today, never what is visible). Null
 * when the person may not add it: a draft, an archived lesson, a personal
 * one, or one they cannot read.
 */
export function addOffer(db: Db, userId: string, lessonId: number): AddOffer | null {
	const lesson = addableLesson(db, userId, lessonId);
	if (!lesson) return null;
	const held = heldBy(db, lesson.id, reachFrom(db, lesson.teamId!, [lesson.id]));
	const space: TeamSpace = {
		dance: lesson.dance as TeamSpace['dance'],
		teamId: lesson.teamId!,
		actorId: userId
	};
	const labels = figureLabels(db, space);
	const figureItems: AddItem[] = [...held.figureAt.keys()]
		.map((id) => ({ kind: 'figure' as const, id, name: labels.get(id) ?? '', ticked: false }))
		.sort(byName);
	const routineRows = routineItems(db, [...held.routineAt.keys()]);
	const drillRows = drillItems(db, [...held.drillAt.keys()]);

	const videoIds = db
		.select({ id: lessonVideos.id })
		.from(lessonVideos)
		.where(eq(lessonVideos.lessonId, lesson.id))
		.all()
		.map((v) => v.id);
	const sections =
		videoIds.length === 0
			? 0
			: db
					.select({ id: videoSpots.id })
					.from(videoSpots)
					.where(and(inArray(videoSpots.lessonVideoId, videoIds), isNotNull(videoSpots.endMs)))
					.all().length;
	return {
		counts: {
			videos: videoIds.length,
			sections,
			figures: figureItems.length,
			routines: routineRows.length,
			drills: drillRows.length
		},
		items: [
			{ kind: 'lesson', id: lesson.id, name: lesson.title, ticked: true },
			...routineRows,
			...drillRows,
			...figureItems
		]
	};
}

type EntryValues = Omit<typeof exercises.$inferInsert, 'userId'>;

/**
 * This person's entry for the target: made, or brought back when archived
 * (the same row, so its sets and settings stay). A live one is left as it is,
 * so adding twice never trips the unique index.
 */
function ensureEntry(db: Db, userId: string, target: EntryTarget, values: EntryValues): void {
	const existing = entryFor(db, userId, target);
	if (existing) {
		if (existing.archivedAt !== null) {
			db.update(exercises)
				.set({ archivedAt: null, name: values.name })
				.where(eq(exercises.id, existing.id))
				.run();
		}
		return;
	}
	db.insert(exercises)
		.values({ ...values, userId })
		.run();
}

/**
 * Add a group lesson to one's own: in one transaction, the `lesson_adds` row
 * (added and seen now) and an entry for each pick, made or brought back. A
 * drill's entry starts in the drill's practice mode and tempo with no song:
 * songs are personal (risk 8). Entries never copy notes.
 *
 * False, with nothing written, unless the lesson is a published group lesson
 * the person reads. Picks outside the lesson's reach are ignored (risk 21).
 * Running it again with the same picks changes nothing.
 */
export function addLesson(
	db: Db,
	userId: string,
	lessonId: number,
	picks: AddPicks,
	now: number
): boolean {
	return db.transaction((tx) => {
		const lesson = addableLesson(tx, userId, lessonId);
		if (!lesson) return false;
		const reach = reachFrom(tx, lesson.teamId!, [lesson.id]);
		tx.insert(lessonAdds)
			.values({ userId, lessonId, addedAt: now, seenAt: now })
			.onConflictDoUpdate({
				target: [lessonAdds.userId, lessonAdds.lessonId],
				set: { addedAt: now, seenAt: now }
			})
			.run();
		const dance = lesson.dance;
		if (picks.lesson) {
			ensureEntry(
				tx,
				userId,
				{ lessonId },
				{
					name: reviewName(lesson.title),
					source: 'lesson',
					lessonId,
					dance
				}
			);
		}
		for (const id of new Set(picks.routineIds)) {
			if (!reach.routines.has(id)) continue;
			const routine = tx.select().from(routines).where(eq(routines.id, id)).get()!;
			ensureEntry(
				tx,
				userId,
				{ routineId: id },
				{
					name: routine.name,
					source: 'routine',
					routineId: id,
					dance
				}
			);
		}
		for (const id of new Set(picks.drillIds)) {
			if (!reach.drills.has(id)) continue;
			const drill = tx.select().from(exercises).where(eq(exercises.id, id)).get()!;
			ensureEntry(
				tx,
				userId,
				{ drillId: id },
				{
					name: drill.name,
					source: 'added',
					drillId: id,
					practiceMode: drill.practiceMode,
					countBpm: drill.countBpm,
					songId: null,
					dance
				}
			);
		}
		for (const id of new Set(picks.figureIds)) {
			if (reach.variations.has(id)) addFigureExercise(tx, userId, id);
		}
		return true;
	});
}

/**
 * Take a group lesson out of one's own: the `lesson_adds` row goes, and this
 * person's entries for the lesson and for what it holds are archived (logs
 * kept), except what another lesson they still have also holds (risk 5).
 * False for a lesson that is not a group's, or one they had not added.
 */
export function removeLesson(db: Db, userId: string, lessonId: number, now: number): boolean {
	return db.transaction((tx) => {
		const lesson = tx
			.select({ teamId: lessons.teamId })
			.from(lessons)
			.where(eq(lessons.id, lessonId))
			.get();
		if (!lesson || lesson.teamId === null) return false;
		const removed =
			tx
				.delete(lessonAdds)
				.where(and(eq(lessonAdds.userId, userId), eq(lessonAdds.lessonId, lessonId)))
				.run().changes > 0;
		reconcileEntries(tx, lesson.teamId, now, userId);
		return removed;
	});
}

/**
 * What came into a lesson after the person last saw it (`seen_at`) that they
 * do not practise: its routines and drills, never its figures (those are
 * opt-in from Moves). Empty for a lesson they have not added or can no
 * longer add.
 */
export function newInLesson(db: Db, userId: string, lessonId: number): AddItem[] {
	const add = db
		.select({ seenAt: lessonAdds.seenAt })
		.from(lessonAdds)
		.where(and(eq(lessonAdds.userId, userId), eq(lessonAdds.lessonId, lessonId)))
		.get();
	if (!add) return [];
	const lesson = addableLesson(db, userId, lessonId);
	if (!lesson) return [];
	const held = heldBy(db, lesson.id, reachFrom(db, lesson.teamId!, [lesson.id]));
	const fresh = (map: Map<number, number>, target: (id: number) => EntryTarget) =>
		[...map]
			.filter(([id, at]) => at > add.seenAt && !liveEntry(db, userId, target(id)))
			.map(([id]) => id);
	return [
		...routineItems(
			db,
			fresh(held.routineAt, (routineId) => ({ routineId }))
		),
		...drillItems(
			db,
			fresh(held.drillAt, (drillId) => ({ drillId }))
		)
	];
}

/** "Not now", or a confirmed Add sheet: what is in the lesson now is no longer new. */
export function markSeen(db: Db, userId: string, lessonId: number, now: number): boolean {
	return (
		db
			.update(lessonAdds)
			.set({ seenAt: now })
			.where(and(eq(lessonAdds.userId, userId), eq(lessonAdds.lessonId, lessonId)))
			.run().changes > 0
	);
}

/** A person's added lessons of this group that still count: published and live. */
function addedLessons(db: Db, userId: string, teamId: number): number[] {
	return db
		.select({ id: lessons.id })
		.from(lessonAdds)
		.innerJoin(lessons, eq(lessons.id, lessonAdds.lessonId))
		.where(
			and(
				eq(lessonAdds.userId, userId),
				eq(lessons.teamId, teamId),
				isNotNull(lessons.publishedAt),
				isNull(lessons.archivedAt)
			)
		)
		.all()
		.map((r) => r.id)
		.sort((a, b) => a - b);
}

/**
 * Taken out means off Today (risk 25). Archives, with `now`, each live entry
 * on this group's rows whose target its person's added lessons no longer
 * hold: a lesson they removed or that was archived, and a routine, variation
 * or drill no added lesson reaches any more. Logs stay (archived entries keep
 * their sets). With `userId`, only that person's entries.
 *
 * Run inside the transaction of every group change that can shrink reach, so
 * an entry never outlives what it practises. A person's own space never calls
 * it: their entries point at their own rows.
 */
export function reconcileEntries(tx: Db, teamId: number, now: number, userId?: string): void {
	const drills = alias(exercises, 'drills');
	const ofTeam = <T extends typeof lessons | typeof routines | typeof figures | typeof drills>(
		t: T
	) => tx.select({ id: t.id }).from(t).where(eq(t.teamId, teamId));
	const entries = tx
		.select({
			id: exercises.id,
			userId: exercises.userId,
			lessonId: exercises.lessonId,
			routineId: exercises.routineId,
			figureId: exercises.figureId,
			drillId: exercises.drillId
		})
		.from(exercises)
		.where(
			and(
				isNotNull(exercises.userId),
				isNull(exercises.archivedAt),
				userId === undefined ? undefined : eq(exercises.userId, userId),
				or(
					inArray(exercises.lessonId, ofTeam(lessons)),
					inArray(exercises.routineId, ofTeam(routines)),
					inArray(exercises.figureId, ofTeam(figures)),
					inArray(exercises.drillId, ofTeam(drills))
				)
			)
		)
		.all();
	if (entries.length === 0) return;

	const team = getTeam(tx, teamId);
	const reachOf = new Map<string, Reach>();
	const out: number[] = [];
	for (const e of entries) {
		let reach = reachOf.get(e.userId!);
		if (!reach) {
			const added = team && team.purgedAt === null ? addedLessons(tx, e.userId!, teamId) : [];
			reach = reachFrom(tx, teamId, added);
			reachOf.set(e.userId!, reach);
		}
		const held =
			e.lessonId !== null
				? reach.lessons.has(e.lessonId)
				: e.routineId !== null
					? reach.routines.has(e.routineId)
					: e.figureId !== null
						? reach.variations.has(e.figureId)
						: reach.drills.has(e.drillId!);
		if (!held) out.push(e.id);
	}
	if (out.length === 0) return;
	tx.update(exercises)
		.set({ archivedAt: now })
		.where(and(inArray(exercises.id, out), isNull(exercises.archivedAt)))
		.run();
}
