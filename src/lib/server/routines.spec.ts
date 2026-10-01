import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import {
	addChildSlot,
	addFigureSlot,
	addOption,
	archiveRoutine,
	canEmbed,
	createRoutine,
	createRoutineFromFigures,
	deleteSlot,
	deleteSlots,
	embeddable,
	getRoutine,
	insertSlot,
	listRoutines,
	moveSlot,
	moveSlotTo,
	removeOption,
	restoreOption,
	restoreSlots,
	routineShapes,
	routineSlots,
	setSlotNote,
	updateRoutine,
	duplicateSlot,
	duplicateRoutine,
	duplicateSlots,
	embeddedIn,
	extractRoutine
} from './routines';
import { archiveFigure, createFigure, createVariation } from './figures';
import { listPositions, seedPositions } from './positions';
import { setFigureShape } from './graph';
import { exercises, routineStepOptions } from './db/schema';
import { eq } from 'drizzle-orm';
import type { SlotSnapshot } from '$lib/routines/snapshot';

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
	createFigure(db, dance, {
		name,
		partner: 'partner',
		style: dance === 'salsa' ? 'salsa' : 'dominican',
		notes: null
	})!.figure;

describe('createRoutine', () => {
	it('creates the routine and its exercise in one go', () => {
		const db = openDb(':memory:');
		const { routine, exercise } = createRoutine(db, 'salsa', {
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
		const { routine } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
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
		const { routine } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		expect(archiveRoutine(db, routine.id, 1000)).toBe(true);
		expect(archiveRoutine(db, routine.id, 2000)).toBe(false);
		const ex = db.select().from(exercises).where(eq(exercises.routineId, routine.id)).get();
		expect(ex?.archivedAt).toBe(1000);
	});
});

describe('listRoutines', () => {
	it('shows only this dance, unarchived, newest first, with a slot count', () => {
		const db = openDb(':memory:');
		const gone = createRoutine(db, 'salsa', { name: 'Gone', notes: null }).routine;
		createRoutine(db, 'salsa', { name: 'Older', notes: null });
		createRoutine(db, 'salsa', { name: 'Newer', notes: null });
		createRoutine(db, 'bachata', { name: 'Bachata', notes: null });
		archiveRoutine(db, gone.id, 1000);
		// Newest first, and `Newer`/`Older` share a millisecond in a test this fast —
		// so this also pins the id tiebreaker, not just the timestamp sort.
		expect(listRoutines(db, 'salsa').map((r) => r.name)).toEqual(['Newer', 'Older']);
		expect(listRoutines(db, 'salsa')[0].slots).toBe(0);
		expect(listRoutines(db, 'bachata').map((r) => r.name)).toEqual(['Bachata']);
	});
});

describe('routineShapes', () => {
	it('is an empty shape for a routine with no slots', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		expect(routineShapes(db, 'salsa').get(routine.id)).toEqual({ slots: [] });
	});

	it('does not reach across the dance wall', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'bachata', { name: 'B', notes: null });
		expect(routineShapes(db, 'salsa').has(routine.id)).toBe(false);
	});

	it('still has a shape for an archived routine, so a parent can keep dancing it', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		archiveRoutine(db, routine.id, 1000);
		expect(routineShapes(db, 'salsa').has(routine.id)).toBe(true);
	});
});

describe('addFigureSlot', () => {
	it('appends slots at 0, 1, 2 and shows up in the shape', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const f1 = figure(db, 'Enchufla');
		const f2 = figure(db, 'Dile que no');
		expect(addFigureSlot(db, routine.id, f1.id)).not.toBeNull();
		expect(addFigureSlot(db, routine.id, f2.id)).not.toBeNull();
		expect(routineSlots(db, routine.id).map((s) => [s.position, s.figureIds])).toEqual([
			[0, [f1.id]],
			[1, [f2.id]]
		]);
		expect(routineShapes(db, 'salsa').get(routine.id)).toEqual({
			slots: [
				{ kind: 'options', figureIds: [f1.id], note: null },
				{ kind: 'options', figureIds: [f2.id], note: null }
			]
		});
	});

	it('refuses a figure from the other dance', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const other = figure(db, 'Bachata basic', 'bachata');
		expect(addFigureSlot(db, routine.id, other.id)).toBeNull();
		expect(routineSlots(db, routine.id)).toEqual([]);
	});
});

describe('addOption and removeOption', () => {
	it('accepts a second figure that ends in the same place', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds.sort()).toEqual([a.id, b.id].sort());
	});

	it('reports success without duplicating a figure already in the slot', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const step = addFigureSlot(db, routine.id, a.id)!;
		// Idempotent on purpose: (step_id, figure_id) is a composite primary key, so
		// falling through to the insert would throw rather than refuse.
		expect(addOption(db, step, a.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses a figure that ends somewhere else', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const pos = listPositions(db, 'salsa').find((p) => !p.neutral)!;
		setFigureShape(db, b.id, { startIds: [], endId: pos.id, startCount: 1, lengthCounts: 8 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses an alternative that leaves the next figure on a different count', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A'); // 1 → 1
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endId: null, startCount: 1, lengthCounts: 4 }); // 1 → 5
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('accepts one of a different length that lands on the same count', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A'); // 1 → 1, 8 counts
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endId: null, startCount: 1, lengthCounts: 16 }); // 1 → 1, 16 counts
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
	});

	it('counts an untagged figure as ending at the neutral position', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const neutral = listPositions(db, 'salsa').find((p) => p.neutral)!;
		setFigureShape(db, b.id, { startIds: [], endId: neutral.id, startCount: 1, lengthCounts: 8 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(true);
	});

	it('refuses an option from the other dance', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const other = figure(db, 'B', 'bachata');
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, other.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses an archived figure as an option', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const gone = figure(db, 'Gone');
		const step = addFigureSlot(db, routine.id, a.id)!;
		archiveFigure(db, gone.id, Date.now());
		expect(addOption(db, step, gone.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	// Not in the brief: none of its tests call `addOption` against a slot that
	// already holds a child, so the "never both" half of invariant 4 had no
	// regression coverage — deleting `step.childId !== null` from `addOption`
	// would not have failed a single test.
	it('refuses to add an option to a slot that holds a child', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		const step = addChildSlot(db, parent.id, child.id)!;
		const f = figure(db, 'A');
		expect(addOption(db, step, f.id)).toBe(false);
		expect(routineSlots(db, parent.id)[0].figureIds).toEqual([]);
	});

	it('will not empty a slot', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const step = addFigureSlot(db, routine.id, a.id)!;
		addOption(db, step, b.id);
		expect(removeOption(db, step, a.id)).toBe(true);
		expect(removeOption(db, step, b.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([b.id]);
	});
});

describe('deleteSlot', () => {
	it('drops the slot, its options, and renumbers what is left', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const ids = ['A', 'B', 'C'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		expect(deleteSlot(db, routine.id, ids[0])).toBe(true);
		expect(routineSlots(db, routine.id).map((s) => [s.id, s.position])).toEqual([
			[ids[1], 0],
			[ids[2], 1]
		]);
		expect(deleteSlot(db, routine.id, ids[0])).toBe(false);
	});

	it('refuses a slot belonging to another routine', () => {
		const db = openDb(':memory:');
		const mine = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		const theirs = createRoutine(db, 'salsa', { name: 'B', notes: null }).routine;
		const step = addFigureSlot(db, theirs.id, figure(db, 'A').id)!;
		expect(deleteSlot(db, mine.id, step)).toBe(false);
		expect(routineSlots(db, theirs.id)).toHaveLength(1);
	});
});

describe('moveSlot', () => {
	it('swaps with a neighbour and keeps positions contiguous', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const ids = ['A', 'B', 'C'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		expect(moveSlot(db, routine.id, ids[2], -1)).toBe(true);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([ids[0], ids[2], ids[1]]);
		expect(routineSlots(db, routine.id).map((s) => s.position)).toEqual([0, 1, 2]);
	});

	it('refuses to move off either end', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const ids = ['A', 'B'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		expect(moveSlot(db, routine.id, ids[0], -1)).toBe(false);
		expect(moveSlot(db, routine.id, ids[1], 1)).toBe(false);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual(ids);
	});
});

describe('insertSlot', () => {
	it('inserts at the start, the middle and the end', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
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
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const a = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		const b = insertSlot(db, routine.id, 9, { figureId: figure(db, 'B').id })!;
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([a, b]);
	});

	it('refuses a figure of another dance and writes nothing', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		expect(insertSlot(db, routine.id, 0, { figureId: figure(db, 'B', 'bachata').id })).toBeNull();
		expect(routineSlots(db, routine.id)).toHaveLength(0);
	});

	it('embeds a routine only where canEmbed allows', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		const grand = createRoutine(db, 'salsa', { name: 'G', notes: null }).routine;
		addFigureSlot(db, parent.id, figure(db, 'A').id);
		const step = insertSlot(db, parent.id, 0, { childId: child.id })!;
		expect(routineSlots(db, parent.id)[0]).toMatchObject({ id: step, childId: child.id });
		// `parent` now embeds, so it cannot itself be embedded.
		expect(insertSlot(db, grand.id, 0, { childId: parent.id })).toBeNull();
	});
});

describe('moveSlotTo', () => {
	it('moves a slot to any index and keeps positions contiguous', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
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
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const other = createRoutine(db, 'salsa', { name: 'O', notes: null }).routine;
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
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const step = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		expect(setSlotNote(db, step, 'hand change')).toBe(true);
		expect(routineSlots(db, routine.id)[0].note).toBe('hand change');
		setSlotNote(db, step, null);
		expect(routineSlots(db, routine.id)[0].note).toBeNull();
	});
});

describe('embedding, one level', () => {
	it('splices the child into the parent shape', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		const f = figure(db, 'A');
		addFigureSlot(db, child.id, f.id);
		expect(addChildSlot(db, parent.id, child.id)).not.toBeNull();
		expect(routineShapes(db, 'salsa').get(parent.id)).toEqual({
			slots: [
				{
					kind: 'child',
					routineId: child.id,
					note: null,
					slots: [{ kind: 'options', figureIds: [f.id], note: null }]
				}
			]
		});
		expect(routineSlots(db, parent.id)[0].childName).toBe('C');
	});

	it('refuses a child that embeds something itself', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		const b = createRoutine(db, 'salsa', { name: 'B', notes: null }).routine;
		const c = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		addChildSlot(db, b.id, c.id);
		expect(canEmbed(db, a.id, b.id)).toBe(false);
		expect(addChildSlot(db, a.id, b.id)).toBeNull();
	});

	it('refuses to embed into a routine that is itself embedded', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		const b = createRoutine(db, 'salsa', { name: 'B', notes: null }).routine;
		const c = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		addChildSlot(db, a.id, b.id);
		expect(canEmbed(db, b.id, c.id)).toBe(false);
		expect(addChildSlot(db, b.id, c.id)).toBeNull();
	});

	it('refuses a routine inside itself', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		expect(canEmbed(db, a.id, a.id)).toBe(false);
	});

	it('refuses a child from the other dance', () => {
		const db = openDb(':memory:');
		const a = createRoutine(db, 'salsa', { name: 'A', notes: null }).routine;
		const b = createRoutine(db, 'bachata', { name: 'B', notes: null }).routine;
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
		const mine = createRoutine(db, 'salsa', { name: 'Mine', notes: null }).routine;
		const theirs = createRoutine(db, 'bachata', { name: 'Theirs', notes: null }).routine;
		addFigureSlot(db, mine.id, figure(db, 'Enchufla').id);
		addFigureSlot(db, theirs.id, figure(db, 'Bachata basic', 'bachata').id);

		const salsa = routineShapes(db, 'salsa');
		expect(salsa.get(mine.id)?.slots).toHaveLength(1);
		expect(salsa.has(theirs.id)).toBe(false);

		const bachata = routineShapes(db, 'bachata');
		expect(bachata.get(theirs.id)?.slots).toHaveLength(1);
		expect(bachata.has(mine.id)).toBe(false);
	});

	it('offers only what may be embedded, archived routines excluded', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const ok = createRoutine(db, 'salsa', { name: 'OK', notes: null }).routine;
		const nested = createRoutine(db, 'salsa', { name: 'Nested', notes: null }).routine;
		const gone = createRoutine(db, 'salsa', { name: 'Gone', notes: null }).routine;
		addChildSlot(db, nested.id, ok.id);
		archiveRoutine(db, gone.id, 1000);
		expect(embeddable(db, parent.id).map((r) => r.id)).toEqual([ok.id]);
	});
});

describe('duplicateSlot', () => {
	it('inserts a copy directly after the original, with its options and note', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const first = addFigureSlot(db, routine.id, a.id)!;
		addOption(db, first, b.id);
		setSlotNote(db, first, 'hand change');
		const last = addFigureSlot(db, routine.id, figure(db, 'C').id)!;

		const copy = duplicateSlot(db, routine.id, first);
		expect(copy).not.toBeNull();

		const slots = routineSlots(db, routine.id);
		// Directly after the original, not appended at the end — a duplicate is for
		// a repeat, and a repeat belongs next to what it repeats.
		expect(slots.map((s) => s.id)).toEqual([first, copy, last]);
		expect(slots.map((s) => s.position)).toEqual([0, 1, 2]);
		expect(slots[1].figureIds.sort()).toEqual([a.id, b.id].sort());
		expect(slots[1].note).toBe('hand change');
	});

	it('copies an embedded routine slot as an embedded routine slot', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		addFigureSlot(db, child.id, figure(db, 'Inner').id);
		const step = addChildSlot(db, parent.id, child.id)!;

		const copy = duplicateSlot(db, parent.id, step);
		const slots = routineSlots(db, parent.id);
		expect(slots).toHaveLength(2);
		expect(slots[1].id).toBe(copy);
		expect(slots[1].childId).toBe(child.id);
		expect(slots[1].figureIds).toEqual([]);
	});

	it('refuses a slot belonging to another routine, writing nothing', () => {
		const db = openDb(':memory:');
		const mine = createRoutine(db, 'salsa', { name: 'Mine', notes: null }).routine;
		const theirs = createRoutine(db, 'salsa', { name: 'Theirs', notes: null }).routine;
		const step = addFigureSlot(db, theirs.id, figure(db, 'A').id)!;
		expect(duplicateSlot(db, mine.id, step)).toBeNull();
		expect(routineSlots(db, mine.id)).toEqual([]);
		expect(routineSlots(db, theirs.id)).toHaveLength(1);
	});
});

describe('duplicateRoutine', () => {
	it('copies the slots, options, notes and child slots, and makes its own exercise', () => {
		const db = openDb(':memory:');
		const child = createRoutine(db, 'salsa', { name: 'Child', notes: null }).routine;
		addFigureSlot(db, child.id, figure(db, 'Inner').id);
		const src = createRoutine(db, 'salsa', { name: 'Combo', notes: 'from Tuesday' }).routine;
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
});

describe('routineShapes carries notes', () => {
	it("so the practice list can show a slot's reminder", () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const step = addFigureSlot(db, routine.id, figure(db, 'Enchufla').id)!;
		setSlotNote(db, step, 'hand change here');
		const shape = routineShapes(db, 'salsa').get(routine.id)!;
		expect(shape.slots[0].note).toBe('hand change here');
	});
});

describe('createRoutineFromFigures', () => {
	it('makes the routine, its exercise, and one slot per id in the given order', () => {
		const db = openDb(':memory:');
		const a = figure(db, 'Enchufla');
		const v = createVariation(db, a.id, { name: 'Doble', notes: null })!;
		const b = figure(db, 'Setenta');
		const made = createRoutineFromFigures(db, 'salsa', { name: 'New', notes: null }, [
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
		archiveFigure(db, gone.id, 1);
		for (const bad of [other.id, gone.id, 9999]) {
			expect(
				createRoutineFromFigures(db, 'salsa', { name: 'X', notes: null }, [a.id, bad])
			).toBeNull();
		}
		expect(createRoutineFromFigures(db, 'salsa', { name: 'X', notes: null }, [])).toBeNull();
		expect(listRoutines(db, 'salsa')).toEqual([]);
		expect(db.select().from(exercises).all()).toEqual([]);
	});
});

describe('the main figure', () => {
	it('is the first option added, not the lowest id', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const low = figure(db, 'Low');
		const high = figure(db, 'High');
		const step = addFigureSlot(db, routine.id, high.id)!;
		addOption(db, step, low.id);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([high.id, low.id]);
		expect(routineShapes(db, 'salsa').get(routine.id)!.slots[0]).toMatchObject({
			figureIds: [high.id, low.id]
		});
	});

	it('survives duplicateSlot and duplicateRoutine', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const low = figure(db, 'Low');
		const high = figure(db, 'High');
		const step = addFigureSlot(db, routine.id, high.id)!;
		addOption(db, step, low.id);
		duplicateSlot(db, routine.id, step);
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
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const [p1, p2] = listPositions(db, 'salsa').filter((p) => !p.neutral);
		return { db, routine, p1, p2 };
	};

	it('refuses an alternative that starts on another count', () => {
		const { db, routine } = setup();
		const a = figure(db, 'A'); // 1 → 1
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endId: null, startCount: 5, lengthCounts: 4 }); // 5 → 1
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
	});

	it('refuses one that shares no start position with the main figure', () => {
		const { db, routine, p1, p2 } = setup();
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		setFigureShape(db, a.id, { startIds: [p1.id], endId: null, startCount: 1, lengthCounts: 8 });
		setFigureShape(db, b.id, { startIds: [p2.id], endId: null, startCount: 1, lengthCounts: 8 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
	});

	it('accepts one whose starts overlap the main figure’s', () => {
		const { db, routine, p1, p2 } = setup();
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		setFigureShape(db, a.id, { startIds: [p1.id], endId: null, startCount: 1, lengthCounts: 8 });
		setFigureShape(db, b.id, {
			startIds: [p1.id, p2.id],
			endId: null,
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
		setFigureShape(db, legacy.id, { startIds: [], endId: null, startCount: 5, lengthCounts: 4 });
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
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		setFigureShape(db, b.id, { startIds: [], endId: null, startCount: 5, lengthCounts: 4 });
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(restoreOption(db, step, b.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id, b.id]);
	});

	it('is idempotent', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const a = figure(db, 'A');
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(restoreOption(db, step, a.id)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses a figure of another dance', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const step = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		expect(restoreOption(db, step, figure(db, 'B', 'bachata').id)).toBe(false);
	});

	it('refuses a slot that holds a routine', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
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
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
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
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const other = createRoutine(db, 'salsa', { name: 'O', notes: null }).routine;
		const mine = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		const foreign = addFigureSlot(db, other.id, figure(db, 'B').id)!;
		expect(deleteSlots(db, routine.id, [mine, foreign])).toBeNull();
		expect(deleteSlots(db, routine.id, [mine, 9999])).toBeNull();
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual([mine]);
		expect(routineSlots(db, other.id).map((s) => s.id)).toEqual([foreign]);
	});

	it('restores past the end when the routine has since shrunk', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
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
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const a = figure(db, 'A');
		const snapshot = deleteSlots(db, routine.id, [addFigureSlot(db, routine.id, a.id)!])!;
		archiveFigure(db, a.id, 1_000);
		expect(restoreSlots(db, routine.id, snapshot)).toBe(true);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('refuses a figure of another dance and writes nothing', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const snapshot: SlotSnapshot[] = [
			{ position: 0, childId: null, note: null, figureIds: [figure(db, 'B', 'bachata').id] }
		];
		expect(restoreSlots(db, routine.id, snapshot)).toBe(false);
		expect(routineSlots(db, routine.id)).toHaveLength(0);
	});

	it('refuses a child that can no longer be embedded', () => {
		const db = openDb(':memory:');
		const parent = createRoutine(db, 'salsa', { name: 'P', notes: null }).routine;
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		const inner = createRoutine(db, 'salsa', { name: 'I', notes: null }).routine;
		const snapshot = deleteSlots(db, parent.id, [addChildSlot(db, parent.id, child.id)!])!;
		addChildSlot(db, child.id, inner.id); // the child now embeds: one level only
		expect(restoreSlots(db, parent.id, snapshot)).toBe(false);
		expect(routineSlots(db, parent.id)).toHaveLength(0);
	});
});

describe('duplicateSlots', () => {
	it('copies the selection, in order, after the last selected slot', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const [a, b, c, d] = ['A', 'B', 'C', 'D'].map((n) => figure(db, n));
		const s0 = addFigureSlot(db, routine.id, a.id)!;
		const s1 = addFigureSlot(db, routine.id, c.id)!;
		addOption(db, s1, b.id);
		const s2 = addFigureSlot(db, routine.id, d.id)!;
		const copies = duplicateSlots(db, routine.id, [s1, s0])!;
		const rows = routineSlots(db, routine.id);
		expect(rows.map((s) => s.id)).toEqual([s0, s1, ...copies, s2]);
		expect(rows.map((s) => s.figureIds)).toEqual([[a.id], [c.id, b.id], [a.id], [c.id, b.id], [d.id]]);
	});

	it('copies nothing when any id is not this routine’s', () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const s0 = addFigureSlot(db, routine.id, figure(db, 'A').id)!;
		expect(duplicateSlots(db, routine.id, [s0, 9999])).toBeNull();
		expect(routineSlots(db, routine.id)).toHaveLength(1);
	});
});

describe('extractRoutine', () => {
	const fourSlots = () => {
		const db = openDb(':memory:');
		const { routine } = createRoutine(db, 'salsa', { name: 'R', notes: null });
		const ids = ['A', 'B', 'C', 'D'].map((n) => addFigureSlot(db, routine.id, figure(db, n).id)!);
		return { db, routine, ids };
	};
	const routineCount = (db: ReturnType<typeof openDb>) => listRoutines(db, 'salsa').length;

	it('moves a contiguous run into a new routine and embeds it in its place', () => {
		const { db, routine, ids } = fourSlots();
		setSlotNote(db, ids[2], 'spin here');
		const made = extractRoutine(db, routine.id, [ids[2], ids[1]], 'Combo')!;
		const rows = routineSlots(db, routine.id);
		expect(rows.map((s) => s.id)).toEqual([ids[0], made.stepId, ids[3]]);
		expect(rows[1].childId).toBe(made.routineId);
		// Moved, not copied: the same step rows, options and notes intact.
		const inner = routineSlots(db, made.routineId);
		expect(inner.map((s) => s.id)).toEqual([ids[1], ids[2]]);
		expect(inner[1].note).toBe('spin here');
		expect(getRoutine(db, made.routineId)!.name).toBe('Combo');
		const exercise = db
			.select()
			.from(exercises)
			.where(eq(exercises.routineId, made.routineId))
			.get();
		expect(exercise).toMatchObject({ source: 'routine', name: 'Combo' });
	});

	it('refuses a run with a gap and writes nothing', () => {
		const { db, routine, ids } = fourSlots();
		const before = routineCount(db);
		expect(extractRoutine(db, routine.id, [ids[0], ids[2]], 'Combo')).toBeNull();
		expect(routineCount(db)).toBe(before);
		expect(routineSlots(db, routine.id).map((s) => s.id)).toEqual(ids);
	});

	it('refuses a run holding an embedded routine', () => {
		const { db, routine, ids } = fourSlots();
		const child = createRoutine(db, 'salsa', { name: 'C', notes: null }).routine;
		const embedded = insertSlot(db, routine.id, 1, { childId: child.id })!;
		expect(extractRoutine(db, routine.id, [ids[0], embedded], 'Combo')).toBeNull();
	});

	it('refuses when the routine is itself embedded somewhere', () => {
		const { db, routine, ids } = fourSlots();
		const parent = createRoutine(db, 'salsa', { name: 'Social mix', notes: null }).routine;
		addChildSlot(db, parent.id, routine.id);
		expect(embeddedIn(db, routine.id).map((r) => r.name)).toEqual(['Social mix']);
		expect(extractRoutine(db, routine.id, [ids[0]], 'Combo')).toBeNull();
	});

	it('refuses a slot of another routine', () => {
		const { db, routine } = fourSlots();
		const other = createRoutine(db, 'salsa', { name: 'O', notes: null }).routine;
		const foreign = addFigureSlot(db, other.id, figure(db, 'E').id)!;
		expect(extractRoutine(db, routine.id, [foreign], 'Combo')).toBeNull();
		expect(routineSlots(db, other.id).map((s) => s.id)).toEqual([foreign]);
	});
});
