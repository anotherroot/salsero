import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, sets } from './db/schema';
import { ownedBy, type Wall } from './scope';
import { alias } from 'drizzle-orm/sqlite-core';
import {
	doneFaces,
	goodDaysSince,
	scheduleOf,
	type DoneFace,
	type DoneInput,
	type DueState,
	type ScheduleSet
} from '$lib/schedule/schedule';
import { effectiveComesBack, parseComesBack } from '$lib/schedule/comes-back';

/** Every set of the wall's exercises (archived ones too), with its exercise. */
export function listScheduleSets(
	db: Db,
	wall: Wall
): (ScheduleSet & { exerciseId: number; durationS: number | null })[] {
	return db
		.select({
			exerciseId: sets.exerciseId,
			doneAt: sets.doneAt,
			rating: sets.rating,
			durationS: sets.durationS
		})
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
					parseComesBack(r.own),
					r.source === 'added' ? parseComesBack(r.drill) : null
				),
				timeZone,
				beforeDay
			)
		])
	);
}

/** The inputs a schedule is replayed from: the row, its sets and the rule it follows. */
function scheduleInputsOf(db: Db, exerciseId: number): DoneInput {
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
	return {
		startGap: row.everyDays,
		createdAt: row.createdAt,
		sets: rows,
		comesBack: effectiveComesBack(parseComesBack(row.comesBack), parseComesBack(teacher?.comesBack))
	};
}

/** One exercise's schedule, archived or not. Not owner-scoped: callers must check access first. */
export function scheduleStateOf(db: Db, exerciseId: number, timeZone: string): DueState {
	const i = scheduleInputsOf(db, exerciseId);
	return scheduleOf(i.startGap, i.createdAt, i.sets, i.comesBack, timeZone);
}

/**
 * What each face would set if saved now (`doneFaces`), from the same inputs
 * `scheduleStateOf` reads. Not owner-scoped: check access first.
 */
export function doneFacesOf(
	db: Db,
	exerciseId: number,
	timeZone: string,
	now: number
): DoneFace[] | null {
	return doneFaces(scheduleInputsOf(db, exerciseId), now, timeZone);
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

/** The good days since `since` on one exercise's sets (the Comes back card's "2 of 3 so far"). Not owner-scoped: check access first. */
export function goodDaysOf(db: Db, exerciseId: number, since: number, timeZone: string): number {
	const rows = db
		.select({ doneAt: sets.doneAt, rating: sets.rating })
		.from(sets)
		.where(eq(sets.exerciseId, exerciseId))
		.all();
	return goodDaysSince(rows, since, timeZone);
}
