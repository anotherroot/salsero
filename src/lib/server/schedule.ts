import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, sets } from './db/schema';
import type { Wall } from './scope';
import { replay, type ScheduleSet, type ScheduleState } from '$lib/schedule/schedule';

/** Every set of the wall's exercises (archived ones too), with its exercise. */
export function listScheduleSets(db: Db, wall: Wall): (ScheduleSet & { exerciseId: number })[] {
	return db
		.select({ exerciseId: sets.exerciseId, doneAt: sets.doneAt, rating: sets.rating })
		.from(sets)
		.innerJoin(exercises, eq(exercises.id, sets.exerciseId))
		.where(and(eq(exercises.dance, wall.dance), eq(exercises.userId, wall.userId)))
		.all();
}

/** The schedule of every live exercise in the wall. */
export function scheduleStates(
	db: Db,
	wall: Wall,
	timeZone: string,
	beforeDay?: string
): Map<number, ScheduleState> {
	const rows = db
		.select({ id: exercises.id, everyDays: exercises.everyDays, createdAt: exercises.createdAt })
		.from(exercises)
		.where(
			and(
				isNull(exercises.archivedAt),
				eq(exercises.dance, wall.dance),
				eq(exercises.userId, wall.userId)
			)
		)
		.all();
	const byExercise = new Map<number, ScheduleSet[]>();
	for (const s of listScheduleSets(db, wall)) {
		const list = byExercise.get(s.exerciseId) ?? [];
		list.push({ doneAt: s.doneAt, rating: s.rating });
		byExercise.set(s.exerciseId, list);
	}
	return new Map(
		rows.map((r) => [
			r.id,
			replay(r.everyDays, r.createdAt, byExercise.get(r.id) ?? [], timeZone, beforeDay)
		])
	);
}

/** One exercise's schedule, archived or not. Not owner-scoped: callers must check access first. */
export function scheduleStateOf(db: Db, exerciseId: number, timeZone: string): ScheduleState {
	const row = db.select().from(exercises).where(eq(exercises.id, exerciseId)).get();
	if (!row) throw new Error(`No exercise ${exerciseId}`);
	const rows = db
		.select({ doneAt: sets.doneAt, rating: sets.rating })
		.from(sets)
		.where(eq(sets.exerciseId, exerciseId))
		.all();
	return replay(row.everyDays, row.createdAt, rows, timeZone);
}
