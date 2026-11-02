import { and, eq, type SQL } from 'drizzle-orm';
import type { Db } from './db';
import { exercises } from './db/schema';

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
