/**
 * Routines: the rows, the exercise that comes with one, and the shape the pure
 * layer reads.
 *
 * A routine is an ordered list of slots. Each slot holds either interchangeable
 * figures — the variants — or one embedded routine. The rules that a database
 * cannot express live here: exactly one of those two per slot, one shared end
 * across a slot's options, one level of embedding, and the three cross-dance
 * invariants (a slot's figures, a child routine, and a routine's own dance).
 *
 * `src/lib/routines/` does the thinking about shapes; this module only feeds it
 * and writes the answers back.
 */
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, routineStepOptions, routineSteps, routines } from './db/schema';
import type { DanceSlug } from '$lib/dances/dances';
import type { OptionsSlot, RoutineShape, Slot } from '$lib/routines/routines';
import type { RoutineItem, SlotRow } from '$lib/types';

/** `{stepId, figureId}` rows grouped by step, preserving the query's order. */
function groupByStep(rows: { stepId: number; figureId: number }[]): Map<number, number[]> {
	const byStep = new Map<number, number[]>();
	for (const row of rows) {
		const list = byStep.get(row.stepId);
		if (list) list.push(row.figureId);
		else byStep.set(row.stepId, [row.figureId]);
	}
	return byStep;
}

export interface RoutineInput {
	name: string;
	notes: string | null;
}

/**
 * Create a routine and its exercise together — the rule figures and lessons
 * already follow, so a routine appears in Today without a second step.
 *
 * `source: 'routine'` and `routineId` are set as a pair. There is no CHECK
 * pairing them (see `schema.ts`); this function is the enforcement, and it is
 * the only thing that ever writes `exercises.routine_id`.
 */
export function createRoutine(db: Db, dance: DanceSlug, input: RoutineInput, everyDays = 3) {
	return db.transaction((tx) => {
		const routine = tx
			.insert(routines)
			.values({ ...input, dance })
			.returning()
			.get();
		const exercise = tx
			.insert(exercises)
			.values({
				name: routine.name,
				source: 'routine',
				routineId: routine.id,
				dance,
				everyDays
			})
			.returning()
			.get();
		return { routine, exercise };
	});
}

/** Edit a routine. A rename carries over to its exercise so the two never drift. */
export function updateRoutine(db: Db, id: number, input: RoutineInput) {
	return db.transaction((tx) => {
		const routine = tx.update(routines).set(input).where(eq(routines.id, id)).returning().get();
		if (!routine) return null;
		tx.update(exercises).set({ name: routine.name }).where(eq(exercises.routineId, id)).run();
		return routine;
	});
}

/**
 * Archive a routine and its exercise together. Slots, options and sets stay.
 *
 * A routine embedded in another is archived all the same: the parent keeps
 * dancing it, the way a figure tagged with an archived position keeps its tag.
 * What archiving removes is the offer — the library list and the embed picker.
 */
export function archiveRoutine(db: Db, id: number, now: number): boolean {
	return db.transaction((tx) => {
		const res = tx
			.update(routines)
			.set({ archivedAt: now })
			.where(and(eq(routines.id, id), isNull(routines.archivedAt)))
			.run();
		if (res.changes === 0) return false;
		tx.update(exercises).set({ archivedAt: now }).where(eq(exercises.routineId, id)).run();
		return true;
	});
}

export function getRoutine(db: Db, id: number) {
	return db.select().from(routines).where(eq(routines.id, id)).get() ?? null;
}

/** The library: newest first, with how many slots each holds. */
export function listRoutines(db: Db, dance: DanceSlug): RoutineItem[] {
	return db
		.select({
			id: routines.id,
			name: routines.name,
			notes: routines.notes,
			slots: count(routineSteps.id),
			createdAt: routines.createdAt
		})
		.from(routines)
		.leftJoin(routineSteps, eq(routineSteps.routineId, routines.id))
		.where(and(eq(routines.dance, dance), isNull(routines.archivedAt)))
		.groupBy(routines.id)
		.orderBy(desc(routines.createdAt), desc(routines.id))
		.all();
}

/**
 * Every routine of this dance as a pure shape, embedded children spliced in.
 *
 * The whole dance in three queries rather than three per routine: the library
 * list derives "does not loop" and "has breaks" for every row, and each of
 * those needs a full shape. The detail page reads its own routine out of the
 * same map, so there is exactly one implementation of "what shape is this".
 *
 * Archived routines are included. A shape is a reading, and the list decides
 * separately what it offers.
 */
export function routineShapes(db: Db, dance: DanceSlug): Map<number, RoutineShape> {
	// Three dance filters follow, and only one of them can change the result today.
	//
	// The one on the routines query below decides which ids become keys, so it is
	// what keeps another dance's routines out of this map — and the dance-wall test
	// covers it. The one here on the steps query is observable ONLY through a step
	// whose `child_routine_id` names a routine of the other dance, which
	// `addChildSlot` refuses; it is the backstop for a hand-edited row. The one on
	// the options query cannot change anything at all: `byStep` is read by step id,
	// and a leaked row sits under a key no same-dance step will ever match. Both are
	// kept deliberately — they cost one clause each and they fail safe.
	const steps = db
		.select({
			id: routineSteps.id,
			routineId: routineSteps.routineId,
			childRoutineId: routineSteps.childRoutineId
		})
		.from(routineSteps)
		.innerJoin(routines, eq(routines.id, routineSteps.routineId))
		.where(eq(routines.dance, dance))
		.orderBy(asc(routineSteps.routineId), asc(routineSteps.position))
		.all();

	const options = db
		.select({ stepId: routineStepOptions.stepId, figureId: routineStepOptions.figureId })
		.from(routineStepOptions)
		.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
		.innerJoin(routines, eq(routines.id, routineSteps.routineId))
		.where(eq(routines.dance, dance))
		.orderBy(asc(routineStepOptions.figureId))
		.all();

	const byStep = groupByStep(options);

	// A routine's own option slots, in order. Embedding is one level, so a
	// routine that IS embedded has none of its own children to worry about and
	// this is its whole shape.
	const own = new Map<number, OptionsSlot[]>();
	for (const s of steps) {
		if (s.childRoutineId !== null) continue;
		const list = own.get(s.routineId) ?? [];
		list.push({ kind: 'options', figureIds: byStep.get(s.id) ?? [] });
		own.set(s.routineId, list);
	}

	const out = new Map<number, RoutineShape>();
	for (const r of db
		.select({ id: routines.id })
		.from(routines)
		.where(eq(routines.dance, dance))
		.all()) {
		out.set(r.id, { slots: [] });
	}
	for (const s of steps) {
		const slot: Slot =
			s.childRoutineId === null
				? { kind: 'options', figureIds: byStep.get(s.id) ?? [] }
				: { kind: 'child', routineId: s.childRoutineId, slots: own.get(s.childRoutineId) ?? [] };
		out.get(s.routineId)?.slots.push(slot);
	}
	return out;
}

/** One routine's slots as the editor needs them: ids, notes, and the child's name. */
export function routineSlots(db: Db, routineId: number): SlotRow[] {
	const child = db
		.select({ id: routines.id, name: routines.name })
		.from(routines)
		.all()
		.reduce((m, r) => m.set(r.id, r.name), new Map<number, string>());

	const steps = db
		.select({
			id: routineSteps.id,
			position: routineSteps.position,
			note: routineSteps.note,
			childId: routineSteps.childRoutineId
		})
		.from(routineSteps)
		.where(eq(routineSteps.routineId, routineId))
		.orderBy(asc(routineSteps.position))
		.all();

	const ids = steps.map((s) => s.id);
	const options =
		ids.length === 0
			? []
			: db
					.select({ stepId: routineStepOptions.stepId, figureId: routineStepOptions.figureId })
					.from(routineStepOptions)
					.where(inArray(routineStepOptions.stepId, ids))
					.orderBy(asc(routineStepOptions.figureId))
					.all();

	const byStep = groupByStep(options);

	return steps.map((s) => ({
		...s,
		childName: s.childId === null ? null : (child.get(s.childId) ?? null),
		figureIds: byStep.get(s.id) ?? []
	}));
}
