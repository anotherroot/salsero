/**
 * Routines: the rows, the exercise that comes with one, and the shape the pure
 * layer reads.
 *
 * A routine is an ordered list of slots. Each slot holds either interchangeable
 * figures — the alternatives — or one embedded routine. The rules that a database
 * cannot express live here: exactly one of those two per slot, one shared end
 * and next count across a slot's options, one level of embedding, and the three cross-dance
 * invariants (a slot's figures, a child routine, and a routine's own dance).
 *
 * `src/lib/routines/` does the thinking about shapes; this module only feeds it
 * and writes the answers back.
 */
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures, routineStepOptions, routineSteps, routines } from './db/schema';
import { buildGraph } from './graph';
import { endOf, figureById, nextCountOf, startsOf, type Graph } from '$lib/graph/graph';
import type { DanceSlug } from '$lib/dances/dances';
import type { OptionsSlot, RoutineShape, Slot } from '$lib/routines/routines';
import type { SlotSnapshot } from '$lib/routines/snapshot';
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

/**
 * A slot's options, main figure first: the order they were added in.
 *
 * The first option added is the slot's MAIN figure — the one the editor shows
 * on the card, with the others hung under it as alternatives. `created_at` is
 * epoch ms, so two options added in one transaction (every copy path) tie;
 * `rowid` breaks the tie in insertion order, which is why every path that
 * copies options inserts them in THIS order.
 */
const MAIN_FIRST = [asc(routineStepOptions.createdAt), sql`routine_step_options.rowid`];

export interface RoutineInput {
	name: string;
	notes: string | null;
}
/**
 * The routine row and its exercise, inside a caller's transaction.
 *
 * `source: 'routine'` and `routineId` are set as a pair. There is no CHECK
 * pairing them (see `schema.ts`); this function is the enforcement, and it is
 * the only thing that ever writes `exercises.routine_id`.
 */
function insertRoutine(tx: Tx, dance: DanceSlug, input: RoutineInput, everyDays: number) {
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
}

/**
 * Create a routine and its exercise together — the rule lessons follow too —
 * so a routine appears in Today without a second step.
 */
export function createRoutine(db: Db, dance: DanceSlug, input: RoutineInput, everyDays = 3) {
	return db.transaction((tx) => insertRoutine(tx, dance, input, everyDays));
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
			childRoutineId: routineSteps.childRoutineId,
			note: routineSteps.note
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
		.orderBy(...MAIN_FIRST)
		.all();

	const byStep = groupByStep(options);

	// A routine's own option slots, in order. Embedding is one level, so a
	// routine that IS embedded has none of its own children to worry about and
	// this is its whole shape.
	const own = new Map<number, OptionsSlot[]>();
	for (const s of steps) {
		if (s.childRoutineId !== null) continue;
		const list = own.get(s.routineId) ?? [];
		list.push({ kind: 'options', figureIds: byStep.get(s.id) ?? [], note: s.note });
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
				? { kind: 'options', figureIds: byStep.get(s.id) ?? [], note: s.note }
				: {
						kind: 'child',
						routineId: s.childRoutineId,
						slots: own.get(s.childRoutineId) ?? [],
						note: s.note
					};
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
					.orderBy(...MAIN_FIRST)
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

/** These steps' options, main figure first, grouped by step. */
function optionsIn(tx: Tx, stepIds: number[]): Map<number, number[]> {
	if (stepIds.length === 0) return new Map();
	return groupByStep(
		tx
			.select({ stepId: routineStepOptions.stepId, figureId: routineStepOptions.figureId })
			.from(routineStepOptions)
			.where(inArray(routineStepOptions.stepId, stepIds))
			.orderBy(...MAIN_FIRST)
			.all()
	);
}

/**
 * Where a figure — or a variation — begins and lands: its start positions and
 * start count, the position it leaves the hands at and the count it leaves the
 * next figure on. Read off the graph, which fills a variation's unset fields
 * from its figure and resolves untagged to neutral; reading the row directly
 * would see a variation's nulls. Null when the figure is not in this dance's
 * graph — another dance, archived, or gone.
 */
function landingIn(
	g: Graph,
	figureId: number
): { starts: number[]; start: number; end: number; next: number } | null {
	const f = figureById(g, figureId);
	return f
		? { starts: startsOf(g, f), start: f.start, end: endOf(g, f), next: nextCountOf(f) }
		: null;
}

/** What a new slot holds: one figure (its main figure), or one embedded routine. */
export type SlotContent = { figureId: number } | { childId: number };

/**
 * Insert a slot at index `at`. The new slot's id, or null when the figure is not
 * this routine's dance (or is archived, or gone), or the routine cannot be
 * embedded here.
 *
 * `at` is CLAMPED to `0..length` rather than refused: the picker that sent it
 * may have been opened before another tab removed slots, and appending is what
 * the person meant. There is no way to create an EMPTY slot: a slot must hold
 * something, and the cheapest way to guarantee that is never to make one that
 * does not.
 */
export function insertSlot(
	db: Db,
	routineId: number,
	at: number,
	content: SlotContent
): number | null {
	const routine = getRoutine(db, routineId);
	if (!routine) return null;
	if ('childId' in content) {
		if (!canEmbed(db, routineId, content.childId)) return null;
	} else if (landingIn(buildGraph(db, routine.dance as DanceSlug), content.figureId) === null) {
		return null;
	}
	return db.transaction((tx) => {
		const ids = slotIds(tx, routineId);
		// Appended first, then the whole routine re-ordered with it spliced in:
		// inserting at `at` directly would collide with `unique (routine_id,
		// position)` before anything shifted out of the way.
		const step = tx
			.insert(routineSteps)
			.values({
				routineId,
				position: ids.length,
				childRoutineId: 'childId' in content ? content.childId : null
			})
			.returning({ id: routineSteps.id })
			.get();
		if ('figureId' in content) {
			tx.insert(routineStepOptions).values({ stepId: step.id, figureId: content.figureId }).run();
		}
		ids.splice(Math.min(Math.max(at, 0), ids.length), 0, step.id);
		order(tx, ids);
		return step.id;
	});
}

/** Append a slot holding one figure. See `insertSlot`. */
export function addFigureSlot(db: Db, routineId: number, figureId: number): number | null {
	return insertSlot(db, routineId, Number.MAX_SAFE_INTEGER, { figureId });
}

/** Append a slot holding an embedded routine. Null when `canEmbed` says no. */
export function addChildSlot(db: Db, routineId: number, childId: number): number | null {
	return insertSlot(db, routineId, Number.MAX_SAFE_INTEGER, { childId });
}

/**
 * A new routine with one slot per figure or variation, in the given order —
 * the coverage page's "Create routine". The user puts the slots in order on
 * the routine page afterwards.
 *
 * All or nothing: null, with nothing written, for an empty list or any id
 * that is not an unarchived figure or variation of this dance.
 */
export function createRoutineFromFigures(
	db: Db,
	dance: DanceSlug,
	input: RoutineInput,
	figureIds: number[],
	everyDays = 3
) {
	if (figureIds.length === 0) return null;
	const graph = buildGraph(db, dance);
	if (figureIds.some((id) => landingIn(graph, id) === null)) return null;
	return db.transaction((tx) => {
		const made = insertRoutine(tx, dance, input, everyDays);
		figureIds.forEach((figureId, position) => {
			const step = tx
				.insert(routineSteps)
				.values({ routineId: made.routine.id, position })
				.returning({ id: routineSteps.id })
				.get();
			tx.insert(routineStepOptions).values({ stepId: step.id, figureId }).run();
		});
		return made;
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
 * not: options that land differently — in the hands or on the count — are not
 * alternatives to each other, they are different steps. …and, against the
 * slot's main figure, when it begins on another count or from no hold the
 * main figure begins from.
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
	const g = buildGraph(db, dance);
	const landing = landingIn(g, figureId);
	if (landing === null) return false;
	const existing = db
		.select({ figureId: routineStepOptions.figureId })
		.from(routineStepOptions)
		.where(eq(routineStepOptions.stepId, stepId))
		.orderBy(...MAIN_FIRST)
		.all();
	// Idempotent on purpose: (step_id, figure_id) is a composite primary key, so
	// falling through to the insert would throw rather than refuse.
	if (existing.some((o) => o.figureId === figureId)) return true;
	for (const o of existing) {
		const other = landingIn(g, o.figureId);
		if (other === null || other.end !== landing.end || other.next !== landing.next) return false;
	}
	// The start rule, judged against the MAIN figure only: an alternative that
	// begins on another count, or from no hold the main figure begins from, can
	// never be danced where the main one is. Older slots that predate this rule
	// are left as they are — it governs adding, it is not a migration.
	const main = existing.length > 0 ? landingIn(g, existing[0].figureId) : null;
	if (
		main &&
		(main.start !== landing.start || !main.starts.some((p) => landing.starts.includes(p)))
	) {
		return false;
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

/**
 * Undo for a removed alternative: put it straight back.
 *
 * Checks the dance only, not the alternative rules. It was in the slot a
 * moment ago, and `addOption` would refuse an older alternative that predates
 * the start rule — an undo that cannot undo. It comes back as the newest
 * option, which cannot change the main figure: the main figure is never
 * removed on its own (removing it removes the slot).
 */
export function restoreOption(db: Db, stepId: number, figureId: number): boolean {
	const step = db
		.select({ routineId: routineSteps.routineId, childId: routineSteps.childRoutineId })
		.from(routineSteps)
		.where(eq(routineSteps.id, stepId))
		.get();
	if (!step || step.childId !== null) return false;
	const routine = getRoutine(db, step.routineId);
	const figure = db
		.select({ dance: figures.dance })
		.from(figures)
		.where(eq(figures.id, figureId))
		.get();
	if (!routine || !figure || figure.dance !== routine.dance) return false;
	db.insert(routineStepOptions).values({ stepId, figureId }).onConflictDoNothing().run();
	return true;
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

/**
 * Hard-delete several slots and renumber, returning what was removed so the
 * editor can offer Undo. All or nothing: null, with nothing deleted, when any
 * id is not this routine's — a stale tab or a double tap must not delete half
 * of what it asked for.
 */
export function deleteSlots(db: Db, routineId: number, stepIds: number[]): SlotSnapshot[] | null {
	const wanted = [...new Set(stepIds)];
	if (wanted.length === 0) return null;
	return db.transaction((tx) => {
		const steps = tx
			.select({
				id: routineSteps.id,
				position: routineSteps.position,
				childId: routineSteps.childRoutineId,
				note: routineSteps.note
			})
			.from(routineSteps)
			.where(and(eq(routineSteps.routineId, routineId), inArray(routineSteps.id, wanted)))
			.orderBy(asc(routineSteps.position))
			.all();
		if (steps.length !== wanted.length) return null;
		const options = optionsIn(tx, wanted);
		const snapshot = steps.map((s) => ({
			position: s.position,
			childId: s.childId,
			note: s.note,
			figureIds: options.get(s.id) ?? []
		}));
		// Options first: `routine_step_options.step_id` references the step and
		// `foreign_keys = ON`, so the step cannot go while its options remain.
		tx.delete(routineStepOptions).where(inArray(routineStepOptions.stepId, wanted)).run();
		tx.delete(routineSteps).where(inArray(routineSteps.id, wanted)).run();
		order(tx, slotIds(tx, routineId));
		return snapshot;
	});
}

/**
 * Undo for `deleteSlots`: re-insert each slot at the position it was deleted
 * from, lowest first — which is what makes a multi-slot undo land exactly where
 * the slots were. A position past the end (the routine shrank since) appends.
 *
 * A figure only has to still be this dance's, archived or not: the slot held it
 * a moment ago, and an undo that refused an archived figure would lose the
 * slot. A child must still be embeddable, because the one-level rule is a
 * structural guarantee, not a preference. All or nothing.
 */
export function restoreSlots(db: Db, routineId: number, snapshot: SlotSnapshot[]): boolean {
	const routine = getRoutine(db, routineId);
	if (!routine || snapshot.length === 0) return false;
	const figureIds = [...new Set(snapshot.flatMap((s) => s.figureIds))];
	if (figureIds.length > 0) {
		const ours = db
			.select({ id: figures.id })
			.from(figures)
			.where(and(inArray(figures.id, figureIds), eq(figures.dance, routine.dance)))
			.all();
		if (ours.length !== figureIds.length) return false;
	}
	if (snapshot.some((s) => s.childId !== null && !canEmbed(db, routineId, s.childId))) {
		return false;
	}
	return db.transaction((tx) => {
		for (const s of [...snapshot].sort((a, b) => a.position - b.position)) {
			const ids = slotIds(tx, routineId);
			const step = tx
				.insert(routineSteps)
				.values({ routineId, position: ids.length, childRoutineId: s.childId, note: s.note })
				.returning({ id: routineSteps.id })
				.get();
			for (const figureId of s.figureIds) {
				tx.insert(routineStepOptions).values({ stepId: step.id, figureId }).run();
			}
			ids.splice(Math.min(s.position, ids.length), 0, step.id);
			order(tx, ids);
		}
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

/**
 * Move a slot to `index` — where a drag dropped it. False when the slot is not
 * this routine's or the index is off either end; a drop is always inside the
 * list, so an index outside it is a stale or tampered request.
 */
export function moveSlotTo(db: Db, routineId: number, stepId: number, index: number): boolean {
	return db.transaction((tx) => {
		const ids = slotIds(tx, routineId);
		const from = ids.indexOf(stepId);
		if (from < 0 || !Number.isInteger(index) || index < 0 || index >= ids.length) return false;
		ids.splice(from, 1);
		ids.splice(index, 0, stepId);
		order(tx, ids);
		return true;
	});
}

/**
 * Insert a copy of a slot directly after it. The new slot's id, or null when the
 * slot is not this routine's.
 *
 * Directly after, not appended: a duplicate is for a step that repeats, and a
 * repeat belongs next to what it repeats. Everything about the slot comes with
 * it — its options, its note, and an embedded child as a reference rather than a
 * copy of that child.
 */
export function duplicateSlot(db: Db, routineId: number, stepId: number): number | null {
	return db.transaction((tx) => {
		const step = tx
			.select({
				id: routineSteps.id,
				childRoutineId: routineSteps.childRoutineId,
				note: routineSteps.note
			})
			.from(routineSteps)
			.where(and(eq(routineSteps.id, stepId), eq(routineSteps.routineId, routineId)))
			.get();
		if (!step) return null;

		// Appended first, then the whole routine is re-ordered with the copy spliced
		// in after its original. Inserting at the target position directly would
		// collide with `unique (routine_id, position)` before anything shifted out
		// of the way — the same reason `order` exists at all.
		const copy = tx
			.insert(routineSteps)
			.values({
				routineId,
				position: slotIds(tx, routineId).length,
				childRoutineId: step.childRoutineId,
				note: step.note
			})
			.returning({ id: routineSteps.id })
			.get();

		const options = tx
			.select({ figureId: routineStepOptions.figureId })
			.from(routineStepOptions)
			.where(eq(routineStepOptions.stepId, stepId))
			.orderBy(...MAIN_FIRST)
			.all();
		for (const o of options) {
			tx.insert(routineStepOptions).values({ stepId: copy.id, figureId: o.figureId }).run();
		}

		const ids = slotIds(tx, routineId).filter((id) => id !== copy.id);
		ids.splice(ids.indexOf(stepId) + 1, 0, copy.id);
		order(tx, ids);
		return copy.id;
	});
}

/**
 * Copy a whole routine, slots and all, as "<name> (copy)" with its own exercise.
 *
 * An embedded child is REFERENCED by the copy, not itself duplicated: a routine
 * embedded in two places is one routine seen twice, and copying it would fork it
 * silently so that editing the original stopped changing the copy. That also
 * keeps the one-level embedding rule intact without a second check — the copy
 * embeds exactly what the source embedded, and the source was already legal.
 */
export function duplicateRoutine(db: Db, id: number) {
	const source = getRoutine(db, id);
	if (!source) return null;
	const dance = source.dance as DanceSlug;
	const slots = routineSlots(db, id);

	return db.transaction((tx) => {
		const routine = tx
			.insert(routines)
			.values({ dance, name: `${source.name} (copy)`, notes: source.notes })
			.returning()
			.get();
		tx.insert(exercises)
			.values({
				name: routine.name,
				source: 'routine',
				routineId: routine.id,
				dance,
				everyDays: 3
			})
			.run();

		for (const slot of slots) {
			const step = tx
				.insert(routineSteps)
				.values({
					routineId: routine.id,
					position: slot.position,
					childRoutineId: slot.childId,
					note: slot.note
				})
				.returning({ id: routineSteps.id })
				.get();
			for (const figureId of slot.figureIds) {
				tx.insert(routineStepOptions).values({ stepId: step.id, figureId }).run();
			}
		}
		return routine;
	});
}
