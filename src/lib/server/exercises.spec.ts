import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { archiveExercise, createCustomExercise, listPickExercises } from './exercises';
import { addFigureExercise, createFigure } from './figures';
import { createRoutine } from './routines';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

describe('listPickExercises', () => {
	it('returns every live exercise of the dance with source, everyDays, figure and variation', () => {
		const { figure } = createFigure(db, 'salsa', {
			figureName: 'Enchufla',
			name: 'Doble',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;
		const own = addFigureExercise(db, figure.id, 5)!;
		const custom = createCustomExercise(db, 'salsa', { name: 'Clave', everyDays: 2, notes: null });
		const { exercise: routineEx } = createRoutine(db, 'salsa', { name: 'Zeta', notes: null });

		const rows = listPickExercises(db, 'salsa');
		expect(rows.map((r) => r.name)).toEqual([...rows.map((r) => r.name)].sort());
		expect(rows).toHaveLength(3);
		expect(rows.find((r) => r.id === own.id)).toEqual({
			id: own.id,
			name: own.name,
			source: 'figure',
			everyDays: 5,
			figure: 'Enchufla',
			variation: 'Doble',
			linked: false
		});
		expect(rows.find((r) => r.id === custom.id)).toEqual({
			id: custom.id,
			name: 'Clave',
			source: 'custom',
			everyDays: 2,
			figure: null,
			variation: null,
			linked: false
		});
		expect(rows.find((r) => r.id === routineEx.id)).toMatchObject({
			source: 'routine',
			figure: null,
			variation: null
		});
	});

	it("leaves out archived exercises and the other dance's", () => {
		const gone = createCustomExercise(db, 'salsa', { name: 'Gone', everyDays: 2, notes: null });
		const kept = createCustomExercise(db, 'salsa', { name: 'Kept', everyDays: 2, notes: null });
		createCustomExercise(db, 'bachata', { name: 'Other', everyDays: 2, notes: null });
		archiveExercise(db, gone.id, 1000);
		expect(listPickExercises(db, 'salsa').map((r) => r.id)).toEqual([kept.id]);
	});
});
