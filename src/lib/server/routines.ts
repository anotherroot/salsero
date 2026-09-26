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
import { and, asc, count, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures, routineStepOptions, routineSteps, routines } from './db/schema';
import { neutralPosition } from './positions';
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

/**
 * Drizzle's transaction handle. Named this way because it is NOT a `Db` — it
 * has no `.transaction()` of its own — so `order` and `slotIds` below, each
 * called from more than one write, cannot take `Db` and cannot be inlined into
 * their callers the way a one-off transaction body is elsewhere in this file.
 */
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Write `ids` as this routine's slot order, positions 0..n-1.
 *
 * Two passes through a negative sentinel range, because
 * `unique (routine_id, position)` is checked per row: any single-pass renumber
 * can collide with a row it has not moved yet. Positions have no CHECK, so the
 * sentinels are legal rows for the duration of the transaction.
 */
function order(tx: Tx, ids: number[]): void {
	ids.forEach((id, i) =>
		tx
			.update(routineSteps)
			.set({ position: -1 - i })
			.where(eq(routineSteps.id, id))
			.run()
	);
	ids.forEach((id, i) =>
		tx.update(routineSteps).set({ position: i }).where(eq(routineSteps.id, id)).run()
	);
}

/** This routine's slot ids, in order. */
function slotIds(tx: Tx, routineId: number): number[] {
	return tx
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.where(eq(routineSteps.routineId, routineId))
		.orderBy(asc(routineSteps.position))
		.all()
		.map((s) => s.id);
}

/** Where a figure leaves the hands, with an untagged one resolved to neutral. */
function endOfFigure(db: Db, dance: DanceSlug, figureId: number): number | null {
	const row = db
		.select({ end: figures.endPositionId })
		.from(figures)
		.where(and(eq(figures.id, figureId), eq(figures.dance, dance), isNull(figures.archivedAt)))
		.get();
	if (!row) return null;
	return row.end ?? neutralPosition(db, dance)?.id ?? 0;
}

/**
 * Append a slot holding one figure. The new slot's id, or null when the figure
 * is not this routine's dance — or is archived, or gone.
 *
 * There is no way to create an EMPTY slot: a slot must hold something, and the
 * cheapest way to guarantee that is never to make one that does not.
 */
export function addFigureSlot(db: Db, routineId: number, figureId: number): number | null {
	const routine = getRoutine(db, routineId);
	if (!routine) return null;
	const dance = routine.dance as DanceSlug;
	if (endOfFigure(db, dance, figureId) === null) return null;
	return db.transaction((tx) => {
		const at = slotIds(tx, routineId).length;
		const step = tx
			.insert(routineSteps)
			.values({ routineId, position: at })
			.returning({ id: routineSteps.id })
			.get();
		tx.insert(routineStepOptions).values({ stepId: step.id, figureId }).run();
		return step.id;
	});
}

/**
 * Whether `childId` may be embedded in `parentId`.
 *
 * Both halves are needed for depth ≤ 2: the child must embed nothing, AND the
 * parent must be embedded nowhere. With both, a cycle is impossible by
 * construction, which is why there is no cycle check anywhere in this module.
 *
 * Archival is deliberately not consulted. Archiving removes the OFFER —
 * `embeddable()` filters it out — not the ability of a parent that already
 * embeds a routine to keep dancing it. A route that takes a raw child id
 * should offer only what `embeddable()` returned.
 */
export function canEmbed(db: Db, parentId: number, childId: number): boolean {
	if (parentId === childId) return false;
	const parent = getRoutine(db, parentId);
	const child = getRoutine(db, childId);
	if (!parent || !child || parent.dance !== child.dance) return false;
	const childEmbeds = db
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.where(and(eq(routineSteps.routineId, childId), isNotNull(routineSteps.childRoutineId)))
		.get();
	if (childEmbeds) return false;
	const parentEmbedded = db
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.where(eq(routineSteps.childRoutineId, parentId))
		.get();
	return !parentEmbedded;
}

/** Append a slot holding an embedded routine. Null when `canEmbed` says no. */
export function addChildSlot(db: Db, routineId: number, childId: number): number | null {
	if (!canEmbed(db, routineId, childId)) return null;
	return db.transaction((tx) => {
		const at = slotIds(tx, routineId).length;
		return tx
			.insert(routineSteps)
			.values({ routineId, position: at, childRoutineId: childId })
			.returning({ id: routineSteps.id })
			.get().id;
	});
}

/** The routines this one may embed: same dance, unarchived, and `canEmbed`. */
export function embeddable(db: Db, routineId: number): { id: number; name: string }[] {
	const routine = getRoutine(db, routineId);
	if (!routine) return [];
	return db
		.select({ id: routines.id, name: routines.name })
		.from(routines)
		.where(and(eq(routines.dance, routine.dance), isNull(routines.archivedAt)))
		.orderBy(asc(routines.name))
		.all()
		.filter((r) => canEmbed(db, routineId, r.id));
}

/**
 * Add an interchangeable figure to a slot.
 *
 * False when the figure is the wrong dance, when the slot holds an embedded
 * routine instead, or when it would land somewhere the slot's other options do
 * not: options that end differently are not variants of each other, they are
 * different steps.
 */
export function addOption(db: Db, stepId: number, figureId: number): boolean {
	const step = db
		.select({ routineId: routineSteps.routineId, childId: routineSteps.childRoutineId })
		.from(routineSteps)
		.where(eq(routineSteps.id, stepId))
		.get();
	if (!step || step.childId !== null) return false;
	const routine = getRoutine(db, step.routineId);
	if (!routine) return false;
	const dance = routine.dance as DanceSlug;
	const end = endOfFigure(db, dance, figureId);
	if (end === null) return false;
	const existing = db
		.select({ figureId: routineStepOptions.figureId })
		.from(routineStepOptions)
		.where(eq(routineStepOptions.stepId, stepId))
		.all();
	for (const o of existing) {
		if (o.figureId === figureId) return true;
		if (endOfFigure(db, dance, o.figureId) !== end) return false;
	}
	db.insert(routineStepOptions).values({ stepId, figureId }).run();
	return true;
}

/** Drop an option. False when it would leave the slot empty. */
export function removeOption(db: Db, stepId: number, figureId: number): boolean {
	return db.transaction((tx) => {
		const all = tx
			.select({ figureId: routineStepOptions.figureId })
			.from(routineStepOptions)
			.where(eq(routineStepOptions.stepId, stepId))
			.all();
		if (all.length <= 1 || !all.some((o) => o.figureId === figureId)) return false;
		tx.delete(routineStepOptions)
			.where(and(eq(routineStepOptions.stepId, stepId), eq(routineStepOptions.figureId, figureId)))
			.run();
		return true;
	});
}

export function setSlotNote(db: Db, stepId: number, note: string | null): boolean {
	return db.update(routineSteps).set({ note }).where(eq(routineSteps.id, stepId)).run().changes > 0;
}

/**
 * Hard-delete a slot and its options, then renumber.
 *
 * A slot is structure, not an entity — nothing points at it, no set refers to
 * it, and there is no history in it to keep. `routineId` is passed so a slot
 * can only be deleted through the routine it belongs to.
 */
export function deleteSlot(db: Db, routineId: number, stepId: number): boolean {
	return db.transaction((tx) => {
		// Confirm the slot is this routine's BEFORE deleting anything, then take the
		// options first: `routine_step_options.step_id` references `routine_steps.id`
		// and `openDb` sets `foreign_keys = ON`, so deleting the step first would
		// abort on its own children.
		const step = tx
			.select({ id: routineSteps.id })
			.from(routineSteps)
			.where(and(eq(routineSteps.id, stepId), eq(routineSteps.routineId, routineId)))
			.get();
		if (!step) return false;
		tx.delete(routineStepOptions).where(eq(routineStepOptions.stepId, stepId)).run();
		tx.delete(routineSteps).where(eq(routineSteps.id, stepId)).run();
		order(tx, slotIds(tx, routineId));
		return true;
	});
}

/** Swap a slot with its neighbour. `delta` is -1 or 1. */
export function moveSlot(db: Db, routineId: number, stepId: number, delta: -1 | 1): boolean {
	return db.transaction((tx) => {
		const ids = slotIds(tx, routineId);
		const i = ids.indexOf(stepId);
		const j = i + delta;
		if (i < 0 || j < 0 || j >= ids.length) return false;
		[ids[i], ids[j]] = [ids[j], ids[i]];
		order(tx, ids);
		return true;
	});
}
