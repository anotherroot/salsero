/**
 * Routines: the rows, the exercise that comes with one, and the shape the pure
 * layer reads.
 *
 * A routine is an ordered list of slots. Each slot holds either interchangeable
 * figures — the alternatives — or one embedded routine. The rules that a database
 * cannot express live here: exactly one of those two per slot, one shared end
 * and next count across a slot's options, one level of embedding, and the three cross-dance
 * invariants (a slot's figures, a child routine, and a routine's own dance).
 * A person's routine may also hold the group figures and routines they may use
 * (`usableOf`, `mayHold`); a group's routine holds only its group's rows.
 *
 * `src/lib/routines/` does the thinking about shapes; this module only feeds it
 * and writes the answers back.
 */
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	figures,
	routineStepOptions,
	routineSteps,
	routines,
	type Exercise,
	type Routine
} from './db/schema';
import { graphFor } from './graph';
import { t } from '$lib/i18n/catalog';
import { ownedOrUsable, teamRefs, usableOf, type Usable } from './usable';
import { withoutShadowed } from './clones/shadow';
import { addedReach, addedTeams } from './access';
import { reconcileEntries, reviveEntries } from './entries';
import type { ArchiveRestore } from './trash';
import { actingIn, fieldChange, logChange, type ChangeEntry } from './changes';
import { inSpace, isTeam, ownedBy, ownerValues, spaceOfRow, type Space, type Wall } from './scope';
import { countsOf, figureById, meet, nextCountOf, type Graph } from '$lib/graph/graph';
import { isLengthCounts, nextCount, startOn } from '$lib/graph/timing';
import {
	flatten,
	loops,
	optionLength,
	slotEndsIn,
	stepIncoming,
	type OptionsSlot,
	type RoutineShape,
	type Slot
} from '$lib/routines/routines';
import { endFits, sharedEnds, type SlotEnd } from '$lib/routines/end';
import type { SlotSnapshot } from '$lib/routines/snapshot';
import type { PickRoutine, RoutineItem, SlotRow, TeamRef } from '$lib/types';
import { serverNow } from '$lib/server/server-clock';

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
 * The lengths these steps' options carry (`routine_step_options.length_counts`),
 * by step, then by figure: only rows that have one. Read only for a figure
 * whose length is free (`optionLength`), but kept for every row so turning
 * the figure free again brings them back.
 */
function lengthsIn(db: Db | Tx, stepIds: number[]): Map<number, Record<number, number>> {
	const out = new Map<number, Record<number, number>>();
	if (stepIds.length === 0) return out;
	for (const row of db
		.select({
			stepId: routineStepOptions.stepId,
			figureId: routineStepOptions.figureId,
			length: routineStepOptions.lengthCounts
		})
		.from(routineStepOptions)
		.where(
			and(inArray(routineStepOptions.stepId, stepIds), isNotNull(routineStepOptions.lengthCounts))
		)
		.all()) {
		const of = out.get(row.stepId) ?? {};
		of[row.figureId] = row.length!;
		out.set(row.stepId, of);
	}
	return out;
}

/** A shape's option slot for one step: its options, note, step id and the lengths it has. */
function optionsSlot(
	s: { id: number; note: string | null; end?: number | null },
	byStep: Map<number, number[]>,
	lengths: Map<number, Record<number, number>>
): OptionsSlot {
	const own = lengths.get(s.id);
	return {
		kind: 'options',
		figureIds: byStep.get(s.id) ?? [],
		note: s.note,
		stepId: s.id,
		...(own ? { lengths: own } : {}),
		...(s.end != null ? { end: s.end } : {})
	};
}

/**
 * A slot's options, main figure first: the order they were added in.
 *
 * The first option added is the slot's MAIN figure — the one the editor shows
 * on the card, with the others hung under it as alternatives. A path that
 * writes several at once stamps them a millisecond apart (`insertOptions`), so
 * `created_at` decides on the server and on a phone alike. `rowid` is only the
 * last tie-break, for the server: a phone's copy has the rows in key order.
 */
const MAIN_FIRST = [asc(routineStepOptions.createdAt), sql`routine_step_options.rowid`];

export interface RoutineInput {
	name: string;
	notes: string | null;
	/** A section (spec 2026-11-12): no exercise, never listed as a routine. */
	isSection?: boolean;
}
/**
 * The space a routine row stands in, for the figure graph and the routines it
 * is read against. Only its owner is read: no one acts through it.
 */
const ownerSpace = (routine: { dance: string; userId: string | null; teamId: number | null }) =>
	spaceOfRow(routine, '');

/** A new routine, and the exercise a person's comes with; a group's has none. */
type Made = { routine: Routine; exercise: Exercise | null };

/**
 * The routine row and, in a person's space, its exercise, inside a caller's
 * transaction. A group's routine gets no exercise of its own: nobody would
 * practise it, and each member's Add makes theirs. Logs nothing: `createRoutine`
 * adds History's line, and the clone engine writes its own.
 *
 * `source: 'routine'` and `routineId` are set as a pair. There is no CHECK
 * pairing them (see `schema.ts`); this function is the enforcement, and it is
 * the only thing that ever writes `exercises.routine_id`.
 */
export function insertRoutine(tx: Db, space: Space, input: RoutineInput, everyDays = 3): Made {
	const routine = tx
		.insert(routines)
		.values({
			name: input.name,
			notes: input.notes,
			isSection: input.isSection ? 1 : 0,
			...ownerValues(space)
		})
		.returning()
		.get();
	if (isTeam(space) || input.isSection) return { routine, exercise: null };
	const exercise = tx
		.insert(exercises)
		.values({
			name: routine.name,
			source: 'routine',
			routineId: routine.id,
			dance: space.dance,
			userId: space.userId,
			everyDays
		})
		.returning()
		.get();
	return { routine, exercise };
}

/**
 * Create a routine and its exercise together — the rule lessons follow too —
 * so a routine appears in Today without a second step. In a group, the
 * routine alone (see `insertRoutine`).
 */
export function createRoutine(
	db: Db,
	wall: Wall,
	input: RoutineInput,
	everyDays?: number
): { routine: Routine; exercise: Exercise };
export function createRoutine(db: Db, space: Space, input: RoutineInput, everyDays?: number): Made;
export function createRoutine(db: Db, space: Space, input: RoutineInput, everyDays = 3): Made {
	return db.transaction((tx) => {
		const made = insertRoutine(tx, space, input, everyDays);
		logRoutine(tx, made.routine, space, {
			verb: 'add',
			subject: 'routine',
			after: { name: made.routine.name }
		});
		return made;
	});
}

/**
 * The subject of a change to several slots: one slot by its id, or how many.
 * `side` is the half that carries the count (`before` for a removal).
 */
function slotSubject(ids: number[], side: 'before' | 'after') {
	if (ids.length === 1) return { subject: 'slot', subjectId: ids[0] };
	const count = { count: ids.length };
	return side === 'before'
		? { subject: 'slot', subjectId: null, before: count }
		: { subject: 'slot', subjectId: null, after: count };
}

/** History's line for a change to a routine, filed under it; `who` is a space, or the person acting. */
function logRoutine(
	tx: Db,
	routine: { id: number; dance: string; userId: string | null; teamId: number | null },
	who: Space | string | undefined,
	e: Omit<ChangeEntry, 'rootKind' | 'rootId'>,
	now = serverNow()
): void {
	const space = typeof who === 'object' ? who : actingIn(routine, who);
	const subjectId = e.subjectId === undefined ? routine.id : e.subjectId;
	logChange(tx, space, { ...e, rootKind: 'routine', rootId: routine.id, subjectId }, now);
}

/**
 * Edit a routine. A rename carries over to its exercise so the two never drift.
 * In a group, `by` is who, for History (`verb` is `restore` for History's own
 * Restore).
 */
export function updateRoutine(
	db: Db,
	id: number,
	input: RoutineInput,
	by?: string,
	now = serverNow(),
	verb: 'change' | 'restore' = 'change'
) {
	return db.transaction((tx) => {
		const before = getRoutine(tx, id);
		if (!before) return null;
		const routine = tx.update(routines).set(input).where(eq(routines.id, id)).returning().get()!;
		tx.update(exercises).set({ name: routine.name }).where(eq(exercises.routineId, id)).run();
		const fields = (r: RoutineInput) => ({ name: r.name, notes: r.notes });
		const change = fieldChange(fields(before), fields(routine), 'routine');
		if (change) logRoutine(tx, routine, by, { verb, ...change }, now);
		return routine;
	});
}

/**
 * Archive a routine and its exercise together. Slots, options and sets stay.
 *
 * A routine embedded in another is archived all the same: the parent keeps
 * dancing it, the way a figure tagged with an archived position keeps its tag.
 * What archiving removes is the offer — the library list and the embed picker.
 * In a group, every person's entry for it goes, and so does what only it
 * brought into their added lessons (`reconcileEntries`).
 */
export function archiveRoutine(db: Db, id: number, now: number, by?: string): boolean {
	return db.transaction((tx) => {
		const routine = tx
			.update(routines)
			.set({ archivedAt: now })
			.where(and(eq(routines.id, id), isNull(routines.archivedAt)))
			.returning()
			.get();
		if (!routine) return false;
		tx.update(exercises)
			.set({ archivedAt: now })
			.where(and(eq(exercises.routineId, id), isNull(exercises.archivedAt)))
			.run();
		reconcileRoutine(tx, id, now);
		logRoutine(tx, routine, by, { verb: 'archive', subject: 'routine' }, now);
		return true;
	});
}

/**
 * Bring an archived routine back (Recently deleted), with exactly the entries
 * its archive took: those archived at its own `archived_at` (risk 6).
 */
export function restoreRoutine(db: Db, space: Space, id: number, now: number): ArchiveRestore {
	return db.transaction((tx) => {
		const routine = getRoutine(tx, id);
		if (!routine || routine.archivedAt === null || !inSpace(routine, space)) {
			return { ok: false, reason: 'gone' } as const;
		}
		const at = routine.archivedAt;
		tx.update(routines).set({ archivedAt: null }).where(eq(routines.id, id)).run();
		tx.update(exercises)
			.set({ archivedAt: null })
			.where(and(eq(exercises.routineId, id), eq(exercises.archivedAt, at)))
			.run();
		if (isTeam(space)) reviveEntries(tx, space.teamId, at);
		logRoutine(
			tx,
			routine,
			space,
			{ verb: 'restore', subject: 'routine', after: { name: routine.name } },
			now
		);
		return { ok: true } as const;
	});
}

/**
 * After a change to a group routine that can shrink what its lessons reach
 * (a slot or option gone, the routine archived), members' entries follow in
 * the same transaction (risk 25). Nothing for a person's own routine.
 */
function reconcileRoutine(tx: Db, routineId: number, now: number): void {
	const teamId = getRoutine(tx, routineId)?.teamId ?? null;
	if (teamId !== null) reconcileEntries(tx, teamId, now);
}

export function getRoutine(db: Db, id: number) {
	return db.select().from(routines).where(eq(routines.id, id)).get() ?? null;
}

/** The library: newest first, with how many slots each holds. */
export function listRoutines(db: Db, space: Space): RoutineItem[] {
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
		.where(and(ownedBy(routines, space), isNull(routines.archivedAt), eq(routines.isSection, 0)))
		.groupBy(routines.id)
		.orderBy(desc(routines.createdAt), desc(routines.id))
		.all();
}

/**
 * Moves' group sections for Routines: for each group of this dance whose
 * lessons the person added, the routines those lessons reach (linked ones and
 * those embedded in them), by group name. Never the person's own list.
 */
export function listAddedRoutines(
	db: Db,
	wall: Wall
): { team: TeamRef; routines: RoutineItem[] }[] {
	const out: { team: TeamRef; routines: RoutineItem[] }[] = [];
	for (const team of addedTeams(db, wall)) {
		const ids = [...addedReach(db, wall.userId, team.id).routines];
		if (ids.length === 0) continue;
		const rows = db
			.select({
				id: routines.id,
				name: routines.name,
				notes: routines.notes,
				slots: count(routineSteps.id),
				createdAt: routines.createdAt
			})
			.from(routines)
			.leftJoin(routineSteps, eq(routineSteps.routineId, routines.id))
			.where(and(inArray(routines.id, ids), isNull(routines.archivedAt), eq(routines.isSection, 0)))
			.groupBy(routines.id)
			.orderBy(desc(routines.createdAt), desc(routines.id))
			.all();
		const shown = withoutShadowed(db, wall, 'routine', rows);
		if (shown.length > 0) out.push({ team, routines: shown });
	}
	return out;
}

/** Every live routine of the dance as a picker offers it, by name. */
export function listPickRoutines(db: Db, space: Space): Omit<PickRoutine, 'linked'>[] {
	const shapes = routineShapes(db, space);
	const graph = graphFor(db, space);
	return listRoutines(db, space)
		.map((r) => {
			const shape = shapes.get(r.id);
			return {
				id: r.id,
				name: r.name,
				slots: r.slots,
				loops: shape ? loops(graph, shape) : false
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

/**
 * The group routines a person may use (`usableOf`), live, as a picker offers
 * them (`listPickRoutines`), each tagged with its group: whether it loops is
 * read on the person's graph, which holds the group figures they may use. By
 * name.
 */
export function listUsableRoutines(
	db: Db,
	wall: Wall,
	usable: Usable = usableOf(db, wall)
): (Omit<PickRoutine, 'linked'> & { team: TeamRef })[] {
	const ids = [...usable.routines];
	if (ids.length === 0) return [];
	const rows = db
		.select({
			id: routines.id,
			name: routines.name,
			teamId: routines.teamId,
			slots: count(routineSteps.id)
		})
		.from(routines)
		.leftJoin(routineSteps, eq(routineSteps.routineId, routines.id))
		.where(
			and(
				inArray(routines.id, ids),
				eq(routines.dance, wall.dance),
				isNotNull(routines.teamId),
				isNull(routines.archivedAt),
				eq(routines.isSection, 0)
			)
		)
		.groupBy(routines.id)
		.all();
	if (rows.length === 0) return [];
	const shapes = routineShapes(db, wall, { usable, extra: ids });
	const graph = graphFor(db, wall, usable);
	const teams = teamRefs(
		db,
		rows.map((r) => r.teamId!)
	);
	return withoutShadowed(db, wall, 'routine', rows)
		.flatMap(({ teamId, ...r }) => {
			const team = teams.get(teamId!);
			const shape = shapes.get(r.id);
			return team ? [{ ...r, loops: shape ? loops(graph, shape) : false, team }] : [];
		})
		.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
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
 *
 * A person's routine may embed a group's routine (`canEmbed`): that child's
 * slots are read from the group's rows, and if the group has since made it
 * embed a routine of its own, that one's slots are spliced in flat, so it
 * still plays whole. Only what the person may use is read (`usableOf`, or
 * `opts.usable` when the caller has it): a child they no longer read has no
 * slots. `opts.extra` are other routines of the dance whose shapes the
 * caller also wants as keys (the group routines a person may embed, for the
 * embed picker); the space's own keys never change.
 */
export function routineShapes(
	db: Db,
	space: Space,
	opts: { usable?: Usable; extra?: Iterable<number> } = {}
): Map<number, RoutineShape> {
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
			note: routineSteps.note,
			end: routineSteps.endPositionId
		})
		.from(routineSteps)
		.innerJoin(routines, eq(routines.id, routineSteps.routineId))
		.where(ownedBy(routines, space))
		.orderBy(asc(routineSteps.routineId), asc(routineSteps.position))
		.all();

	const options = db
		.select({ stepId: routineStepOptions.stepId, figureId: routineStepOptions.figureId })
		.from(routineStepOptions)
		.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
		.innerJoin(routines, eq(routines.id, routineSteps.routineId))
		.where(ownedBy(routines, space))
		.orderBy(...MAIN_FIRST)
		.all();

	const byStep = groupByStep(options);
	const lengths = lengthsIn(
		db,
		steps.map((s) => s.id)
	);

	// A routine’s own option slots, in order. Embedding is one level, so a
	// routine that IS embedded has none of its own children to worry about and
	// this is its whole shape.
	const own = new Map<number, OptionsSlot[]>();
	for (const s of steps) {
		if (s.childRoutineId !== null) continue;
		const list = own.get(s.routineId) ?? [];
		list.push(optionsSlot(s, byStep, lengths));
		own.set(s.routineId, list);
	}

	const out = new Map<number, RoutineShape>();
	for (const r of db
		.select({ id: routines.id })
		.from(routines)
		.where(ownedBy(routines, space))
		.all()) {
		out.set(r.id, { slots: [] });
	}
	// Routines of another owner: the group's children of a person's slots, and
	// `extra`. Read only when the person may use them (`usableOf`, worked out only
	// when there is one): a group routine they no longer read stays closed, its
	// slots empty. A group's routine reads no other owner's.
	let usable = opts.usable;
	const readable = (id: number) =>
		!isTeam(space) && (usable ??= usableOf(db, space)).routines.has(id);
	const more = [...(opts.extra ?? [])];
	const others = shapesOf(
		db,
		space.dance,
		[
			...steps.flatMap((s) =>
				s.childRoutineId !== null && !out.has(s.childRoutineId) ? [s.childRoutineId] : []
			),
			...more.filter((id) => !out.has(id))
		].filter(readable),
		readable
	);
	for (const s of steps) {
		const other = s.childRoutineId === null ? undefined : others.get(s.childRoutineId);
		const slot: Slot =
			s.childRoutineId === null
				? optionsSlot(s, byStep, lengths)
				: {
						kind: 'child',
						routineId: s.childRoutineId,
						slots: other ? flatSlots(other) : (own.get(s.childRoutineId) ?? []),
						note: s.note
					};
		out.get(s.routineId)?.slots.push(slot);
	}
	for (const id of more) {
		const shape = others.get(id);
		if (shape && !out.has(id)) out.set(id, shape);
	}
	return out;
}

/** A shape's slots as one run of option slots: an embedded routine's spliced in, its note standing in. */
function flatSlots(shape: RoutineShape): OptionsSlot[] {
	return shape.slots.flatMap((s) =>
		s.kind === 'options' ? [s] : s.slots.map((c) => ({ ...c, note: c.note ?? s.note ?? null }))
	);
}

/**
 * These routines of the dance, whoever owns them, as shapes: their slots, and
 * an embedded routine's own option slots when `readable` says it may be read
 * (else that child has none). Ids of another dance are left out; the caller has
 * checked `ids` themselves.
 */
function shapesOf(
	db: Db,
	dance: string,
	ids: number[],
	readable: (id: number) => boolean
): Map<number, RoutineShape> {
	const out = new Map<number, RoutineShape>();
	const wanted = [...new Set(ids)];
	if (wanted.length === 0) return out;
	const live = db
		.select({ id: routines.id })
		.from(routines)
		.where(and(inArray(routines.id, wanted), eq(routines.dance, dance)))
		.all()
		.map((r) => r.id);
	if (live.length === 0) return out;
	const stepsIn = (routineIds: number[]) =>
		routineIds.length === 0
			? []
			: db
					.select({
						id: routineSteps.id,
						routineId: routineSteps.routineId,
						childRoutineId: routineSteps.childRoutineId,
						note: routineSteps.note,
						end: routineSteps.endPositionId
					})
					.from(routineSteps)
					.where(inArray(routineSteps.routineId, routineIds))
					.orderBy(asc(routineSteps.routineId), asc(routineSteps.position))
					.all();
	const top = stepsIn(live);
	const nested = stepsIn(
		[...new Set(top.flatMap((s) => (s.childRoutineId === null ? [] : [s.childRoutineId])))].filter(
			readable
		)
	).filter((s) => s.childRoutineId === null);
	const stepIds = [...top, ...nested].map((s) => s.id);
	const byStep = groupByStep(
		stepIds.length === 0
			? []
			: db
					.select({ stepId: routineStepOptions.stepId, figureId: routineStepOptions.figureId })
					.from(routineStepOptions)
					.where(inArray(routineStepOptions.stepId, stepIds))
					.orderBy(...MAIN_FIRST)
					.all()
	);
	const lengths = lengthsIn(db, stepIds);
	const optionsOf = (s: { id: number; note: string | null }): OptionsSlot =>
		optionsSlot(s, byStep, lengths);
	const inner = new Map<number, OptionsSlot[]>();
	for (const s of nested) inner.set(s.routineId, [...(inner.get(s.routineId) ?? []), optionsOf(s)]);
	for (const id of live) out.set(id, { slots: [] });
	for (const s of top) {
		out.get(s.routineId)!.slots.push(
			s.childRoutineId === null
				? optionsOf(s)
				: {
						kind: 'child',
						routineId: s.childRoutineId,
						slots: inner.get(s.childRoutineId) ?? [],
						note: s.note
					}
		);
	}
	return out;
}

/**
 * One routine's slots as the editor needs them: ids, notes, and the child's
 * name. A child of another owner (a group's routine in a person's slot) is
 * named only while the person may use it (`holder`); otherwise `childName` is
 * null and the page says "A routine". Pass `usable` when the caller has it.
 */
export function routineSlots(db: Db, routineId: number, usable?: Usable): SlotRow[] {
	const steps = db
		.select({
			id: routineSteps.id,
			position: routineSteps.position,
			note: routineSteps.note,
			childId: routineSteps.childRoutineId,
			end: routineSteps.endPositionId
		})
		.from(routineSteps)
		.where(eq(routineSteps.routineId, routineId))
		.orderBy(asc(routineSteps.position))
		.all();

	const childIds = [...new Set(steps.flatMap((s) => (s.childId === null ? [] : [s.childId])))];
	const routine = childIds.length === 0 ? null : getRoutine(db, routineId);
	const child = new Map<number, string>();
	if (routine) {
		const holds = holder(db, routine, usable);
		for (const c of db.select().from(routines).where(inArray(routines.id, childIds)).all()) {
			if (holds('routines', c)) child.set(c.id, c.name);
		}
	}

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
	const lengths = lengthsIn(db, ids);

	return steps.map((s) => ({
		...s,
		childName: s.childId === null ? null : (child.get(s.childId) ?? null),
		figureIds: byStep.get(s.id) ?? [],
		lengths: lengths.get(s.id) ?? {}
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

/**
 * One slot's options written at once, in order, main figure first: every path
 * that copies a slot. The k-th is stamped `at + k` ms, so `created_at` alone
 * says which is main. A tie used to fall to the server's rowid, which a phone
 * never sees — its copy holds the rows in key order, `(step_id, figure_id)` —
 * so there a group's copy could show its alternative as the main figure and
 * "your copies differ" with nothing to sync (2026-11-11, migration 0051).
 */
export function insertOptions(
	tx: Db | Tx,
	stepId: number,
	figureIds: readonly number[],
	lengthOf: (figureId: number) => number | null,
	at: number = serverNow()
): void {
	figureIds.forEach((figureId, k) =>
		tx
			.insert(routineStepOptions)
			.values({ stepId, figureId, lengthCounts: lengthOf(figureId), createdAt: at + k })
			.run()
	);
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
 * start count, the positions it leaves the hands in and the count it leaves
 * the next figure on. Read off the graph, which resolves unset timing and maps
 * each position to its family's canonical id; reading the rows directly would
 * see a variation's nulls and another owner's copy of a hold as a different
 * one. Empty starts or ends mean "anywhere". Null when the figure is not in
 * this space's graph — another dance, archived, or gone.
 */
function landingIn(
	g: Graph,
	figureId: number
): { starts: number[]; start: number; ends: number[]; next: number } | null {
	const f = figureById(g, figureId);
	return f ? { starts: f.starts, start: f.start, ends: f.ends, next: nextCountOf(f) } : null;
}

/**
 * What a new slot holds: one figure (its main figure), or one embedded routine.
 * `length` is the figure's length in this slot, kept only for a figure whose
 * length is set in the routine (spec 2026-11-11); ignored for any other.
 */
export type SlotContent = { figureId: number; length?: number } | { childId: number };

/** The length to store for an option: the one asked for, when the figure's length is free and it is in range. */
function storedLength(g: Graph, figureId: number, length: number | undefined): number | null {
	return figureById(g, figureId)?.free && isLengthCounts(length) ? length : null;
}

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
	content: SlotContent,
	by?: string
): number | null {
	const routine = getRoutine(db, routineId);
	if (!routine) return null;
	let length: number | null = null;
	if ('childId' in content) {
		if (!canEmbed(db, routineId, content.childId)) return null;
	} else {
		const g = graphFor(db, ownerSpace(routine));
		if (landingIn(g, content.figureId) === null) return null;
		length = storedLength(g, content.figureId, content.length);
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
			tx.insert(routineStepOptions)
				.values({ stepId: step.id, figureId: content.figureId, lengthCounts: length })
				.run();
		}
		ids.splice(Math.min(Math.max(at, 0), ids.length), 0, step.id);
		order(tx, ids);
		logRoutine(tx, routine, by, { verb: 'add', subject: 'slot', subjectId: step.id });
		return step.id;
	});
}

/** Append a slot holding one figure. See `insertSlot`. */
export function addFigureSlot(
	db: Db,
	routineId: number,
	figureId: number,
	by?: string
): number | null {
	return insertSlot(db, routineId, Number.MAX_SAFE_INTEGER, { figureId }, by);
}

/** Append a slot holding an embedded routine. Null when `canEmbed` says no. */
export function addChildSlot(
	db: Db,
	routineId: number,
	childId: number,
	by?: string
): number | null {
	return insertSlot(db, routineId, Number.MAX_SAFE_INTEGER, { childId }, by);
}

/**
 * A new routine with one slot per figure or variation, in the given order —
 * the coverage page's "Create routine". The user puts the slots in order on
 * the routine page afterwards.
 *
 * All or nothing: null, with nothing written, for an empty list or any id
 * that is not an unarchived figure or variation of this space.
 */
export function createRoutineFromFigures(
	db: Db,
	wall: Wall,
	input: RoutineInput,
	figureIds: number[],
	everyDays?: number
): { routine: Routine; exercise: Exercise } | null;
export function createRoutineFromFigures(
	db: Db,
	space: Space,
	input: RoutineInput,
	figureIds: number[],
	everyDays?: number
): Made | null;
export function createRoutineFromFigures(
	db: Db,
	space: Space,
	input: RoutineInput,
	figureIds: number[],
	everyDays = 3
): Made | null {
	if (figureIds.length === 0) return null;
	const graph = graphFor(db, space);
	if (figureIds.some((id) => landingIn(graph, id) === null)) return null;
	return db.transaction((tx) => {
		const made = insertRoutine(tx, space, input, everyDays);
		figureIds.forEach((figureId, position) => {
			const step = tx
				.insert(routineSteps)
				.values({ routineId: made.routine.id, position })
				.returning({ id: routineSteps.id })
				.get();
			tx.insert(routineStepOptions).values({ stepId: step.id, figureId }).run();
		});
		logRoutine(tx, made.routine, space, {
			verb: 'add',
			subject: 'routine',
			after: { name: made.routine.name }
		});
		return made;
	});
}

/** A row a routine's slot can hold or name: a variation or a routine. */
type HeldRow = { id: number; dance: string; userId: string | null; teamId: number | null };

/**
 * Whether a routine's slot may hold `row` (a variation or a routine) as far as
 * owners go: a row of the routine's own space; for a person's routine, also a
 * group's row of the dance they may use (`usableOf`). A group's routine holds
 * only its group's rows. The same rule decides what a slot may show of a row it
 * already holds. `usableOf` is worked out once, and only for a group's row;
 * pass `usable` when the caller has it already.
 */
function holder(
	db: Db,
	routine: Routine,
	usable?: Usable
): (kind: 'figures' | 'routines', row: HeldRow) => boolean {
	const space = ownerSpace(routine);
	let known = usable;
	return (kind, row) => {
		if (inSpace(row, space)) return true;
		if (isTeam(space) || row.dance !== space.dance || row.teamId === null || row.userId !== null) {
			return false;
		}
		return (known ??= usableOf(db, space))[kind].has(row.id);
	};
}

/** `holder` for one row. */
function mayHold(
	db: Db,
	routine: Routine,
	kind: 'figures' | 'routines',
	row: HeldRow,
	usable?: Usable
): boolean {
	return holder(db, routine, usable)(kind, row);
}

/**
 * Whether `childId` may be embedded in `parentId`.
 *
 * Both halves are needed for depth ≤ 2: the child must embed nothing, AND the
 * parent must be embedded nowhere. With both, a cycle is impossible by
 * construction, which is why there is no cycle check anywhere in this module.
 *
 * The child is the parent's space's, or, in a person's routine, a group's
 * routine they may use (`mayHold`). "Embedded nowhere" counts only routines of
 * the parent's own space: a member's routine embedding a group's routine never
 * stops the group's editors from nesting it (`embeddedIn`).
 *
 * Archival is deliberately not consulted. Archiving removes the OFFER —
 * `embeddable()` filters it out — not the ability of a parent that already
 * embeds a routine to keep dancing it. A route that takes a raw child id
 * should offer only what `embeddable()` returned.
 */
export function canEmbed(db: Db, parentId: number, childId: number, usable?: Usable): boolean {
	if (parentId === childId) return false;
	const parent = getRoutine(db, parentId);
	const child = getRoutine(db, childId);
	if (!parent || !child || !mayHold(db, parent, 'routines', child, usable)) return false;
	const childEmbeds = db
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.where(and(eq(routineSteps.routineId, childId), isNotNull(routineSteps.childRoutineId)))
		.get();
	if (childEmbeds) return false;
	return embeddedIn(db, parentId).length === 0;
}

/**
 * The routines this one may embed: its space's and, for a person's, the
 * group routines they may use; unarchived, and `canEmbed`. Pass `given` when
 * the caller has the person's `usableOf` already.
 */
export function embeddable(
	db: Db,
	routineId: number,
	given?: Usable
): { id: number; name: string; team?: TeamRef }[] {
	const routine = getRoutine(db, routineId);
	if (!routine) return [];
	const space = ownerSpace(routine);
	const usable = isTeam(space) ? undefined : (given ?? usableOf(db, space));
	const whose = ownedOrUsable(routines, space, usable?.routines);
	const rows = db
		.select({ id: routines.id, name: routines.name, teamId: routines.teamId })
		.from(routines)
		.where(and(whose, isNull(routines.archivedAt)))
		.orderBy(asc(routines.name), asc(routines.id))
		.all()
		.filter((r) => canEmbed(db, routineId, r.id, usable));
	// A group's routine the person may use carries its group, for the picker's heading.
	const teams = teamRefs(
		db,
		rows.flatMap((r) => (r.teamId === null || isTeam(space) ? [] : [r.teamId]))
	);
	return rows.map(({ teamId, ...r }) => {
		const team = teamId === null ? undefined : teams.get(teamId);
		return team ? { ...r, team } : r;
	});
}

/** A slot as the routine walks it: the count it is entered on, and its options' lengths. */
interface SlotHere {
	incoming: number | null;
	slot: OptionsSlot;
	/** Where the routine has this slot end (`end.ts`); null when the shape no longer holds it. */
	end: SlotEnd | null;
}

/**
 * Where the routine puts this step (spec 2026-11-11): the count the slot
 * before leaves it on (null for the first, after an unknown, or a step the
 * shape no longer holds) and the lengths its options carry.
 */
function slotHere(db: Db, routine: Routine, g: Graph, stepId: number): SlotHere {
	const shape = routineShapes(db, ownerSpace(routine)).get(routine.id) ?? { slots: [] };
	const flat = flatten(g, shape);
	const at = flat.findIndex((s) => s.stepId === stepId);
	const slot = at === -1 ? undefined : flat[at];
	return {
		incoming: stepIncoming(g, shape, stepId) ?? null,
		end: at === -1 ? null : slotEndsIn(g, flat)[at],
		slot: slot ?? {
			kind: 'options',
			figureIds: [],
			stepId,
			lengths: lengthsIn(db, [stepId]).get(stepId)
		}
	};
}

/**
 * Where one option starts and leaves the next figure in this slot. `length`:
 * the length it would have (an option being added or changed); undefined:
 * the one it has. Null when the figure is not in the graph.
 */
function timingIn(
	g: Graph,
	here: SlotHere,
	figureId: number,
	length?: number | null
): { start: number; next: number } | null {
	const f = figureById(g, figureId);
	if (!f) return null;
	const start = startOn(countsOf(f), f.start, here.incoming);
	const own =
		length === undefined
			? optionLength(g, here.slot, figureId)
			: f.free && length !== null
				? length
				: f.length;
	return { start, next: nextCount(start, own) };
}

/**
 * Add an interchangeable figure to a slot.
 *
 * False when the figure is the wrong dance, when the slot holds an embedded
 * routine instead, or when it would land somewhere the slot's other options do
 * not: options that land differently — in another set of hands (compared by
 * family, sorted; `[]` equals `[]`) or on another count — are not
 * alternatives to each other, they are different steps. …and, against the
 * slot's main figure, when it begins on another count or from no hold the
 * main figure begins from.
 */
export function addOption(
	db: Db,
	stepId: number,
	figureId: number,
	by?: string,
	length?: number
): boolean {
	const step = db
		.select({ routineId: routineSteps.routineId, childId: routineSteps.childRoutineId })
		.from(routineSteps)
		.where(eq(routineSteps.id, stepId))
		.get();
	if (!step || step.childId !== null) return false;
	const routine = getRoutine(db, step.routineId);
	if (!routine) return false;
	const g = graphFor(db, ownerSpace(routine));
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
	// Every option is judged where the routine puts this slot (spec 2026-11-11):
	// it starts on the count the slot before leaves it, when its set holds it,
	// and takes its own length in the slot.
	const here = slotHere(db, routine, g, stepId);
	const lengthCounts = storedLength(g, figureId, length);
	const mine = timingIn(g, here, figureId, lengthCounts);
	if (mine === null) return false;
	for (const o of existing) {
		const other = landingIn(g, o.figureId);
		const at = timingIn(g, here, o.figureId);
		if (other === null || at === null || at.next !== mine.next) {
			return false;
		}
	}
	// The start rule, judged against the MAIN figure only: an alternative that
	// begins on another count, or from no hold the main figure begins from, can
	// never be danced where the main one is. An untagged side meets anything (ruling 3). Older slots that predate this rule
	// are left as they are — it governs adding, it is not a migration.
	const main = existing.length > 0 ? landingIn(g, existing[0].figureId) : null;
	const mainAt = existing.length > 0 ? timingIn(g, here, existing[0].figureId) : null;
	// Ends (spec 2026-11-11, slot end): with one end fixed, an alternative need only
	// reach it; otherwise the main figure's set of ends, compared by family.
	if (main && !endFits(landing.ends, here.end?.ends ?? null, main.ends)) return false;
	if (main && (mainAt?.start !== mine.start || !meet(main.starts, landing.starts))) {
		return false;
	}
	db.transaction((tx) => {
		tx.insert(routineStepOptions).values({ stepId, figureId, lengthCounts }).run();
		logRoutine(tx, routine, by, { verb: 'add', subject: 'option', subjectId: stepId });
	});
	return true;
}

/**
 * Where a slot ends: the Where does it end? sheet (spec 2026-11-11, slot end).
 * `positionId` is a real position id, kept as given; null clears. False,
 * writing nothing, when the step or its routine is gone, the step embeds a
 * routine, or the position is not one the routine's owner may use (live, in
 * reach: the graph's `canon`) and every option can end in (`sharedEnds`, by
 * family). In a group, `by` is who, for History.
 */
export function setSlotEnd(
	db: Db,
	stepId: number,
	positionId: number | null,
	by?: string
): boolean {
	const step = db
		.select({
			routineId: routineSteps.routineId,
			childId: routineSteps.childRoutineId,
			end: routineSteps.endPositionId
		})
		.from(routineSteps)
		.where(eq(routineSteps.id, stepId))
		.get();
	if (!step || step.childId !== null) return false;
	const routine = getRoutine(db, step.routineId);
	if (!routine) return false;
	if (positionId !== null) {
		const g = graphFor(db, ownerSpace(routine));
		const family = g.canon.get(positionId);
		const shared = sharedEnds(g, slotHere(db, routine, g, stepId).slot) ?? [];
		if (family === undefined || !shared.includes(family)) return false;
	}
	if (step.end === positionId) return true;
	db.transaction((tx) => {
		tx.update(routineSteps)
			.set({ endPositionId: positionId })
			.where(eq(routineSteps.id, stepId))
			.run();
		logRoutine(tx, routine, by, {
			verb: 'change',
			subject: 'slot',
			subjectId: stepId,
			before: { end: step.end },
			after: { end: positionId }
		});
	});
	return true;
}

/**
 * An option's length in its slot: the How long? sheet (spec 2026-11-11).
 * False, writing nothing, when the option is gone, its figure's length is not
 * set in the routine, the length is out of range, or the slot's other options
 * would then leave the next figure on another count — the rule `addOption`
 * keeps. In a group, `by` is who, for History.
 */
export function setOptionLength(
	db: Db,
	stepId: number,
	figureId: number,
	length: number,
	by?: string
): boolean {
	if (!isLengthCounts(length)) return false;
	const step = db
		.select({ routineId: routineSteps.routineId })
		.from(routineSteps)
		.where(eq(routineSteps.id, stepId))
		.get();
	const routine = step ? getRoutine(db, step.routineId) : null;
	if (!routine) return false;
	const options = db
		.select({ figureId: routineStepOptions.figureId, length: routineStepOptions.lengthCounts })
		.from(routineStepOptions)
		.where(eq(routineStepOptions.stepId, stepId))
		.all();
	const was = options.find((o) => o.figureId === figureId);
	if (!was) return false;
	const g = graphFor(db, ownerSpace(routine));
	if (!figureById(g, figureId)?.free) return false;
	const here = slotHere(db, routine, g, stepId);
	const mine = timingIn(g, here, figureId, length);
	if (mine === null) return false;
	for (const o of options) {
		if (o.figureId === figureId) continue;
		const at = timingIn(g, here, o.figureId);
		if (at !== null && at.next !== mine.next) return false;
	}
	if (was.length === length) return true;
	db.transaction((tx) => {
		tx.update(routineStepOptions)
			.set({ lengthCounts: length })
			.where(and(eq(routineStepOptions.stepId, stepId), eq(routineStepOptions.figureId, figureId)))
			.run();
		logRoutine(tx, routine, by, {
			verb: 'change',
			subject: 'option',
			subjectId: stepId,
			before: { length: was.length },
			after: { length }
		});
	});
	return true;
}

/** Drop an option. False when it would leave the slot empty. */
export function removeOption(
	db: Db,
	stepId: number,
	figureId: number,
	now = serverNow(),
	by?: string
): boolean {
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
		const step = tx
			.select({ routineId: routineSteps.routineId })
			.from(routineSteps)
			.where(eq(routineSteps.id, stepId))
			.get();
		const routine = step ? getRoutine(tx, step.routineId) : null;
		if (routine) {
			reconcileRoutine(tx, routine.id, now);
			logRoutine(tx, routine, by, { verb: 'remove', subject: 'option', subjectId: stepId }, now);
		}
		return true;
	});
}

/**
 * Undo for a removed alternative: put it straight back.
 *
 * Checks whose it is only (`mayHold`), not the alternative rules. It was in the slot a
 * moment ago, and `addOption` would refuse an older alternative that predates
 * the start rule — an undo that cannot undo. It comes back as the newest
 * option, which cannot change the main figure: the main figure is never
 * removed on its own (removing it removes the slot).
 *
 * `removedAt` is when the remove happened: in a group, the members' entries
 * for this figure that the remove took off Today (archived at exactly that
 * time) come back with it (R10).
 */
export function restoreOption(
	db: Db,
	stepId: number,
	figureId: number,
	by?: string,
	removedAt?: number,
	length?: number
): boolean {
	const step = db
		.select({ routineId: routineSteps.routineId, childId: routineSteps.childRoutineId })
		.from(routineSteps)
		.where(eq(routineSteps.id, stepId))
		.get();
	if (!step || step.childId !== null) return false;
	const routine = getRoutine(db, step.routineId);
	const figure = db
		.select({
			id: figures.id,
			dance: figures.dance,
			userId: figures.userId,
			teamId: figures.teamId
		})
		.from(figures)
		.where(eq(figures.id, figureId))
		.get();
	if (!routine || !figure || !mayHold(db, routine, 'figures', figure)) return false;
	db.transaction((tx) => {
		const put = tx
			.insert(routineStepOptions)
			.values({ stepId, figureId, lengthCounts: isLengthCounts(length) ? length : null })
			.onConflictDoNothing()
			.run();
		if (put.changes > 0) {
			if (routine.teamId !== null && removedAt !== undefined) {
				reviveEntries(tx, routine.teamId, removedAt, { figureIds: [figureId] });
			}
			logRoutine(tx, routine, by, { verb: 'add', subject: 'option', subjectId: stepId });
		}
	});
	return true;
}

/** A slot's note. In a group, `by` is who, for History (`verb` is `restore` for its Restore). */
export function setSlotNote(
	db: Db,
	stepId: number,
	note: string | null,
	by?: string,
	now = serverNow(),
	verb: 'change' | 'restore' = 'change'
): boolean {
	return db.transaction((tx) => {
		const step = tx.select().from(routineSteps).where(eq(routineSteps.id, stepId)).get();
		const routine = step ? getRoutine(tx, step.routineId) : null;
		if (!step || !routine) return false;
		tx.update(routineSteps).set({ note }).where(eq(routineSteps.id, stepId)).run();
		const change = fieldChange({ note: step.note }, { note }, 'note');
		if (change) logRoutine(tx, routine, by, { verb, ...change, subjectId: stepId }, now);
		return true;
	});
}

/**
 * Hard-delete several slots and renumber, returning what was removed so the
 * editor can offer Undo. All or nothing: null, with nothing deleted, when any
 * id is not this routine's — a stale tab or a double tap must not delete half
 * of what it asked for.
 */
export function deleteSlots(
	db: Db,
	routineId: number,
	stepIds: number[],
	now = serverNow(),
	by?: string
): SlotSnapshot[] | null {
	const wanted = [...new Set(stepIds)];
	if (wanted.length === 0) return null;
	return db.transaction((tx) => {
		const steps = tx
			.select({
				id: routineSteps.id,
				position: routineSteps.position,
				childId: routineSteps.childRoutineId,
				note: routineSteps.note,
				end: routineSteps.endPositionId
			})
			.from(routineSteps)
			.where(and(eq(routineSteps.routineId, routineId), inArray(routineSteps.id, wanted)))
			.orderBy(asc(routineSteps.position))
			.all();
		if (steps.length !== wanted.length) return null;
		const options = optionsIn(tx, wanted);
		const lengths = lengthsIn(tx, wanted);
		const snapshot = steps.map((s) => ({
			position: s.position,
			childId: s.childId,
			note: s.note,
			figureIds: options.get(s.id) ?? [],
			...(lengths.has(s.id) ? { lengths: lengths.get(s.id) } : {}),
			...(s.end !== null ? { end: s.end } : {}),
			deletedAt: now
		}));
		// Options first: `routine_step_options.step_id` references the step and
		// `foreign_keys = ON`, so the step cannot go while its options remain.
		tx.delete(routineStepOptions).where(inArray(routineStepOptions.stepId, wanted)).run();
		tx.delete(routineSteps).where(inArray(routineSteps.id, wanted)).run();
		order(tx, slotIds(tx, routineId));
		reconcileRoutine(tx, routineId, now);
		const routine = getRoutine(tx, routineId)!;
		logRoutine(
			tx,
			routine,
			by,
			{
				verb: 'remove',
				...slotSubject(
					steps.map((s) => s.id),
					'before'
				)
			},
			now
		);
		return snapshot;
	});
}

/**
 * Undo for `deleteSlots`: re-insert each slot at the position it was deleted
 * from, lowest first — which is what makes a multi-slot undo land exactly where
 * the slots were. A position past the end (the routine shrank since) appends.
 *
 * A figure only has to still be one the routine may hold (`mayHold`), archived or not: the slot held it
 * a moment ago, and an undo that refused an archived figure would lose the
 * slot. A child must still be embeddable, because the one-level rule is a
 * structural guarantee, not a preference. All or nothing.
 */
export function restoreSlots(
	db: Db,
	routineId: number,
	snapshot: SlotSnapshot[],
	by?: string
): boolean {
	const routine = getRoutine(db, routineId);
	if (!routine || snapshot.length === 0) return false;
	const space = ownerSpace(routine);
	const usable = isTeam(space) ? undefined : usableOf(db, space);
	const figureIds = [...new Set(snapshot.flatMap((s) => s.figureIds))];
	if (figureIds.length > 0) {
		const found = db
			.select({
				id: figures.id,
				dance: figures.dance,
				userId: figures.userId,
				teamId: figures.teamId
			})
			.from(figures)
			.where(inArray(figures.id, figureIds))
			.all();
		const held = found.filter((f) => mayHold(db, routine, 'figures', f, usable));
		if (held.length !== figureIds.length) return false;
	}
	if (snapshot.some((s) => s.childId !== null && !canEmbed(db, routineId, s.childId, usable))) {
		return false;
	}
	// A posted-back end is kept only when it is a live position the routine's owner
	// may use; whether the slot can end there is read later, like any stored end.
	const inReach = snapshot.some((s) => s.end !== undefined) ? graphFor(db, space).canon : null;
	const endOf = (s: SlotSnapshot) => (s.end !== undefined && inReach?.has(s.end) ? s.end : null);
	return db.transaction((tx) => {
		const back: number[] = [];
		for (const s of [...snapshot].sort((a, b) => a.position - b.position)) {
			const ids = slotIds(tx, routineId);
			const step = tx
				.insert(routineSteps)
				.values({
					routineId,
					position: ids.length,
					childRoutineId: s.childId,
					note: s.note,
					endPositionId: endOf(s)
				})
				.returning({ id: routineSteps.id })
				.get();
			insertOptions(tx, step.id, s.figureIds, (figureId) => {
				const length = s.lengths?.[figureId];
				return isLengthCounts(length) ? length : null;
			});
			back.push(step.id);
			ids.splice(Math.min(s.position, ids.length), 0, step.id);
			order(tx, ids);
		}
		reviveSlotEntries(tx, routine.teamId, snapshot);
		logRoutine(tx, routine, by, { verb: 'restore', ...slotSubject(back, 'after') });
		return true;
	});
}

/**
 * In a group, Undo of a slot delete brings back the members' entries that
 * delete's reconcile took (R10): only those archived at its `deletedAt`, and
 * only for what the slots held — their figures, their child routines and
 * those routines' figures. The time came back from the client, so it never
 * reaches further than the slots themselves.
 */
function reviveSlotEntries(tx: Db, teamId: number | null, snapshot: SlotSnapshot[]): void {
	const at = snapshot.find((s) => s.deletedAt !== undefined)?.deletedAt;
	if (teamId === null || at === undefined) return;
	const routineIds = snapshot.flatMap((s) => (s.childId === null ? [] : [s.childId]));
	const childFigures =
		routineIds.length === 0
			? []
			: tx
					.select({ id: routineStepOptions.figureId })
					.from(routineStepOptions)
					.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
					.where(inArray(routineSteps.routineId, routineIds))
					.all()
					.map((r) => r.id);
	const figureIds = [...snapshot.flatMap((s) => s.figureIds), ...childFigures];
	reviveEntries(tx, teamId, at, { figureIds, routineIds });
}

/**
 * Move a slot to `index` — where a drag dropped it. False when the slot is not
 * this routine's or the index is off either end; a drop is always inside the
 * list, so an index outside it is a stale or tampered request.
 */
export function moveSlotTo(
	db: Db,
	routineId: number,
	stepId: number,
	index: number,
	by?: string
): boolean {
	return db.transaction((tx) => {
		const ids = slotIds(tx, routineId);
		const from = ids.indexOf(stepId);
		if (from < 0 || !Number.isInteger(index) || index < 0 || index >= ids.length) return false;
		ids.splice(from, 1);
		ids.splice(index, 0, stepId);
		order(tx, ids);
		if (from !== index) {
			logRoutine(tx, getRoutine(tx, routineId)!, by, {
				verb: 'change',
				subject: 'order',
				subjectId: stepId,
				before: { index: from },
				after: { index }
			});
		}
		return true;
	});
}

/**
 * Copy several slots — options in order, notes, an embedded child by
 * reference — and place the copies, in routine order, directly after the LAST
 * selected slot: "repeat this bit" belongs right after the bit. The copies'
 * ids, or null (nothing written) when any id is not this routine's.
 */
export function duplicateSlots(
	db: Db,
	routineId: number,
	stepIds: number[],
	by?: string
): number[] | null {
	const wanted = [...new Set(stepIds)];
	if (wanted.length === 0) return null;
	return db.transaction((tx) => {
		const steps = tx
			.select({
				id: routineSteps.id,
				childId: routineSteps.childRoutineId,
				note: routineSteps.note,
				end: routineSteps.endPositionId
			})
			.from(routineSteps)
			.where(and(eq(routineSteps.routineId, routineId), inArray(routineSteps.id, wanted)))
			.orderBy(asc(routineSteps.position))
			.all();
		if (steps.length !== wanted.length) return null;
		const options = optionsIn(tx, wanted);
		const lengths = lengthsIn(tx, wanted);
		const ids = slotIds(tx, routineId);
		const copies = steps.map((s, k) => {
			const copy = tx
				.insert(routineSteps)
				.values({
					routineId,
					position: ids.length + k,
					childRoutineId: s.childId,
					note: s.note,
					endPositionId: s.end
				})
				.returning({ id: routineSteps.id })
				.get();
			insertOptions(
				tx,
				copy.id,
				options.get(s.id) ?? [],
				(figureId) => lengths.get(s.id)?.[figureId] ?? null
			);
			return copy.id;
		});
		const last = Math.max(...steps.map((s) => ids.indexOf(s.id)));
		ids.splice(last + 1, 0, ...copies);
		order(tx, ids);
		logRoutine(tx, getRoutine(tx, routineId)!, by, {
			verb: 'add',
			...slotSubject(copies, 'after')
		});
		return copies;
	});
}

/**
 * The routines of this one's own space that embed it — why it cannot embed
 * anything itself. A person's routine embedding a group's routine is not
 * counted for the group: it never limits the group's editors, nor shows them
 * the person's routine.
 */
export function embeddedIn(db: Db, routineId: number): { id: number; name: string }[] {
	const routine = getRoutine(db, routineId);
	if (!routine) return [];
	return db
		.selectDistinct({ id: routines.id, name: routines.name })
		.from(routineSteps)
		.innerJoin(routines, eq(routines.id, routineSteps.routineId))
		.where(and(eq(routineSteps.childRoutineId, routineId), ownedBy(routines, ownerSpace(routine))))
		.orderBy(asc(routines.name))
		.all();
}

/**
 * "Make routine": pull a contiguous run of slots out into a new routine — with
 * its exercise, as every routine has — and put one slot embedding it where the
 * run was. The slots MOVE (their rows change routine), so options, the main
 * figure and notes come along untouched.
 *
 * Null, with nothing written, when the run has a gap (pulling slots 2 and 5 out
 * would silently reorder the routine), holds an embedded routine, or this
 * routine is itself embedded somewhere — the one-level rule seen from the new
 * routine's side, so no new rule is introduced.
 */
export function extractRoutine(
	db: Db,
	routineId: number,
	stepIds: number[],
	name: string,
	by?: string
): { routineId: number; stepId: number } | null {
	const routine = getRoutine(db, routineId);
	const wanted = [...new Set(stepIds)];
	if (!routine || wanted.length === 0 || embeddedIn(db, routineId).length > 0) return null;
	const space = actingIn(routine, by);
	return db.transaction((tx) => {
		const ids = slotIds(tx, routineId);
		const run = tx
			.select({ id: routineSteps.id, childId: routineSteps.childRoutineId })
			.from(routineSteps)
			.where(and(eq(routineSteps.routineId, routineId), inArray(routineSteps.id, wanted)))
			.orderBy(asc(routineSteps.position))
			.all();
		if (run.length !== wanted.length || run.some((s) => s.childId !== null)) return null;
		const at = ids.indexOf(run[0].id);
		if (ids.indexOf(run[run.length - 1].id) - at !== run.length - 1) return null;

		const made = insertRoutine(tx, space, { name, notes: null }, 3);
		run.forEach((s, k) =>
			tx
				.update(routineSteps)
				.set({ routineId: made.routine.id, position: k })
				.where(eq(routineSteps.id, s.id))
				.run()
		);
		// Compact what is left before appending, or the append's position could
		// collide with a row past the gap the run left behind.
		const rest = ids.filter((id) => !wanted.includes(id));
		order(tx, rest);
		const step = tx
			.insert(routineSteps)
			.values({ routineId, position: rest.length, childRoutineId: made.routine.id })
			.returning({ id: routineSteps.id })
			.get();
		rest.splice(at, 0, step.id);
		order(tx, rest);
		// Filed under the routine the slots left: the new one starts from here.
		logRoutine(tx, routine, space, {
			verb: 'add',
			subject: 'extract',
			subjectId: made.routine.id,
			after: { name }
		});
		return { routineId: made.routine.id, stepId: step.id };
	});
}

/**
 * Copy a whole routine, slots and all, as "<name> (copy)" with its own exercise.
 * The suffix is in the language of whoever copies it (`copyName`).
 *
 * An embedded child is REFERENCED by the copy, not itself duplicated: a routine
 * embedded in two places is one routine seen twice, and copying it would fork it
 * silently so that editing the original stopped changing the copy. That also
 * keeps the one-level embedding rule intact without a second check — the copy
 * embeds exactly what the source embedded, and the source was already legal.
 */
export function duplicateRoutine(db: Db, id: number, by?: string) {
	const source = getRoutine(db, id);
	if (!source) return null;
	const { dance, userId, teamId } = source;
	const slots = routineSlots(db, id);

	return db.transaction((tx) => {
		const routine = tx
			.insert(routines)
			.values({
				dance,
				userId,
				teamId,
				name: t().routine.copyName(source.name),
				notes: source.notes
			})
			.returning()
			.get();
		// A group's routine has no exercise of its own: see `insertRoutine`.
		if (teamId === null) {
			tx.insert(exercises)
				.values({
					name: routine.name,
					source: 'routine',
					routineId: routine.id,
					dance,
					userId,
					everyDays: 3
				})
				.run();
		}

		for (const slot of slots) {
			const step = tx
				.insert(routineSteps)
				.values({
					routineId: routine.id,
					position: slot.position,
					childRoutineId: slot.childId,
					note: slot.note,
					endPositionId: slot.end
				})
				.returning({ id: routineSteps.id })
				.get();
			insertOptions(tx, step.id, slot.figureIds, (figureId) => slot.lengths[figureId] ?? null);
		}
		logRoutine(tx, routine, by, { verb: 'add', subject: 'routine', after: { name: routine.name } });
		return routine;
	});
}
