import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import {
	archiveRoutine,
	createRoutine,
	getRoutine,
	listRoutines,
	routineShapes,
	updateRoutine
} from './routines';
import { exercises } from './db/schema';
import { eq } from 'drizzle-orm';

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
