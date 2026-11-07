import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, sets } from './db/schema';
import { ownedBy, type Wall } from './scope';
import { alias } from 'drizzle-orm/sqlite-core';
import { scheduleOf, type DueState, type ScheduleSet } from '$lib/schedule/schedule';
import { effectiveComesBack, parseComesBack } from '$lib/schedule/comes-back';

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
): Map<number, DueState> {
	const drills = alias(exercises, 'drills');
	const rows = db
		.select({
			id: exercises.id,
			source: exercises.source,
			everyDays: exercises.everyDays,
			createdAt: exercises.createdAt,
			own: exercises.comesBack,
			drill: drills.comesBack
		})
		.from(exercises)
		.leftJoin(drills, eq(drills.id, exercises.drillId))
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
			scheduleOf(
				r.everyDays,
				r.createdAt,
				byExercise.get(r.id) ?? [],
				effectiveComesBack(
					r.source,
					parseComesBack(r.own),
					r.source === 'added' ? parseComesBack(r.drill) : null
				),
				timeZone,
				beforeDay
			)
		])
	);
}

/** One exercise's schedule, archived or not. Not owner-scoped: callers must check access first. */
export function scheduleStateOf(db: Db, exerciseId: number, timeZone: string): DueState {
	const row = db.select().from(exercises).where(eq(exercises.id, exerciseId)).get();
	if (!row) throw new Error(`No exercise ${exerciseId}`);
	const teacher =
		row.source === 'added' && row.drillId !== null
			? db
					.select({ comesBack: exercises.comesBack })
					.from(exercises)
					.where(eq(exercises.id, row.drillId))
					.get()
			: undefined;
	const rows = db
		.select({ doneAt: sets.doneAt, rating: sets.rating })
		.from(sets)
		.where(eq(sets.exerciseId, exerciseId))
		.all();
	return scheduleOf(
		row.everyDays,
		row.createdAt,
		rows,
		effectiveComesBack(
			row.source,
			parseComesBack(row.comesBack),
			parseComesBack(teacher?.comesBack)
		),
		timeZone
	);
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
): Record<number, DueState> {
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
	const out: Record<number, DueState> = {};
	for (const r of rows) {
		if (r.id == null) continue;
		const own = [r.mineId, entries.get(r.id), r.id].find((x) => x != null && states.has(x));
		if (own != null) out[r.id] = states.get(own)!;
	}
	return out;
}
