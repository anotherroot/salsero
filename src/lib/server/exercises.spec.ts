import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './db';
import { archiveExercise, createCustomExercise, listPickExercises } from './exercises';
import { addFigureExercise, createFigure } from './figures';
import { createRoutine } from './routines';
import { U1_SALSA, U1_BACHATA, openOwnedDb } from '$lib/server/test-walls';

let db: Db;
beforeEach(() => {
	db = openOwnedDb();
});

describe('listPickExercises', () => {
	it('returns every live exercise of the dance with source, everyDays, figure and variation', () => {
		const { figure } = createFigure(db, U1_SALSA, {
			figureName: 'Enchufla',
			name: 'Doble',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;
		const own = addFigureExercise(db, figure.id, 5)!;
		const custom = createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 2, notes: null });
		const { exercise: routineEx } = createRoutine(db, U1_SALSA, { name: 'Zeta', notes: null });

		const rows = listPickExercises(db, U1_SALSA);
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
		const gone = createCustomExercise(db, U1_SALSA, { name: 'Gone', everyDays: 2, notes: null });
		const kept = createCustomExercise(db, U1_SALSA, { name: 'Kept', everyDays: 2, notes: null });
		createCustomExercise(db, U1_BACHATA, { name: 'Other', everyDays: 2, notes: null });
		archiveExercise(db, gone.id, 1000);
		expect(listPickExercises(db, U1_SALSA).map((r) => r.id)).toEqual([kept.id]);
	});
});
