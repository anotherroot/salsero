import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, sets } from './db/schema';
import { ownedBy, type Wall } from './scope';
import { replay, type ScheduleSet, type ScheduleState } from '$lib/schedule/schedule';

/** Every set of the wall's exercises (archived ones too), with its exercise. */
export function listScheduleSets(db: Db, wall: Wall): (ScheduleSet & { exerciseId: number })[] {
	return db
		.select({ exerciseId: sets.exerciseId, doneAt: sets.doneAt, rating: sets.rating })
		.from(sets)
		.innerJoin(exercises, eq(exercises.id, sets.exerciseId))
		.where(ownedBy(exercises, wall))
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
		.where(and(isNull(exercises.archivedAt), ownedBy(exercises, wall)))
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

/** One exercise's schedule, archived or not. */
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

/**
 * The person's schedule for each exercise a page shows a due word for, keyed by
 * the SHOWN id. The person's own row wins: a copy (`mineId`), else their entry
 * on a group drill (`drillId`), else the row itself when it is theirs. A row
 * they have nothing of gets no key, so no due word.
 */
export function scheduleForShown(
	db: Db,
	wall: Wall,
	timeZone: string,
	rows: { id: number | null | undefined; mineId?: number | null }[]
): Record<number, ScheduleState> {
	const states = scheduleStates(db, wall, timeZone);
	const entries = new Map(
		db
			.select({ id: exercises.id, drillId: exercises.drillId })
			.from(exercises)
			.where(and(isNull(exercises.archivedAt), ownedBy(exercises, wall)))
			.all()
			.filter((e) => e.drillId !== null)
			.map((e) => [e.drillId as number, e.id])
	);
	const out: Record<number, ScheduleState> = {};
	for (const r of rows) {
		if (r.id == null) continue;
		const own = [r.mineId, entries.get(r.id), r.id].find((x) => x != null && states.has(x));
		if (own != null) out[r.id] = states.get(own)!;
	}
	return out;
}
