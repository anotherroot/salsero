import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { openDb } from './db';
import { demoteImpact, demoteRoutine } from './sections';
import {
	addChildSlot,
	addFigureSlot,
	addOption,
	archiveRoutine,
	canEmbed,
	createRoutine,
	createRoutineFromFigures,
	deleteSlots,
	embeddable,
	getRoutine,
	insertSlot,
	listPickRoutines,
	listAddedRoutines,
	listRoutines,
	makeSection,
	unpackSlot,
	packSlots,
	detachSection,
	promoteSection,
	holds,
	insertRoutine,
	moveSlotTo,
	removeOption,
	restoreOption,
	restoreSlots,
	routineShapes,
	routineSlots,
	setOptionLength,
	setSlotEnd,
	setSlotNote,
	updateRoutine,
	duplicateRoutine,
	duplicateSlots,
	embeddedIn
} from './routines';
import { archiveVariation, createFigure, createVariationFrom, figureLabels } from './figures';
import { listPositions } from './positions';
import { addPosition, insertFixturePositions } from './test-positions';
import { graphFor, setFigureShape } from './graph';
import { flatten, optionSlots } from '$lib/routines/routines';
import { exercises, figures, positions, routineStepOptions, routineSteps } from './db/schema';
import { eq } from 'drizzle-orm';
import type { SlotSnapshot } from '$lib/routines/snapshot';
import { NO_FILES, T1_SALSA, U1_BACHATA, U1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { createTeam, joinTeam } from './teams';
import { withLocale } from '$lib/i18n/current';
import { leaveTeam } from './membership';
import { createLesson, linkFigure, linkRoutine, publishLesson } from './lessons';
import { addLesson } from './entries';
import { crossRefs } from './integrity';
import { lessons } from './db/schema';

/**
 * A minimal figure of one dance, with its exercise. `dance` defaults to salsa;
 * every test that only cares about the routine's own dance wall passes 'bachata'
 * explicitly when it needs the OTHER dance.
 */
const figure = (
	db: ReturnType<typeof openDb>,
	name: string,
	dance: 'salsa' | 'bachata' = 'salsa'
) =>
	createFigure(
		db,
		{ userId: 'u1', dance },
		{
			figureName: name,
			name: 'Basic',
			partner: 'partner',
			style: dance === 'salsa' ? 'salsa' : 'dominican',
			notes: null
		}
	)!.figure;

describe('createRoutine', () => {
	it('creates the routine and its exercise in one go', () => {
		const db = openDb(':memory:');
		const { routine, exercise } = createRoutine(db, U1_SALSA, {
			name: 'Setenta combo',
			notes: null
		});
		expect(routine.dance).toBe('salsa');
		expect(exercise.name).toBe('Setenta combo');
		expect(exercise.source).toBe('routine');
		expect(exercise.routineId).toBe(routine.id);
		expect(exercise.dance).toBe('salsa');
	});
});

describe('updateRoutine', () => {
	it('carries a rename over to the exercise', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'Combo', notes: null });
		updateRoutine(db, routine.id, { name: 'Setenta combo', notes: 'from Tuesday' });
		expect(getRoutine(db, routine.id)?.notes).toBe('from Tuesday');
		const ex = db.select().from(exercises).where(eq(exercises.routineId, routine.id)).get();
		expect(ex?.name).toBe('Setenta combo');
	});

	it('is null for a routine that does not exist', () => {
		const db = openDb(':memory:');
		expect(updateRoutine(db, 999, { name: 'x', notes: null })).toBeNull();
	});
});

describe('archiveRoutine', () => {
	it('archives the exercise with it, and only once', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'Combo', notes: null });
		expect(archiveRoutine(db, routine.id, 1000)).toBe(true);
		expect(archiveRoutine(db, routine.id, 2000)).toBe(false);
		const ex = db.select().from(exercises).where(eq(exercises.routineId, routine.id)).get();
		expect(ex?.archivedAt).toBe(1000);
	});
});

describe('listRoutines', () => {
	it('shows only this dance, unarchived, newest first, with a slot count', () => {
		const db = openDb(':memory:');
		const gone = createRoutine(db, U1_SALSA, { name: 'Gone', notes: null }).routine;
		createRoutine(db, U1_SALSA, { name: 'Older', notes: null });
		createRoutine(db, U1_SALSA, { name: 'Newer', notes: null });
		createRoutine(db, U1_BACHATA, { name: 'Bachata', notes: null });
		archiveRoutine(db, gone.id, 1000);
		// Newest first, and `Newer`/`Older` share a millisecond in a test this fast —
		// so this also pins the id tiebreaker, not just the timestamp sort.
		expect(listRoutines(db, U1_SALSA).map((r) => r.name)).toEqual(['Newer', 'Older']);
		expect(listRoutines(db, U1_SALSA)[0].slots).toBe(0);
		expect(listRoutines(db, U1_BACHATA).map((r) => r.name)).toEqual(['Bachata']);
	});
});

describe('routineShapes', () => {
	it('is an empty shape for a routine with no slots', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		expect(routineShapes(db, U1_SALSA).get(routine.id)).toEqual({ slots: [] });
	});

	it('does not reach across the dance wall', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_BACHATA, { name: 'B', notes: null });
		expect(routineShapes(db, U1_SALSA).has(routine.id)).toBe(false);
	});

	it('still has a shape for an archived routine, so a parent can keep dancing it', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		archiveRoutine(db, routine.id, 1000);
		expect(routineShapes(db, U1_SALSA).has(routine.id)).toBe(true);
	});
});

describe('addFigureSlot', () => {
	it('appends slots at 0, 1, 2 and shows up in the shape', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const f1 = figure(db, 'Enchufla');
		const f2 = figure(db, 'Dile que no');
		expect(addFigureSlot(db, routine.id, f1.id)).not.toBeNull();
		expect(addFigureSlot(db, routine.id, f2.id)).not.toBeNull();
		expect(routineSlots(db, routine.id).map((s) => [s.position, s.figureIds])).toEqual([
			[0, [f1.id]],
			[1, [f2.id]]
		]);
		expect(routineShapes(db, U1_SALSA).get(routine.id)).toEqual({
			slots: [
				{ kind: 'options', figureIds: [f1.id], note: null, stepId: expect.any(Number) },
				{ kind: 'options', figureIds: [f2.id], note: null, stepId: expect.any(Number) }
			]
		});
	});

	it('refuses a figure from the other dance', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const other = figure(db, 'Bachata basic', 'bachata');
		expect(addFigureSlot(db, routine.id, other.id)).toBeNull();
		expect(routineSlots(db, routine.id)).toEqual([]);
	});
});

describe('addOption and removeOption', () => {
	it('accepts a second figure that ends in the same place', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds.sort()).toEqual([a.id, b.id].sort());
	});

	it('reports success without duplicating a figure already in the slot', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A');
		const step = addFigureSlot(db, routine.id, a.id)!;
		// Idempotent on purpose: (step_id, figure_id) is a composite primary key, so
		// falling through to the insert would throw rather than refuse.
		expect(addOption(db, step, a.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses a figure that ends somewhere else: the sets of ends must match', () => {
		const db = openDb(':memory:');
		insertFixturePositions(db);
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const [pa, pb] = listPositions(db, U1_SALSA);
		setFigureShape(db, a.id, {
			startIds: [],
			endIds: [pa.id, pb.id],
			startCount: 1,
			lengthCounts: 8
		});
		setFigureShape(db, b.id, { startIds: [], endIds: [pa.id], startCount: 1, lengthCounts: 8 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('accepts one whose ends are the same set in another order', () => {
		const db = openDb(':memory:');
		insertFixturePositions(db);
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const [pa, pb] = listPositions(db, U1_SALSA);
		setFigureShape(db, a.id, {
			startIds: [],
			endIds: [pa.id, pb.id],
			startCount: 1,
			lengthCounts: 8
		});
		setFigureShape(db, b.id, {
			startIds: [],
			endIds: [pb.id, pa.id],
			startCount: 1,
			lengthCounts: 8
		});
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
	});

	it('refuses a tagged end beside an untagged one: [A] is not []', () => {
		const db = openDb(':memory:');
		insertFixturePositions(db);
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const [pa] = listPositions(db, U1_SALSA);
		setFigureShape(db, b.id, { startIds: [], endIds: [pa.id], startCount: 1, lengthCounts: 8 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
	});

	it('refuses an alternative that leaves the next figure on a different count', () => {
		const db = openDb(':memory:');
		insertFixturePositions(db);
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A'); // 1 → 1
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endIds: [], startCount: 1, lengthCounts: 4 }); // 1 → 5
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('accepts one of a different length that lands on the same count', () => {
		const db = openDb(':memory:');
		insertFixturePositions(db);
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A'); // 1 → 1, 8 counts
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endIds: [], startCount: 1, lengthCounts: 16 }); // 1 → 1, 16 counts
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
	});

	it('accepts two untagged figures: both fit anywhere', () => {
		const db = openDb(':memory:');
		insertFixturePositions(db);
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
	});

	it('refuses an option from the other dance', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A');
		const other = figure(db, 'B', 'bachata');
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, other.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses an archived figure as an option', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A');
		const gone = figure(db, 'Gone');
		const step = addFigureSlot(db, routine.id, a.id)!;
		archiveVariation(db, gone.id, Date.now());
		expect(addOption(db, step, gone.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	// Not in the brief: none of its tests call `addOption` against a slot that
	// already holds a child, so the "never both" half of invariant 4 had no
	// regression coverage — deleting `step.childId !== null` from `addOption`
	// would not have failed a single test.
	it('refuses to add an option to a slot that holds a child', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, U1_SALSA, { name: 'P', notes: null }).routine;
		const child = createRoutine(db, U1_SALSA, { name: 'C', notes: null }).routine;
		const step = addChildSlot(db, parent.id, child.id)!;
		const f = figure(db, 'A');
		expect(addOption(db, step, f.id)).toBe(false);
		expect(routineSlots(db, parent.id)[0].figureIds).toEqual([]);
	});

	it('will not empty a slot', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const step = addFigureSlot(db, routine.id, a.id)!;
		addOption(db, step, b.id);
		expect(removeOption(db, step, a.id)).toBe(true);
		expect(removeOption(db, step, b.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([b.id]);
	});
});

describe('insertSlot', () => {
	it('inserts at the start, the middle and the end', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const ids = ['A', 'B'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		const first = insertSlot(db, routine.id, 0, { figureId: figure(db, 'C').id })!;
		const mid = insertSlot(db, routine.id, 2, { figureId: figure(db, 'D').id })!;
		const last = insertSlot(db, routine.id, 4, { figureId: figure(db, 'E').id })!;
		const rows = routineSlots(db, routine.id);
		expect(rows.map((s) => s.id)).toEqual([first, ids[0], mid, ids[1], last]);
		expect(rows.map((s) => s.position)).toEqual([0, 1, 2, 3, 4]);
	});

	it('clamps an index past the end', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const a = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		const b = insertSlot(db, routine.id, 9, { figureId: figure(db, 'B').id })!;
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([a, b]);
	});

	it('refuses a figure of another dance and writes nothing', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		expect(insertSlot(db, routine.id, 0, { figureId: figure(db, 'B', 'bachata').id })).toBeNull();
		expect(routineSlots(db, routine.id)).toHaveLength(0);
	});

	it('embeds a routine only where canEmbed allows', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, U1_SALSA, { name: 'P', notes: null }).routine;
		const child = createRoutine(db, U1_SALSA, { name: 'C', notes: null }).routine;
		const grand = createRoutine(db, U1_SALSA, { name: 'G', notes: null }).routine;
		addFigureSlot(db, parent.id, figure(db, 'A').id);
		const step = insertSlot(db, parent.id, 0, { childId: child.id })!;
		expect(routineSlots(db, parent.id)[0]).toMatchObject({ id: step, childId: child.id });
		// Any depth (spec 2026-11-12): `parent` embeds and may itself be embedded,
		// but `child` may not take `parent` in (a cycle).
		expect(insertSlot(db, grand.id, 0, { childId: parent.id })).not.toBeNull();
		expect(insertSlot(db, child.id, 0, { childId: parent.id })).toBeNull();
	});
});

describe('moveSlotTo', () => {
	it('moves a slot to any index and keeps positions contiguous', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const ids = ['A', 'B', 'C', 'D'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		expect(moveSlotTo(db, routine.id, ids[0], 2)).toBe(true);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([ids[1], ids[2], ids[0], ids[3]]);
		expect(moveSlotTo(db, routine.id, ids[3], 0)).toBe(true);
		const rows = routineSlots(db, routine.id);
		expect(rows.map((s) => s.id)).toEqual([ids[3], ids[1], ids[2], ids[0]]);
		expect(rows.map((s) => s.position)).toEqual([0, 1, 2, 3]);
	});

	it('refuses an index off the end or a slot of another routine', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const other = createRoutine(db, U1_SALSA, { name: 'O', notes: null }).routine;
		const ids = ['A', 'B'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		const foreign = addFigureSlot(db, other.id, figure(db, 'C').id)!;
		expect(moveSlotTo(db, routine.id, ids[0], 2)).toBe(false);
		expect(moveSlotTo(db, routine.id, ids[0], -1)).toBe(false);
		expect(moveSlotTo(db, routine.id, foreign, 0)).toBe(false);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual(ids);
	});
});

describe('setSlotNote', () => {
	it('sets and clears it', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const step = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		expect(setSlotNote(db, step, 'hand change')).toBe(true);
		expect(routineSlots(db, routine.id)[0].note).toBe('hand change');
		setSlotNote(db, step, null);
		expect(routineSlots(db, routine.id)[0].note).toBeNull();
	});
});

describe('embedding', () => {
	it('splices the child into the parent shape', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, U1_SALSA, { name: 'P', notes: null }).routine;
		const child = createRoutine(db, U1_SALSA, { name: 'C', notes: null }).routine;
		const f = figure(db, 'A');
		addFigureSlot(db, child.id, f.id);
		expect(addChildSlot(db, parent.id, child.id)).not.toBeNull();
		expect(routineShapes(db, U1_SALSA).get(parent.id)).toEqual({
			slots: [
				{
					kind: 'child',
					routineId: child.id,
					note: null,
					stepId: expect.any(Number),
					slots: [{ kind: 'options', figureIds: [f.id], note: null, stepId: expect.any(Number) }]
				}
			]
		});
		expect(routineSlots(db, parent.id)[0].childName).toBe('C');
	});

	it('embeds a child that embeds something itself (any depth)', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, U1_SALSA, { name: 'A', notes: null }).routine;
		const b = createRoutine(db, U1_SALSA, { name: 'B', notes: null }).routine;
		const c = createRoutine(db, U1_SALSA, { name: 'C', notes: null }).routine;
		addChildSlot(db, b.id, c.id);
		expect(canEmbed(db, a.id, b.id)).toBe(true);
		expect(addChildSlot(db, a.id, b.id)).not.toBeNull();
	});

	it('embeds into a routine that is itself embedded (any depth)', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, U1_SALSA, { name: 'A', notes: null }).routine;
		const b = createRoutine(db, U1_SALSA, { name: 'B', notes: null }).routine;
		const c = createRoutine(db, U1_SALSA, { name: 'C', notes: null }).routine;
		addChildSlot(db, a.id, b.id);
		expect(canEmbed(db, b.id, c.id)).toBe(true);
		expect(addChildSlot(db, b.id, c.id)).not.toBeNull();
	});

	it('refuses a routine inside itself', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, U1_SALSA, { name: 'A', notes: null }).routine;
		expect(canEmbed(db, a.id, a.id)).toBe(false);
	});

	it('refuses a child from the other dance', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, U1_SALSA, { name: 'A', notes: null }).routine;
		const b = createRoutine(db, U1_BACHATA, { name: 'B', notes: null }).routine;
		expect(canEmbed(db, a.id, b.id)).toBe(false);
		expect(addChildSlot(db, a.id, b.id)).toBeNull();
	});
});

describe('routineShapes across the dance wall', () => {
	// Task 4 could only exercise ONE of `routineShapes`'s three dance filters,
	// because the other two need slots to exist and Task 4 had no way to make any.
	// This is that coverage, and it is the filter that actually matters: the one on
	// the steps query. Drop it and a bachata routine's slots appear in salsa's map.
	it("does not carry the other dance's slots into this dance", () => {
		const db = openDb(':memory:');
		const mine = createRoutine(db, U1_SALSA, { name: 'Mine', notes: null }).routine;
		const theirs = createRoutine(db, U1_BACHATA, { name: 'Theirs', notes: null }).routine;
		addFigureSlot(db, mine.id, figure(db, 'Enchufla').id);
		addFigureSlot(db, theirs.id, figure(db, 'Bachata basic', 'bachata').id);

		const salsa = routineShapes(db, U1_SALSA);
		expect(salsa.get(mine.id)?.slots).toHaveLength(1);
		expect(salsa.has(theirs.id)).toBe(false);

		const bachata = routineShapes(db, U1_BACHATA);
		expect(bachata.get(theirs.id)?.slots).toHaveLength(1);
		expect(bachata.has(mine.id)).toBe(false);
	});

	it('offers only what may be embedded, archived routines excluded', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, U1_SALSA, { name: 'P', notes: null }).routine;
		const ok = createRoutine(db, U1_SALSA, { name: 'OK', notes: null }).routine;
		const nested = createRoutine(db, U1_SALSA, { name: 'Nested', notes: null }).routine;
		const gone = createRoutine(db, U1_SALSA, { name: 'Gone', notes: null }).routine;
		addChildSlot(db, nested.id, ok.id);
		archiveRoutine(db, gone.id, 1000);
		expect(embeddable(db, parent.id).map((r) => r.id)).toEqual([nested.id, ok.id]);
	});
});

describe('duplicateRoutine', () => {
	it('copies the slots, options, notes and child slots, and makes its own exercise', () => {
		const db = openDb(':memory:');
		const child = createRoutine(db, U1_SALSA, { name: 'Child', notes: null }).routine;
		addFigureSlot(db, child.id, figure(db, 'Inner').id);
		const src = createRoutine(db, U1_SALSA, { name: 'Combo', notes: 'from Tuesday' }).routine;
		const a = figure(db, 'A');
		const s1 = addFigureSlot(db, src.id, a.id)!;
		addOption(db, s1, figure(db, 'B').id);
		setSlotNote(db, s1, 'watch the turn');
		addChildSlot(db, src.id, child.id);

		const copy = duplicateRoutine(db, src.id)!;
		expect(copy.name).toBe('Combo (copy)');
		expect(copy.notes).toBe('from Tuesday');
		expect(copy.id).not.toBe(src.id);

		const slots = routineSlots(db, copy.id);
		expect(slots).toHaveLength(2);
		expect(slots[0].figureIds).toHaveLength(2);
		expect(slots[0].note).toBe('watch the turn');
		// The child is REFERENCED, not itself copied: a routine embedded twice is
		// one routine in two places, and copying it would silently fork it.
		expect(slots[1].childId).toBe(child.id);

		const ex = db.select().from(exercises).where(eq(exercises.routineId, copy.id)).get();
		expect(ex?.source).toBe('routine');
		expect(ex?.name).toBe('Combo (copy)');

		// The original is untouched.
		expect(routineSlots(db, src.id)).toHaveLength(2);
	});

	it('is null for a routine that does not exist', () => {
		const db = openDb(':memory:');
		expect(duplicateRoutine(db, 999)).toBeNull();
	});

	it('names the copy in the acting person’s language', () => {
		const db = openDb(':memory:');
		const src = createRoutine(db, U1_SALSA, { name: 'Combo', notes: null }).routine;
		const sl = withLocale('sl', () => duplicateRoutine(db, src.id))!;
		expect(sl.name).toBe('Combo (kopija)');
		const ex = db.select().from(exercises).where(eq(exercises.routineId, sl.id)).get();
		expect(ex?.name).toBe('Combo (kopija)');
		expect(withLocale('en', () => duplicateRoutine(db, src.id))!.name).toBe('Combo (copy)');
	});
});

describe('routineShapes carries notes', () => {
	it("so the practice list can show a slot's reminder", () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const step = addFigureSlot(db, routine.id, figure(db, 'Enchufla').id)!;
		setSlotNote(db, step, 'hand change here');
		const shape = routineShapes(db, U1_SALSA).get(routine.id)!;
		expect(shape.slots[0].note).toBe('hand change here');
	});
});

describe('createRoutineFromFigures', () => {
	it('makes the routine, its exercise, and one slot per id in the given order', () => {
		const db = openDb(':memory:');
		const a = figure(db, 'Enchufla');
		const v = createVariationFrom(db, a.id, 'Doble')!;
		const b = figure(db, 'Setenta');
		const made = createRoutineFromFigures(db, U1_SALSA, { name: 'New', notes: null }, [
			b.id,
			v.id,
			a.id
		])!;
		expect(made.exercise).toMatchObject({
			source: 'routine',
			routineId: made.routine.id,
			dance: 'salsa'
		});
		expect(routineSlots(db, made.routine.id).map((s) => s.figureIds)).toEqual([
			[b.id],
			[v.id],
			[a.id]
		]);
	});

	it('writes nothing when any id is of the other dance, archived, or missing', () => {
		const db = openDb(':memory:');
		const a = figure(db, 'Enchufla');
		const other = figure(db, 'Basico', 'bachata');
		const gone = figure(db, 'Gone');
		archiveVariation(db, gone.id, 1);
		for (const bad of [other.id, gone.id, 9999]) {
			expect(
				createRoutineFromFigures(db, U1_SALSA, { name: 'X', notes: null }, [a.id, bad])
			).toBeNull();
		}
		expect(createRoutineFromFigures(db, U1_SALSA, { name: 'X', notes: null }, [])).toBeNull();
		expect(listRoutines(db, U1_SALSA)).toEqual([]);
		expect(db.select().from(exercises).all()).toEqual([]);
	});
});

describe('the main figure', () => {
	it('is the first option added, not the lowest id', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const low = figure(db, 'Low');
		const high = figure(db, 'High');
		const step = addFigureSlot(db, routine.id, high.id)!;
		addOption(db, step, low.id);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([high.id, low.id]);
		expect(routineShapes(db, U1_SALSA).get(routine.id)!.slots[0]).toMatchObject({
			figureIds: [high.id, low.id]
		});
	});

	it('survives duplicateSlots and duplicateRoutine', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const low = figure(db, 'Low');
		const high = figure(db, 'High');
		const step = addFigureSlot(db, routine.id, high.id)!;
		addOption(db, step, low.id);
		duplicateSlots(db, routine.id, [step]);
		expect(routineSlots(db, routine.id)[1].figureIds).toEqual([high.id, low.id]);
		const copy = duplicateRoutine(db, routine.id)!;
		expect(routineSlots(db, copy.id).map((s) => s.figureIds)).toEqual([
			[high.id, low.id],
			[high.id, low.id]
		]);
	});
});

describe('addOption: the start rule', () => {
	const setup = () => {
		const db = openDb(':memory:');
		insertFixturePositions(db);
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const [p1, p2] = listPositions(db, U1_SALSA);
		return { db, routine, p1, p2 };
	};

	it('refuses an alternative that starts on another count', () => {
		const { db, routine } = setup();
		const a = figure(db, 'A'); // 1 → 1
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endIds: [], startCount: 5, lengthCounts: 4 }); // 5 → 1
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
	});

	it('refuses one that shares no start position with the main figure', () => {
		const { db, routine, p1, p2 } = setup();
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		setFigureShape(db, a.id, { startIds: [p1.id], endIds: [], startCount: 1, lengthCounts: 8 });
		setFigureShape(db, b.id, { startIds: [p2.id], endIds: [], startCount: 1, lengthCounts: 8 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
	});

	it('accepts one whose starts overlap the main figure’s', () => {
		const { db, routine, p1, p2 } = setup();
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		setFigureShape(db, a.id, { startIds: [p1.id], endIds: [], startCount: 1, lengthCounts: 8 });
		setFigureShape(db, b.id, {
			startIds: [p1.id, p2.id],
			endIds: [],
			startCount: 1,
			lengthCounts: 8
		});
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
	});

	it('leaves a slot that already breaks the rule alone', () => {
		const { db, routine } = setup();
		const a = figure(db, 'A');
		const legacy = figure(db, 'Legacy');
		setFigureShape(db, legacy.id, { startIds: [], endIds: [], startCount: 5, lengthCounts: 4 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		// Written past `addOption`, the way a slot made before this rule looks.
		db.insert(routineStepOptions).values({ stepId: step, figureId: legacy.id }).run();
		const c = figure(db, 'C');
		expect(addOption(db, step, c.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id, legacy.id, c.id]);
	});
});

describe('restoreOption', () => {
	it('puts back an alternative the start rule would now refuse', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endIds: [], startCount: 5, lengthCounts: 4 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(restoreOption(db, step, b.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id, b.id]);
	});

	it('is idempotent', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const a = figure(db, 'A');
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(restoreOption(db, step, a.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses a figure of another dance', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const step = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		expect(restoreOption(db, step, figure(db, 'B', 'bachata').id)).toBe(false);
	});

	it('refuses a slot that holds a routine', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, U1_SALSA, { name: 'P', notes: null }).routine;
		const child = createRoutine(db, U1_SALSA, { name: 'C', notes: null }).routine;
		const step = addChildSlot(db, parent.id, child.id)!;
		expect(restoreOption(db, step, figure(db, 'A').id)).toBe(false);
	});
});

describe('deleteSlots and restoreSlots', () => {
	const shape = (db: ReturnType<typeof openDb>, id: number) =>
		routineSlots(db, id).map(({ position, note, childId, figureIds }) => ({
			position,
			note,
			childId,
			figureIds
		}));

	it('round-trips to an identical routine, main figure and note included', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((n) => figure(db, n));
		const s0 = addFigureSlot(db, routine.id, a.id)!;
		const s1 = addFigureSlot(db, routine.id, c.id)!;
		addOption(db, s1, b.id);
		setSlotNote(db, s1, 'hand change');
		const s2 = addFigureSlot(db, routine.id, d.id)!;
		const before = shape(db, routine.id);

		const snapshot = deleteSlots(db, routine.id, [s2, s1])!;
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([s0]);
		expect(restoreSlots(db, routine.id, snapshot)).toBe(true);
		expect(shape(db, routine.id)).toEqual(before);
	});

	it('deletes nothing when any id is not this routine’s', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const other = createRoutine(db, U1_SALSA, { name: 'O', notes: null }).routine;
		const mine = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		const foreign = addFigureSlot(db, other.id, figure(db, 'B').id)!;
		expect(deleteSlots(db, routine.id, [mine, foreign])).toBeNull();
		expect(deleteSlots(db, routine.id, [mine, 9999])).toBeNull();
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([mine]);
		expect(routineSlots(db, other.id).map((s) => s.id)).toEqual([foreign]);
	});

	it('restores past the end when the routine has since shrunk', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const [a, b, c] = ['A', 'B', 'C'].map((n) => figure(db, n));
		const s0 = addFigureSlot(db, routine.id, a.id)!;
		const s1 = addFigureSlot(db, routine.id, b.id)!;
		const s2 = addFigureSlot(db, routine.id, c.id)!;
		const snapshot = deleteSlots(db, routine.id, [s2])!; // was at position 2
		deleteSlots(db, routine.id, [s0]);
		expect(restoreSlots(db, routine.id, snapshot)).toBe(true);
		const rows = routineSlots(db, routine.id);
		expect(rows[0].id).toBe(s1);
		expect(rows.map((s) => s.figureIds)).toEqual([[b.id], [c.id]]);
	});

	it('restores a figure archived since it was deleted', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const a = figure(db, 'A');
		const snapshot = deleteSlots(db, routine.id, [addFigureSlot(db, routine.id, a.id)!])!;
		archiveVariation(db, a.id, 1_000);
		expect(restoreSlots(db, routine.id, snapshot)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses a figure of another dance and writes nothing', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const snapshot: SlotSnapshot[] = [
			{ position: 0, childId: null, note: null, figureIds: [figure(db, 'B', 'bachata').id] }
		];
		expect(restoreSlots(db, routine.id, snapshot)).toBe(false);
		expect(routineSlots(db, routine.id)).toHaveLength(0);
	});

	it('refuses a child that can no longer be embedded', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, U1_SALSA, { name: 'P', notes: null }).routine;
		const child = createRoutine(db, U1_SALSA, { name: 'C', notes: null }).routine;
		const snapshot = deleteSlots(db, parent.id, [addChildSlot(db, parent.id, child.id)!])!;
		addChildSlot(db, child.id, parent.id); // the child now holds the parent: a cycle
		expect(restoreSlots(db, parent.id, snapshot)).toBe(false);
		expect(routineSlots(db, parent.id)).toHaveLength(0);
	});
});

describe('duplicateSlots', () => {
	it('copies the selection, in order, after the last selected slot', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((n) => figure(db, n));
		const s0 = addFigureSlot(db, routine.id, a.id)!;
		const s1 = addFigureSlot(db, routine.id, c.id)!;
		addOption(db, s1, b.id);
		const s2 = addFigureSlot(db, routine.id, d.id)!;
		const copies = duplicateSlots(db, routine.id, [s1, s0])!;
		const rows = routineSlots(db, routine.id);
		expect(rows.map((s) => s.id)).toEqual([s0, s1, ...copies, s2]);
		expect(rows.map((s) => s.figureIds)).toEqual([
			[a.id],
			[c.id, b.id],
			[a.id],
			[c.id, b.id],
			[d.id]
		]);
	});

	it('copies nothing when any id is not this routine’s', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const s0 = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		expect(duplicateSlots(db, routine.id, [s0, 9999])).toBeNull();
		expect(routineSlots(db, routine.id)).toHaveLength(1);
	});
});

describe('makeSection', () => {
	const fourSlots = () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const ids = ['A', 'B', 'C', 'D'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		return { db, routine, ids };
	};
	const routineCount = (db: ReturnType<typeof openDb>) => listRoutines(db, U1_SALSA).length;

	it('moves a contiguous run into a new section and embeds it in its place', () => {
		const { db, routine, ids } = fourSlots();
		setSlotNote(db, ids[2], 'spin here');
		const made = makeSection(db, routine.id, [ids[2], ids[1]])!;
		const rows = routineSlots(db, routine.id);
		expect(rows.map((s) => s.id)).toEqual([ids[0], made.stepId, ids[3]]);
		expect(rows[1].childId).toBe(made.sectionId);
		// Moved, not copied: the same step rows, options and notes intact.
		const inner = routineSlots(db, made.sectionId);
		expect(inner.map((s) => s.id)).toEqual([ids[1], ids[2]]);
		expect(inner[1].note).toBe('spin here');
		expect(getRoutine(db, made.sectionId)).toMatchObject({ name: '', isSection: 1 });
		expect(
			db.select().from(exercises).where(eq(exercises.routineId, made.sectionId)).get()
		).toBeUndefined();
	});

	it('refuses a run with a gap and writes nothing', () => {
		const { db, routine, ids } = fourSlots();
		const before = routineCount(db);
		expect(makeSection(db, routine.id, [ids[0], ids[2]])).toBeNull();
		expect(routineCount(db)).toBe(before);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual(ids);
	});

	it('refuses a slot of another routine', () => {
		const { db, routine } = fourSlots();
		const other = createRoutine(db, U1_SALSA, { name: 'O', notes: null }).routine;
		const foreign = addFigureSlot(db, other.id, figure(db, 'E').id)!;
		expect(makeSection(db, routine.id, [foreign])).toBeNull();
		expect(routineSlots(db, other.id).map((s) => s.id)).toEqual([foreign]);
	});
});

describe('listPickRoutines', () => {
	it('slots counts children as one; loops follows loops()', () => {
		const db = openDb(':memory:');
		insertFixturePositions(db);
		const empty = createRoutine(db, U1_SALSA, { name: 'Empty', notes: null }).routine;
		const loopy = createRoutine(db, U1_SALSA, { name: 'Around', notes: null }).routine;
		const open = createRoutine(db, U1_SALSA, { name: 'Open', notes: null }).routine;
		const parent = createRoutine(db, U1_SALSA, { name: 'Parent', notes: null }).routine;
		createRoutine(db, U1_BACHATA, { name: 'Elsewhere', notes: null });
		const gone = createRoutine(db, U1_SALSA, { name: 'Gone', notes: null }).routine;
		archiveRoutine(db, gone.id, 1000);

		addFigureSlot(db, loopy.id, figure(db, 'A').id); // 1 → 1: runs back into itself
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endIds: [], startCount: 1, lengthCounts: 4 }); // 1 → 5
		addFigureSlot(db, open.id, b.id);
		addFigureSlot(db, parent.id, figure(db, 'C').id);
		addChildSlot(db, parent.id, loopy.id); // a child with one slot is still one slot

		expect(listPickRoutines(db, U1_SALSA)).toEqual([
			{ id: loopy.id, name: 'Around', slots: 1, loops: true },
			{ id: empty.id, name: 'Empty', slots: 0, loops: false },
			{ id: open.id, name: 'Open', slots: 1, loops: false },
			{ id: parent.id, name: 'Parent', slots: 2, loops: expect.any(Boolean) }
		]);
	});
});

describe('in a group', () => {
	const teamFigure = (db: ReturnType<typeof openDb>, name: string) =>
		createFigure(db, T1_SALSA, {
			figureName: name,
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure;

	it('creates a routine owned by the team, with no exercise, out of the person’s lists', () => {
		const db = openDb(':memory:');
		const made = createRoutine(db, T1_SALSA, { name: 'Group routine', notes: null });
		expect(made.routine).toMatchObject({ userId: null, teamId: 1 });
		expect(made.exercise).toBeNull();
		expect(db.select().from(exercises).all()).toEqual([]);
		expect(listRoutines(db, U1_SALSA)).toEqual([]);
		expect(listRoutines(db, T1_SALSA).map((r) => r.name)).toEqual(['Group routine']);
	});

	it("builds from the team's figures, and refuses the person's", () => {
		const db = openDb(':memory:');
		const theirs = teamFigure(db, 'Enchufla');
		const mine = figure(db, 'Setenta');
		expect(
			createRoutineFromFigures(db, T1_SALSA, { name: 'X', notes: null }, [mine.id])
		).toBeNull();
		const made = createRoutineFromFigures(db, T1_SALSA, { name: 'X', notes: null }, [theirs.id])!;
		expect(made.exercise).toBeNull();
		expect(addFigureSlot(db, made.routine.id, mine.id)).toBeNull();
		expect(routineShapes(db, T1_SALSA).get(made.routine.id)?.slots).toHaveLength(1);
		expect(routineShapes(db, U1_SALSA).has(made.routine.id)).toBe(false);
	});

	it('keeps a copy and an extracted routine in the team', () => {
		const db = openDb(':memory:');
		const theirs = teamFigure(db, 'Enchufla');
		const made = createRoutineFromFigures(db, T1_SALSA, { name: 'X', notes: null }, [
			theirs.id,
			theirs.id
		])!;
		const copy = duplicateRoutine(db, made.routine.id, 'u1')!;
		expect(copy).toMatchObject({ userId: null, teamId: 1 });
		const steps = routineSlots(db, made.routine.id).map((s) => s.id);
		const pulled = makeSection(db, made.routine.id, [steps[0]], 'u1')!;
		expect(getRoutine(db, pulled.sectionId)).toMatchObject({ userId: null, teamId: 1 });
		expect(db.select().from(exercises).all()).toEqual([]);
	});
});

describe('listAddedRoutines', () => {
	const none = { lesson: true, routineIds: [], drillIds: [], figureIds: [] };
	function setup() {
		const db = openDb(':memory:');
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', 1);
		joinTeam(db, 'u2', 1, 2);
		const R = createRoutine(db, T1_SALSA, { name: 'Linked', notes: null }).routine;
		createRoutine(db, T1_SALSA, { name: 'Unlinked', notes: null });
		const lesson = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-02',
			title: 'L',
			notes: null
		}).lesson;
		expect(linkRoutine(db, lesson.id, R.id, 'u1')).toBe(true);
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, lesson.id)).run();
		expect(addLesson(db, 'u2', lesson.id, none, 5)).toBe(true);
		return { db, R };
	}

	it('lists the routines of lessons the person added, per group', () => {
		const { db, R } = setup();
		expect(listAddedRoutines(db, U2_SALSA)).toEqual([
			{ team: { id: 1, name: 'Salsa Tuesdays' }, routines: [expect.objectContaining({ id: R.id })] }
		]);
	});

	it('drops a group whose routines are archived', () => {
		const { db, R } = setup();
		archiveRoutine(db, R.id, 9, 'u1');
		expect(listAddedRoutines(db, U2_SALSA)).toEqual([]);
	});

	it("never lists the person's own routines", () => {
		const { db } = setup();
		createRoutine(db, U2_SALSA, { name: 'Mine', notes: null });
		const names = listAddedRoutines(db, U2_SALSA).flatMap((g) => g.routines.map((r) => r.name));
		expect(names).toEqual(['Linked']);
	});
});
describe('a personal routine and a group’s figures and routines', () => {
	const T = 1_790_000_000_000;
	const NONE = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };
	const teamFigure = (db: ReturnType<typeof openDb>, figureName: string, teamId = 1) =>
		createFigure(
			db,
			{ ...T1_SALSA, teamId },
			{ figureName, name: 'Doble', partner: 'partner', style: 'salsa', notes: null }
		)!.figure.id;

	/** u2 added Salsa Tuesdays' published lesson L, which links F and routine R (options G). */
	function setup() {
		const db = openDb(':memory:');
		createTeam(db, 'u1', 'salsa', 'Salsa Tuesdays', T);
		joinTeam(db, 'u2', 1, T);
		const F = teamFigure(db, 'Enchufla');
		const G = teamFigure(db, 'Setenta');
		const R = createRoutineFromFigures(db, T1_SALSA, { name: 'Class routine', notes: null }, [G])!
			.routine.id;
		const L = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-03',
			title: 'Week 1',
			notes: null
		}).lesson.id;
		linkFigure(db, L, F, 'u1');
		linkRoutine(db, L, R, 'u1');
		expect(publishLesson(db, T1_SALSA, L, T)).toBe(true);
		expect(addLesson(db, 'u2', L, NONE, T)).toBe(true);
		const mine = createFigure(db, U2_SALSA, {
			figureName: 'Mine',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		const P = createRoutine(db, U2_SALSA, { name: 'Friday', notes: null }).routine.id;
		const slot = addFigureSlot(db, P, mine)!;
		return { db, F, G, R, L, P, slot, mine };
	}

	it('a personal routine takes a usable group figure', () => {
		const { db, F, P, slot, mine } = setup();
		expect(addOption(db, slot, F)).toBe(true);
		expect(addFigureSlot(db, P, F)).not.toBeNull();
		const shape = routineShapes(db, U2_SALSA).get(P)!;
		// An option the graph does not hold is dropped by `flatten`: F must be in it.
		const run = flatten(graphFor(db, U2_SALSA), shape);
		expect(run.map((s) => s.figureIds)).toEqual([[mine, F], [F]]);
		expect(figureLabels(db, U2_SALSA).get(F)).toBe('Enchufla · Doble');
		expect(crossRefs(db)).toEqual([]);
	});

	it('…not a figure of a group the person is not in', () => {
		const { db, P, slot } = setup();
		createTeam(db, 'u5', 'salsa', 'Other', T);
		const X = teamFigure(db, 'Sombrero', 2);
		expect(addOption(db, slot, X)).toBe(false);
		expect(addFigureSlot(db, P, X)).toBeNull();
		expect(createRoutineFromFigures(db, U2_SALSA, { name: 'X', notes: null }, [X])).toBeNull();
		expect(graphFor(db, U2_SALSA).figures.some((f) => f.id === X)).toBe(false);
		expect(figureLabels(db, U2_SALSA).has(X)).toBe(false);
	});

	it('a group routine still refuses a personal figure', () => {
		const { db, R, mine } = setup();
		expect(addFigureSlot(db, R, mine)).toBeNull();
		const step = routineSlots(db, R)[0].id;
		expect(addOption(db, step, mine)).toBe(false);
		expect(restoreOption(db, step, mine)).toBe(false);
		expect(createRoutineFromFigures(db, T1_SALSA, { name: 'X', notes: null }, [mine])).toBeNull();
		expect(graphFor(db, T1_SALSA).figures.some((f) => f.id === mine)).toBe(false);
	});

	it('a personal routine builds from a usable group figure', () => {
		const { db, F } = setup();
		const made = createRoutineFromFigures(db, U2_SALSA, { name: 'From F', notes: null }, [F]);
		expect(made).not.toBeNull();
	});

	it('a personal routine embeds a usable group routine', () => {
		const { db, G, R, P } = setup();
		expect(canEmbed(db, P, R)).toBe(true);
		expect(embeddable(db, P).map((r) => r.id)).toContain(R);
		expect(addChildSlot(db, P, R)).not.toBeNull();
		// The child's own slots come along, and its figures are in the person's graph.
		const child = routineShapes(db, U2_SALSA)
			.get(P)!
			.slots.find((s) => s.kind === 'child');
		expect(child).toMatchObject({ kind: 'child', routineId: R, slots: [{ figureIds: [G] }] });
		expect(graphFor(db, U2_SALSA).figures.some((f) => f.id === G)).toBe(true);
		expect(crossRefs(db)).toEqual([]);
	});

	it('embeddable tags the usable group routine with its group', () => {
		const { db, R, P } = setup();
		const offered = embeddable(db, P).find((r) => r.id === R);
		expect(offered?.team).toEqual({ id: 1, name: 'Salsa Tuesdays' });
	});

	it('refuses a usable group routine that embeds, and a group routine the person cannot use', () => {
		const { db, P } = setup();
		const stray = createRoutine(db, T1_SALSA, { name: 'Not in a lesson', notes: null }).routine.id;
		expect(canEmbed(db, P, stray)).toBe(false);
		expect(embeddable(db, P).map((r) => r.id)).not.toContain(stray);
	});

	it('a member’s embed does not stop the group nesting its own routine', () => {
		const { db, R, P } = setup();
		expect(addChildSlot(db, P, R)).not.toBeNull();
		const other = createRoutine(db, T1_SALSA, { name: 'Inner', notes: null }).routine.id;
		// The group's editor still embeds into R, and never sees the member's routine.
		expect(embeddedIn(db, R)).toEqual([]);
		expect(canEmbed(db, R, other)).toBe(true);
	});

	it('plays a group routine whole after the group nests a routine in it', () => {
		const { db, G, R, P } = setup();
		expect(addChildSlot(db, P, R)).not.toBeNull();
		const H = teamFigure(db, 'Sombrero');
		const inner = createRoutineFromFigures(db, T1_SALSA, { name: 'Inner', notes: null }, [H])!
			.routine.id;
		expect(addChildSlot(db, R, inner, 'u1')).not.toBeNull();
		const child = routineShapes(db, U2_SALSA)
			.get(P)!
			.slots.find((s) => s.kind === 'child');
		// The nested routine's slots play in order, at any depth (spec 2026-11-12).
		expect(optionSlots(child!).map((s) => s.figureIds)).toEqual([[G], [H]]);
		expect(graphFor(db, U2_SALSA).figures.some((f) => f.id === H)).toBe(true);
		expect(crossRefs(db)).toEqual([]);
	});

	it('refuses to put back what the person may not use', () => {
		const { db, R, P, slot } = setup();
		createTeam(db, 'u5', 'salsa', 'Other', T);
		const X = teamFigure(db, 'Sombrero', 2);
		const stray = createRoutine(db, T1_SALSA, { name: 'Not in a lesson', notes: null }).routine.id;
		const at = (s: Partial<SlotSnapshot>): SlotSnapshot[] => [
			{ position: 0, childId: null, note: null, figureIds: [], ...s }
		];
		expect(restoreSlots(db, P, at({ figureIds: [X] }))).toBe(false);
		expect(restoreSlots(db, P, at({ childId: stray }))).toBe(false);
		expect(restoreOption(db, slot, X)).toBe(false);
		// A group’s routine never embeds a person’s.
		expect(canEmbed(db, R, P)).toBe(false);
		expect(routineSlots(db, P)).toHaveLength(1);
	});

	it('a slot may end on a group’s position while the person may use it', async () => {
		const { db, F, P } = setup();
		const ga = addPosition(db, T1_SALSA, 'Closed');
		const gb = addPosition(db, T1_SALSA, 'Open');
		setFigureShape(db, F, { startIds: [], endIds: [ga, gb], startCount: 1, lengthCounts: 8 }, 'u1');
		const s = addFigureSlot(db, P, F)!;
		expect(setSlotEnd(db, s, gb)).toBe(true);
		expect(crossRefs(db)).toEqual([]);
		// A group u2 is not in: the integrity check sees the slot's end.
		createTeam(db, 'u1', 'salsa', 'Other', T);
		const other = addPosition(db, { ...T1_SALSA, teamId: 2 }, 'Elsewhere');
		db.update(routineSteps).set({ endPositionId: other }).where(eq(routineSteps.id, s)).run();
		expect(crossRefs(db)).not.toEqual([]);
	});

	it('leaving the group keeps a slot’s end, on the person’s own copy of the hold', async () => {
		const { db, F, P } = setup();
		const ga = addPosition(db, T1_SALSA, 'Closed');
		const gb = addPosition(db, T1_SALSA, 'Open');
		const ends = { startIds: [], endIds: [ga, gb], startCount: 1, lengthCounts: 8 };
		setFigureShape(db, F, ends, 'u1');
		const s = addFigureSlot(db, P, F)!;
		expect(setSlotEnd(db, s, gb)).toBe(true);
		expect(await leaveTeam(db, 1, 'u2', { mode: 'all' }, NO_FILES, T + 1)).toBe('left');
		expect(crossRefs(db)).toEqual([]);
		const end = routineSlots(db, P).find((x) => x.id === s)!.end!;
		const row = db.select().from(positions).where(eq(positions.id, end)).get()!;
		expect(row).toMatchObject({ userId: 'u2', name: 'Open' });
	});

	it('a former member cannot put that group’s figure in a slot', async () => {
		const { db, F, P, slot } = setup();
		expect(await leaveTeam(db, 1, 'u2', { mode: 'all' }, NO_FILES, T + 1)).toBe('left');
		expect(addOption(db, slot, F)).toBe(false);
		expect(addFigureSlot(db, P, F)).toBeNull();
		expect(graphFor(db, U2_SALSA).figures.some((f) => f.id === F)).toBe(false);
	});

	it('restores options and slots that hold a usable group figure', () => {
		const { db, F, P, slot } = setup();
		expect(restoreOption(db, slot, F)).toBe(true);
		const at = addFigureSlot(db, P, F)!;
		const snapshot = deleteSlots(db, P, [at])!;
		expect(snapshot[0].figureIds).toEqual([F]);
		expect(restoreSlots(db, P, snapshot)).toBe(true);
	});
});

describe('flexible figures in routines (spec 2026-11-11)', () => {
	/** A figure with its own timing: a start set, a length, and whether the routine sets it. */
	const shaped = (
		db: ReturnType<typeof openDb>,
		name: string,
		o: { counts: number[]; length: number; free?: boolean }
	) => {
		const f = figure(db, name);
		db.update(figures)
			.set({
				startCount: Math.min(...o.counts),
				startCounts: o.counts.length > 1 ? o.counts.reduce((m, n) => m | (1 << (n - 1)), 0) : null,
				lengthCounts: o.length,
				lengthFree: o.free ? 1 : null
			})
			.where(eq(figures.id, f.id))
			.run();
		return f;
	};
	const lengthsOf = (db: ReturnType<typeof openDb>, routineId: number) =>
		routineSlots(db, routineId).map((s) => s.lengths);

	it('stores the length a free figure is added with, and ignores one for a fixed figure', () => {
		const db = openDb(':memory:');
		const walk = shaped(db, 'Cradle walk', {
			counts: [1, 2, 3, 4, 5, 6, 7, 8],
			length: 8,
			free: true
		});
		const lead = shaped(db, 'Cross body lead', { counts: [1], length: 8 });
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		insertSlot(db, routine.id, 0, { figureId: walk.id, length: 4 });
		insertSlot(db, routine.id, 1, { figureId: lead.id, length: 4 });
		expect(lengthsOf(db, routine.id)).toEqual([{ [walk.id]: 4 }, {}]);
		const shape = routineShapes(db, U1_SALSA).get(routine.id)!;
		const first = shape.slots[0];
		expect(first.kind === 'options' && first.lengths).toEqual({ [walk.id]: 4 });
		expect(first.kind === 'options' && typeof first.stepId).toBe('number');
	});

	it('judges an alternative on the start the routine gives the slot', () => {
		const db = openDb(':memory:');
		const four = shaped(db, 'Four', { counts: [1], length: 4 });
		const basic = shaped(db, 'Basic', { counts: [1, 5], length: 4 });
		const onFive = shaped(db, 'On five', { counts: [5], length: 4 });
		const onOne = shaped(db, 'On one', { counts: [1], length: 4 });
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		addFigureSlot(db, routine.id, four.id);
		const step = addFigureSlot(db, routine.id, basic.id)!;
		// Basic starts on 5 here (Four leaves it there): so must its alternatives.
		expect(addOption(db, step, onFive.id)).toBe(true);
		expect(addOption(db, step, onOne.id)).toBe(false);
	});

	it('takes a free alternative only at a length that lands with the slot', () => {
		const db = openDb(':memory:');
		const basic = shaped(db, 'Basic', { counts: [1], length: 4 });
		const walk = shaped(db, 'Walk', { counts: [1], length: 8, free: true });
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const step = addFigureSlot(db, routine.id, basic.id)!;
		expect(addOption(db, step, walk.id, undefined, 8)).toBe(false);
		expect(addOption(db, step, walk.id, undefined, 12)).toBe(true);
		expect(lengthsOf(db, routine.id)).toEqual([{ [walk.id]: 12 }]);
	});

	it('sets an option’s length, and refuses what would split the slot', () => {
		const db = openDb(':memory:');
		const walk = shaped(db, 'Walk', { counts: [1], length: 8, free: true });
		const lead = shaped(db, 'Lead', { counts: [1], length: 8 });
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const step = addFigureSlot(db, routine.id, walk.id)!;
		expect(setOptionLength(db, step, walk.id, 12)).toBe(true);
		expect(lengthsOf(db, routine.id)).toEqual([{ [walk.id]: 12 }]);
		expect(setOptionLength(db, step, walk.id, 0)).toBe(false);
		expect(setOptionLength(db, step, walk.id, 65)).toBe(false);
		const other = addFigureSlot(db, routine.id, lead.id)!;
		expect(setOptionLength(db, other, lead.id, 4)).toBe(false);
		// With a fixed alternative that leaves the next on 1, only lengths landing on 1 go.
		expect(setOptionLength(db, step, walk.id, 8)).toBe(true);
		expect(addOption(db, step, lead.id)).toBe(true);
		expect(setOptionLength(db, step, walk.id, 4)).toBe(false);
		expect(setOptionLength(db, step, walk.id, 16)).toBe(true);
	});

	it('keeps each length through delete and Undo, duplicate, and a copy of the routine', () => {
		const db = openDb(':memory:');
		const walk = shaped(db, 'Walk', { counts: [1], length: 8, free: true });
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const step = insertSlot(db, routine.id, 0, { figureId: walk.id, length: 4 })!;
		const copies = duplicateSlots(db, routine.id, [step])!;
		expect(lengthsOf(db, routine.id)).toEqual([{ [walk.id]: 4 }, { [walk.id]: 4 }]);
		const snapshot = deleteSlots(db, routine.id, [copies[0]])!;
		expect(snapshot[0].lengths).toEqual({ [walk.id]: 4 });
		expect(restoreSlots(db, routine.id, snapshot)).toBe(true);
		expect(lengthsOf(db, routine.id)).toEqual([{ [walk.id]: 4 }, { [walk.id]: 4 }]);
		const copy = withLocale('en', () => duplicateRoutine(db, routine.id))!;
		expect(lengthsOf(db, copy.id)).toEqual([{ [walk.id]: 4 }, { [walk.id]: 4 }]);
	});

	it('puts a removed alternative back with its length', () => {
		const db = openDb(':memory:');
		const basic = shaped(db, 'Basic', { counts: [1], length: 4 });
		const walk = shaped(db, 'Walk', { counts: [1], length: 8, free: true });
		const { routine } = createRoutine(db, U1_SALSA, { name: 'R', notes: null });
		const step = addFigureSlot(db, routine.id, basic.id)!;
		addOption(db, step, walk.id, undefined, 12);
		removeOption(db, step, walk.id);
		expect(restoreOption(db, step, walk.id, undefined, undefined, 12)).toBe(true);
		expect(lengthsOf(db, routine.id)).toEqual([{ [walk.id]: 12 }]);
	});
});

describe('routineShapes carries a slot’s end (spec 2026-11-11, slot end)', () => {
	it('reads the stored end, and leaves it out when there is none', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const a = addFigureSlot(db, routine.id, figure(db, 'Enchufla').id)!;
		addFigureSlot(db, routine.id, figure(db, 'Dile que no').id);
		const p = addPosition(db, U1_SALSA, 'Closed');
		db.update(routineSteps).set({ endPositionId: p }).where(eq(routineSteps.id, a)).run();
		const [first, second] = routineShapes(db, U1_SALSA).get(routine.id)!.slots;
		expect(first).toMatchObject({ end: p });
		expect('end' in second).toBe(false);
	});
});

describe('setSlotEnd (spec 2026-11-11, slot end)', () => {
	function setup() {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const A = addPosition(db, U1_SALSA, 'Closed');
		const B = addPosition(db, U1_SALSA, 'Open');
		const X = addPosition(db, U1_SALSA, 'Cross-hand');
		const shape = (id: number, endIds: number[]) =>
			setFigureShape(db, id, { startIds: [], endIds, startCount: 1, lengthCounts: 8 });
		const m = figure(db, 'Main').id;
		shape(m, [A, B]);
		const step = addFigureSlot(db, routine.id, m)!;
		const endOf = () =>
			db
				.select({ end: routineSteps.endPositionId })
				.from(routineSteps)
				.where(eq(routineSteps.id, step))
				.get()!.end;
		return { db, routine, step, m, A, B, X, shape, endOf };
	}

	it('stores an end every option shares, and clears it', () => {
		const { db, step, B, endOf } = setup();
		expect(setSlotEnd(db, step, B)).toBe(true);
		expect(endOf()).toBe(B);
		expect(setSlotEnd(db, step, null)).toBe(true);
		expect(endOf()).toBeNull();
	});

	it('refuses an end an option lacks, or no option has', () => {
		const { db, step, A, B, X, shape, endOf } = setup();
		const k = figure(db, 'K').id;
		shape(k, [A, X]);
		expect(setSlotEnd(db, step, A)).toBe(true);
		expect(addOption(db, step, k)).toBe(true);
		expect(setSlotEnd(db, step, B)).toBe(false);
		expect(setSlotEnd(db, step, X)).toBe(false);
		expect(endOf()).toBe(A);
	});

	it('refuses on a slot that embeds a routine', () => {
		const { db, routine, A } = setup();
		const child = createRoutine(db, U1_SALSA, { name: 'C', notes: null }).routine.id;
		const s = addChildSlot(db, routine.id, child)!;
		expect(setSlotEnd(db, s, A)).toBe(false);
	});

	it('takes an alternative that can end where the slot is set', () => {
		const { db, step, A, X, shape } = setup();
		const k = figure(db, 'K').id;
		shape(k, [A, X]);
		expect(addOption(db, step, k)).toBe(false);
		expect(setSlotEnd(db, step, A)).toBe(true);
		expect(addOption(db, step, k)).toBe(true);
	});
});

describe('a slot’s end within its own routine (spec 2026-11-11, slot end)', () => {
	function setup() {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, U1_SALSA, { name: 'A', notes: null });
		const A = addPosition(db, U1_SALSA, 'Closed');
		const B = addPosition(db, U1_SALSA, 'Open');
		const m = figure(db, 'Main').id;
		setFigureShape(db, m, { startIds: [], endIds: [A, B], startCount: 1, lengthCounts: 8 });
		const step = addFigureSlot(db, routine.id, m)!;
		expect(setSlotEnd(db, step, B)).toBe(true);
		return { db, routine, step, B };
	}

	it('is in the editor’s slot rows', () => {
		const { db, routine, B } = setup();
		expect(routineSlots(db, routine.id)[0].end).toBe(B);
	});

	it('travels with a duplicated routine and duplicated slots', () => {
		const { db, routine, step, B } = setup();
		const copy = duplicateRoutine(db, routine.id)!;
		expect(routineSlots(db, copy.id)[0].end).toBe(B);
		duplicateSlots(db, routine.id, [step]);
		expect(routineSlots(db, routine.id).map((s) => s.end)).toEqual([B, B]);
	});

	it('comes back with an undone delete', () => {
		const { db, routine, step, B } = setup();
		const snapshot = deleteSlots(db, routine.id, [step])!;
		expect(snapshot[0].end).toBe(B);
		expect(restoreSlots(db, routine.id, snapshot)).toBe(true);
		expect(routineSlots(db, routine.id)[0].end).toBe(B);
	});
});

describe('sections (spec 2026-11-12)', () => {
	it('insertRoutine with isSection makes no exercise', () => {
		const db = openDb(':memory:');
		const made = insertRoutine(db, U1_SALSA, { name: '', notes: null, isSection: true });
		expect(made.exercise).toBeNull();
		expect(made.routine.isSection).toBe(1);
		expect(
			db.select().from(exercises).where(eq(exercises.routineId, made.routine.id)).all()
		).toHaveLength(0);
	});

	it('listRoutines leaves sections out', () => {
		const db = openDb(':memory:');
		createRoutine(db, U1_SALSA, { name: 'Social mix', notes: null });
		insertRoutine(db, U1_SALSA, { name: 'Enchufla → Dile', notes: null, isSection: true });
		expect(listRoutines(db, U1_SALSA).map((r) => r.name)).toEqual(['Social mix']);
	});
});

describe('routineShapes at any depth (spec 2026-11-12)', () => {
	const nest = (db: ReturnType<typeof openDb>) => {
		const f = [figure(db, 'Guapea'), figure(db, 'Enchufla'), figure(db, 'Setenta')];
		const r = createRoutine(db, U1_SALSA, { name: 'R', notes: null }).routine;
		const s = insertRoutine(db, U1_SALSA, { name: 'S', notes: null, isSection: true }).routine;
		const t = insertRoutine(db, U1_SALSA, { name: '', notes: null, isSection: true }).routine;
		addFigureSlot(db, r.id, f[0].id);
		db.insert(routineSteps).values({ routineId: r.id, position: 1, childRoutineId: s.id }).run();
		addFigureSlot(db, s.id, f[1].id);
		db.insert(routineSteps).values({ routineId: s.id, position: 1, childRoutineId: t.id }).run();
		addFigureSlot(db, t.id, f[2].id);
		return { f, r, s, t };
	};

	it('loads a three-level nest', () => {
		const db = openDb(':memory:');
		const { f, r } = nest(db);
		const shape = routineShapes(db, U1_SALSA).get(r.id)!;
		const g = graphFor(db, U1_SALSA);
		expect(flatten(g, shape).map((x) => x.figureIds[0])).toEqual(f.map((x) => x.id));
	});

	it('stops at a hand-made cycle instead of looping', () => {
		const db = openDb(':memory:');
		const { r, t } = nest(db);
		db.insert(routineSteps).values({ routineId: t.id, position: 1, childRoutineId: r.id }).run();
		expect(() => routineShapes(db, U1_SALSA)).not.toThrow();
	});
});

describe('canEmbed at any depth (spec 2026-11-12)', () => {
	const three = (db: ReturnType<typeof openDb>) => {
		const r = createRoutine(db, U1_SALSA, { name: 'R', notes: null }).routine;
		const s = insertRoutine(db, U1_SALSA, { name: 'S', notes: null, isSection: true }).routine;
		const t = insertRoutine(db, U1_SALSA, { name: 'T', notes: null, isSection: true }).routine;
		return { r, s, t };
	};

	it('embeds two levels deep', () => {
		const db = openDb(':memory:');
		const { r, s, t } = three(db);
		expect(addChildSlot(db, r.id, s.id)).not.toBeNull();
		expect(canEmbed(db, s.id, t.id)).toBe(true);
		expect(addChildSlot(db, s.id, t.id)).not.toBeNull();
		expect(holds(db, r.id, t.id)).toBe(true);
	});

	it('refuses a cycle through a share, and itself', () => {
		const db = openDb(':memory:');
		const { r, s, t } = three(db);
		addChildSlot(db, r.id, s.id);
		addChildSlot(db, s.id, t.id);
		expect(canEmbed(db, t.id, r.id)).toBe(false);
		expect(canEmbed(db, s.id, s.id)).toBe(false);
	});

	it('embeddable leaves out unnamed sections and the routine’s ancestors', () => {
		const db = openDb(':memory:');
		const { r, s, t } = three(db);
		const unnamed = insertRoutine(db, U1_SALSA, { name: '', notes: null, isSection: true }).routine;
		addChildSlot(db, r.id, s.id);
		const offered = embeddable(db, s.id).map((x) => x.id);
		expect(offered).toContain(t.id);
		expect(offered).not.toContain(r.id);
		expect(offered).not.toContain(unnamed.id);
		expect(embeddable(db, r.id).find((x) => x.id === s.id)).toMatchObject({
			isSection: true,
			holders: [{ id: r.id, name: 'R' }]
		});
	});
});

describe('section ↔ routine (spec 2026-11-12)', () => {
	const base = (db: ReturnType<typeof openDb>) => {
		const r = createRoutine(db, U1_SALSA, { name: 'R', notes: null }).routine;
		const f = [figure(db, 'A'), figure(db, 'B'), figure(db, 'C')];
		const steps = f.map((x) => addFigureSlot(db, r.id, x.id)!);
		return { r, f, steps };
	};

	it('makeSection keeps order and allows a run with an embedded slot', () => {
		const db = openDb(':memory:');
		const { r, steps } = base(db);
		const c = createRoutine(db, U1_SALSA, { name: 'C', notes: null }).routine;
		const child = addChildSlot(db, r.id, c.id)!;
		const made = makeSection(db, r.id, [steps[2], child])!;
		expect(made).not.toBeNull();
		const rows = routineSlots(db, r.id);
		expect(rows.map((x) => x.childId)).toEqual([null, null, made.sectionId]);
		expect(routineSlots(db, made.sectionId).map((x) => x.id)).toEqual([steps[2], child]);
		const sec = getRoutine(db, made.sectionId)!;
		expect([sec.isSection, sec.name]).toEqual([1, '']);
		expect(db.select().from(exercises).where(eq(exercises.routineId, sec.id)).all()).toHaveLength(
			0
		);
	});

	it('makeSection works inside an embedded routine, and refuses a gap', () => {
		const db = openDb(':memory:');
		const { r, steps } = base(db);
		const outer = createRoutine(db, U1_SALSA, { name: 'O', notes: null }).routine;
		addChildSlot(db, outer.id, r.id);
		expect(makeSection(db, r.id, [steps[0], steps[2]])).toBeNull();
		expect(makeSection(db, r.id, [steps[0], steps[1]])).not.toBeNull();
	});

	it('promoteSection gives an exercise, and refuses an unnamed one without a name', () => {
		const db = openDb(':memory:');
		const { r, steps } = base(db);
		const { sectionId } = makeSection(db, r.id, [steps[0]])!;
		expect(promoteSection(db, sectionId, null)).toBe(false);
		expect(promoteSection(db, sectionId, 'Guapea run')).toBe(true);
		const sec = getRoutine(db, sectionId)!;
		expect([sec.isSection, sec.name]).toEqual([0, 'Guapea run']);
		expect(
			db.select().from(exercises).where(eq(exercises.routineId, sectionId)).all()
		).toHaveLength(1);
	});

	it('demoteRoutine archives the exercise and unlinks lessons; demoteImpact counts at any depth', () => {
		const db = openDb(':memory:');
		const { r } = base(db);
		const top = createRoutine(db, U1_SALSA, { name: 'Top', notes: null }).routine;
		const mid = insertRoutine(db, U1_SALSA, { name: 'Mid', notes: null, isSection: true }).routine;
		addChildSlot(db, top.id, mid.id);
		addChildSlot(db, mid.id, r.id);
		const lessonId = createLesson(db, U1_SALSA, {
			lessonDay: '2026-11-01',
			title: 'Class 12',
			notes: null
		}).lesson.id;
		linkRoutine(db, lessonId, r.id);
		const impact = demoteImpact(db, r.id);
		expect(impact.routines.map((x) => x.name)).toEqual(['Top']);
		expect(impact.lessons.map((x) => x.id)).toEqual([lessonId]);
		expect(demoteRoutine(db, r.id)).toBe(true);
		expect(getRoutine(db, r.id)!.isSection).toBe(1);
		const ex = db.select().from(exercises).where(eq(exercises.routineId, r.id)).get()!;
		expect(ex.archivedAt).not.toBeNull();
		expect(demoteImpact(db, r.id).lessons).toEqual([]);
	});

	it('demoteRoutine refuses a routine used nowhere', () => {
		const db = openDb(':memory:');
		const { r } = base(db);
		expect(demoteRoutine(db, r.id)).toBe(false);
		expect(getRoutine(db, r.id)!.isSection).toBe(0);
	});
});

describe('unpack, detach, last use (spec 2026-11-12)', () => {
	const setup = () => {
		const db = openDb(':memory:');
		const r = createRoutine(db, U1_SALSA, { name: 'R', notes: null }).routine;
		const f = [figure(db, 'A'), figure(db, 'B'), figure(db, 'C')];
		const steps = f.map((x) => addFigureSlot(db, r.id, x.id)!);
		return { db, r, f, steps };
	};
	const named = (db: ReturnType<typeof openDb>, name: string, figureIds: number[]) => {
		const s = insertRoutine(db, U1_SALSA, { name, notes: null, isSection: true }).routine;
		for (const id of figureIds) addFigureSlot(db, s.id, id);
		return s;
	};
	const figs = (db: ReturnType<typeof openDb>, id: number) =>
		routineSlots(db, id).map((s) => s.figureIds[0] ?? s.childId);

	it('unpack an unnamed section moves its rows and archives it', () => {
		const { db, r, steps } = setup();
		const made = makeSection(db, r.id, [steps[1], steps[2]])!;
		const out = unpackSlot(db, r.id, made.stepId)!;
		expect(out.stepIds).toEqual([steps[1], steps[2]]);
		expect(routineSlots(db, r.id).map((s) => s.id)).toEqual(steps);
		expect(getRoutine(db, made.sectionId)!.archivedAt).not.toBeNull();
	});

	it('unpack a named section copies its slots and keeps it for its other use', () => {
		const { db, r, f } = setup();
		const s = named(db, 'Combo', [f[0].id, f[1].id]);
		const other = createRoutine(db, U1_SALSA, { name: 'Other', notes: null }).routine;
		addChildSlot(db, other.id, s.id);
		const at = addChildSlot(db, r.id, s.id)!;
		unpackSlot(db, r.id, at);
		expect(figs(db, r.id)).toEqual([f[0].id, f[1].id, f[2].id, f[0].id, f[1].id]);
		expect(getRoutine(db, s.id)!.archivedAt).toBeNull();
		expect(routineSlots(db, s.id)).toHaveLength(2);
	});

	it('unpack the last use of a named section archives it, and pack brings it back', () => {
		const { db, r, f } = setup();
		const s = named(db, 'Combo', [f[0].id]);
		const at = addChildSlot(db, r.id, s.id)!;
		const out = unpackSlot(db, r.id, at)!;
		expect(getRoutine(db, s.id)!.archivedAt).not.toBeNull();
		const back = packSlots(db, r.id, out.stepIds, out.sectionId)!;
		expect(getRoutine(db, s.id)!.archivedAt).toBeNull();
		expect(routineSlots(db, r.id).map((x) => x.childId)).toEqual([null, null, null, s.id]);
		expect(routineSlots(db, r.id)[3].id).toBe(back);
	});

	it('the same section twice in one routine: detach acts on one slot', () => {
		const { db, r, f } = setup();
		const s = named(db, 'Combo', [f[0].id]);
		const one = addChildSlot(db, r.id, s.id)!;
		const two = addChildSlot(db, r.id, s.id)!;
		const copy = detachSection(db, r.id, two)!;
		const rows = routineSlots(db, r.id);
		expect(rows.find((x) => x.id === one)!.childId).toBe(s.id);
		expect(rows.find((x) => x.id === two)!.childId).toBe(copy);
		expect(getRoutine(db, copy)).toMatchObject({ name: 'Combo', isSection: 1, geneId: null });
		expect(figs(db, copy)).toEqual([f[0].id]);
	});

	it('deleting the slot of a named section’s last use archives it; restore unarchives', () => {
		const { db, r, f } = setup();
		const s = named(db, 'Combo', [f[0].id]);
		const at = addChildSlot(db, r.id, s.id)!;
		const snapshot = deleteSlots(db, r.id, [at])!;
		expect(getRoutine(db, s.id)!.archivedAt).not.toBeNull();
		expect(restoreSlots(db, r.id, snapshot)).toBe(true);
		expect(getRoutine(db, s.id)!.archivedAt).toBeNull();
	});

	it('duplicateSlots of an unnamed section slot gives an independent copy', () => {
		const { db, r, steps } = setup();
		const made = makeSection(db, r.id, [steps[0]])!;
		const [copyStep] = duplicateSlots(db, r.id, [made.stepId])!;
		const copyOf = routineSlots(db, r.id).find((x) => x.id === copyStep)!.childId!;
		expect(copyOf).not.toBe(made.sectionId);
		expect(getRoutine(db, copyOf)).toMatchObject({ name: '', isSection: 1 });
		expect(figs(db, copyOf)).toEqual(figs(db, made.sectionId));
	});
});

describe('duplicateRoutine at any depth (spec 2026-11-12)', () => {
	it('deep-copies unnamed sections and references named ones and routines', () => {
		const db = openDb(':memory:');
		const r = createRoutine(db, U1_SALSA, { name: 'R', notes: null }).routine;
		const a = figure(db, 'A');
		const step = addFigureSlot(db, r.id, a.id)!;
		const unnamed = makeSection(db, r.id, [step])!.sectionId;
		const named = insertRoutine(db, U1_SALSA, { name: 'N', notes: null, isSection: true }).routine;
		addChildSlot(db, r.id, named.id);
		const copy = duplicateRoutine(db, r.id)!;
		const kids = routineSlots(db, copy.id).map((s) => s.childId);
		expect(kids[0]).not.toBe(unnamed);
		expect(getRoutine(db, kids[0]!)).toMatchObject({ name: '', isSection: 1 });
		expect(kids[1]).toBe(named.id);
	});
});

describe('the drop-alternatives migration (spec 2026-11-12)', () => {
	it('keeps each slot’s main option and removes the rest', () => {
		const db = openDb(':memory:');
		const r = createRoutine(db, U1_SALSA, { name: 'R', notes: null }).routine;
		const [a, b, c] = [figure(db, 'A'), figure(db, 'B'), figure(db, 'C')];
		const step = addFigureSlot(db, r.id, a.id)!;
		db.insert(routineStepOptions).values({ stepId: step, figureId: b.id, createdAt: 1 }).run();
		db.insert(routineStepOptions).values({ stepId: step, figureId: c.id, createdAt: 1 }).run();
		const sql = readFileSync('drizzle/0054_drop-alternatives.sql', 'utf8');
		(db as unknown as { $client: { exec: (s: string) => void } }).$client.exec(sql);
		expect(routineSlots(db, r.id)[0].figureIds).toEqual([b.id]);
	});
});
