/**
 * The daily number and the day's picks. Both are the person's choices, stored;
 * what Today shows is still derived from sets (`src/lib/schedule/`).
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, todayPicks, users } from './db/schema';
import { inWall, type Wall } from './scope';
import type { DayPick, PickKind } from '$lib/schedule/picks';
import type { DayInput } from '$lib/schedule/today-list';
import { localDay } from '$lib/day/day';
import type { ExerciseItem } from '$lib/types';
import { listExercises } from './exercises';
import { listScheduleSets } from './schedule';

export const DAILY_DEFAULT = 5;
export const DAILY_MIN = 1;
export const DAILY_MAX = 30;

/** A pick the person may not make; the action turns it into a 400. */
export class PickRefused extends Error {}

const clampDaily = (n: number) => Math.min(DAILY_MAX, Math.max(DAILY_MIN, Math.round(n)));

export function dailyCountOf(db: Db, userId: string): number {
	const row = db.select({ n: users.dailyCount }).from(users).where(eq(users.id, userId)).get();
	return row?.n == null ? DAILY_DEFAULT : clampDaily(row.n);
}

/** Store the daily number, clamped into 1–30; returns what was stored. */
export function setDailyCount(db: Db, userId: string, n: number): number {
	if (!Number.isFinite(n)) throw new RangeError(`not a number: ${n}`);
	const stored = clampDaily(n);
	db.update(users).set({ dailyCount: stored }).where(eq(users.id, userId)).run();
	return stored;
}

/** The day's picks of this wall: only exercises in the wall (so one dance's Today never sees the other's). */
export function picksFor(db: Db, wall: Wall, day: string): DayPick[] {
	return db
		.select({
			id: todayPicks.id,
			exerciseId: todayPicks.exerciseId,
			kind: todayPicks.kind,
			createdAt: todayPicks.createdAt
		})
		.from(todayPicks)
		.innerJoin(exercises, eq(exercises.id, todayPicks.exerciseId))
		.where(
			and(
				eq(todayPicks.userId, wall.userId),
				eq(todayPicks.day, day),
				eq(exercises.dance, wall.dance)
			)
		)
		.orderBy(todayPicks.id)
		.all();
}

/** What `addPicks` wrote: the picks it made, and the exercises whose skip for the day it took away. */
export interface Picked {
	created: number[];
	unskipped: number[];
}

/**
 * Pick exercises for a day. Refuses (`PickRefused`, nothing written) one outside
 * the wall, archived, or (for add/next) paused. One already picked as add/next
 * today gets no second pick, so a double tap makes no second row. An add/next
 * always takes the exercise's skip for the day away (also when a pick was
 * there already: Coming up's + on a skipped row brings it back); `unskipped`
 * names those. A skip keeps the add/next (the skip already hides the exercise,
 * and its Undo brings the pick back).
 */
export function addPicks(
	db: Db,
	wall: Wall,
	exerciseIds: number[],
	day: string,
	kind: PickKind,
	now: number
): Picked {
	return db.transaction((tx) => {
		const ids = [...new Set(exerciseIds)];
		const found = ids.length
			? tx.select().from(exercises).where(inArray(exercises.id, ids)).all()
			: [];
		for (const id of ids) {
			const e = found.find((f) => f.id === id);
			if (!e || !inWall(e, wall)) throw new PickRefused('No such exercise.');
			if (e.archivedAt !== null) throw new PickRefused('That exercise is archived.');
			if (kind !== 'skip' && !e.active) throw new PickRefused('That exercise is paused.');
		}
		const created: number[] = [];
		const unskipped: number[] = [];
		for (const id of ids) {
			const existing = tx
				.select()
				.from(todayPicks)
				.where(
					and(
						eq(todayPicks.userId, wall.userId),
						eq(todayPicks.day, day),
						eq(todayPicks.exerciseId, id)
					)
				)
				.all();
			if (kind !== 'skip') {
				const skips = existing.filter((p) => p.kind === 'skip');
				for (const p of skips) tx.delete(todayPicks).where(eq(todayPicks.id, p.id)).run();
				if (skips.length) unskipped.push(id);
			}
			const same = existing.some((p) =>
				kind === 'skip' ? p.kind === 'skip' : p.kind === 'add' || p.kind === 'next'
			);
			if (same) continue;
			const row = tx
				.insert(todayPicks)
				.values({ userId: wall.userId, exerciseId: id, day, kind, createdAt: now })
				.returning({ id: todayPicks.id })
				.get();
			created.push(row.id);
		}
		return { created, unskipped };
	});
}

/** Undo a pick. False when it is not this wall's (or gone already). */
export function removePick(db: Db, wall: Wall, id: number): boolean {
	const row = db
		.select({ userId: todayPicks.userId, exercise: exercises })
		.from(todayPicks)
		.innerJoin(exercises, eq(exercises.id, todayPicks.exerciseId))
		.where(eq(todayPicks.id, id))
		.get();
	if (!row || row.userId !== wall.userId || !inWall(row.exercise, wall)) return false;
	db.delete(todayPicks).where(eq(todayPicks.id, id)).run();
	return true;
}

/**
 * What `dayList` and `inLine` need for this wall's Today at `now`: its live
 * exercises, every set, today's picks and the daily number. The Today layout
 * and its `next` action read the same, so Next N takes exactly the ones after
 * what the list shows.
 */
export function dayInputOf(
	db: Db,
	wall: Wall,
	timeZone: string,
	now: number
): DayInput<ExerciseItem> {
	return {
		exercises: listExercises(db, wall),
		sets: listScheduleSets(db, wall),
		picks: picksFor(db, wall, localDay(now, timeZone)),
		daily: dailyCountOf(db, wall.userId),
		now,
		timeZone
	};
}
