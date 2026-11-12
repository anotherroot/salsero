/**
 * A routine becomes a section (spec 2026-11-12, routine sections, page 8).
 *
 * Apart from `routines.ts` because it unlinks lessons through `lessons.ts`,
 * which itself reads routines: one module each way, no import cycle.
 */
import { and, eq, inArray, isNull, count } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	lessonRoutines,
	lessons,
	routineSteps,
	routines,
	sets,
	teams
} from './db/schema';
import { getRoutine } from './routines';
import { unlinkRoutine } from './lessons';
import { actingIn, logChange } from './changes';
import { serverNow } from './server-clock';

export interface DemoteImpact {
	/** The real routines that hold it, at any depth, each once, by name. */
	routines: { id: number; name: string }[];
	lessons: { id: number; title: string }[];
	/** Days its exercise was practised. */
	practised: number;
	/** The group it belongs to, when it is a group's. */
	team: string | null;
}

/** Real (not section) live routines holding `id` anywhere above it. */
export function routinesHolding(db: Db, id: number): { id: number; name: string }[] {
	const seen = new Set<number>([id]);
	const out = new Map<number, string>();
	let frontier = [id];
	while (frontier.length > 0) {
		const parents = db
			.selectDistinct({ id: routines.id, name: routines.name, isSection: routines.isSection })
			.from(routineSteps)
			.innerJoin(routines, eq(routines.id, routineSteps.routineId))
			.where(and(inArray(routineSteps.childRoutineId, frontier), isNull(routines.archivedAt)))
			.all();
		frontier = [];
		for (const p of parents) {
			if (seen.has(p.id)) continue;
			seen.add(p.id);
			frontier.push(p.id);
			if (p.isSection === 0) out.set(p.id, p.name);
		}
	}
	return [...out]
		.map(([rid, name]) => ({ id: rid, name }))
		.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

export function demoteImpact(db: Db, routineId: number): DemoteImpact {
	const routine = getRoutine(db, routineId);
	if (!routine) return { routines: [], lessons: [], practised: 0, team: null };
	const linked = db
		.select({ id: lessons.id, title: lessons.title })
		.from(lessonRoutines)
		.innerJoin(lessons, eq(lessons.id, lessonRoutines.lessonId))
		.where(and(eq(lessonRoutines.routineId, routineId), isNull(lessons.archivedAt)))
		.all();
	const practised =
		db
			.select({ n: count(sets.id) })
			.from(sets)
			.innerJoin(exercises, eq(exercises.id, sets.exerciseId))
			.where(eq(exercises.routineId, routineId))
			.get()?.n ?? 0;
	const team =
		routine.teamId === null
			? null
			: (db.select({ name: teams.name }).from(teams).where(eq(teams.id, routine.teamId)).get()
					?.name ?? null);
	return { routines: routinesHolding(db, routineId), lessons: linked, practised, team };
}

/**
 * Turn into a section: refused for a routine no routine uses (it would be a
 * section nothing holds). Its exercise is archived with its history kept, so it
 * leaves Today; lessons lose the link (each unlink logged as today). A member's
 * own copy is a row of their own and stays a routine.
 */
export function demoteRoutine(db: Db, routineId: number, by?: string, now = serverNow()): boolean {
	const routine = getRoutine(db, routineId);
	if (!routine || routine.isSection === 1) return false;
	const impact = demoteImpact(db, routineId);
	if (impact.routines.length === 0) return false;
	const space = actingIn(routine, by);
	return db.transaction((tx) => {
		for (const l of impact.lessons) unlinkRoutine(tx, l.id, routineId, now, by);
		tx.update(routines).set({ isSection: 1 }).where(eq(routines.id, routineId)).run();
		tx.update(exercises)
			.set({ archivedAt: now })
			.where(and(eq(exercises.routineId, routineId), isNull(exercises.archivedAt)))
			.run();
		logChange(
			tx,
			space,
			{
				verb: 'change',
				subject: 'demote',
				rootKind: 'routine',
				rootId: routineId,
				subjectId: routineId,
				before: { section: 0 },
				after: { section: 1 }
			},
			now
		);
		return true;
	});
}
