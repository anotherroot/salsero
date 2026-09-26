import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import {
	addChildSlot,
	addFigureSlot,
	addOption,
	archiveRoutine,
	canEmbed,
	createRoutine,
	deleteSlot,
	embeddable,
	getRoutine,
	listRoutines,
	moveSlot,
	removeOption,
	routineShapes,
	routineSlots,
	setSlotNote,
	updateRoutine
} from './routines';
import { createFigure } from './figures';
import { listPositions, seedPositions } from './positions';
import { setFigurePositions } from './graph';
import { exercises } from './db/schema';
import { eq } from 'drizzle-orm';

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
		notes: null,
		callable: true,
		callText: null
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
				{ kind: 'options', figureIds: [f1.id] },
				{ kind: 'options', figureIds: [f2.id] }
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

	it('refuses a figure that ends somewhere else', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const pos = listPositions(db, 'salsa').find((p) => !p.neutral)!;
		setFigurePositions(db, b.id, [], pos.id, 1);
		const step = addFigureSlot(db, routine.id, a.id)!;
		expect(addOption(db, step, b.id)).toBe(false);
		expect(routineSlots(db, routine.id)[0].figureIds).toEqual([a.id]);
	});

	it('counts an untagged figure as ending at the neutral position', () => {
		const db = openDb(':memory:');
		seedPositions(db);
		const { routine } = createRoutine(db, 'salsa', { name: 'A', notes: null });
		const a = figure(db, 'A');
		const b = figure(db, 'B');
		const neutral = listPositions(db, 'salsa').find((p) => p.neutral)!;
		setFigurePositions(db, b.id, [], neutral.id, 1);
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
				{ kind: 'child', routineId: child.id, slots: [{ kind: 'options', figureIds: [f.id] }] }
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
