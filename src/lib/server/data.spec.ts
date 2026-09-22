import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import {
	archiveExercise,
	createCustomExercise,
	deleteSet,
	listExercises,
	listSetTimes,
	listSetsBetween,
	logSet,
	updateExercise
} from './exercises';
import {
	addRecording,
	archiveFigure,
	createFigure,
	deleteRecording,
	getFigure,
	listFigures,
	updateFigure
} from './figures';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const figureInput = {
	name: 'Dile que no',
	partner: 'partner' as const,
	style: 'salsa' as const,
	notes: null
};
const bareSet = (exerciseId: number, doneAt: number) => ({
	exerciseId,
	doneAt,
	durationS: null,
	reps: null,
	rating: null,
	note: null
});

describe('figures', () => {
	it('creates the figure and its exercise together', () => {
		const { figure, exercise } = createFigure(db, figureInput);
		expect(exercise.figureId).toBe(figure.id);
		expect(exercise.source).toBe('figure');
		expect(exercise.name).toBe('Dile que no');
		expect(listExercises(db).map((e) => e.partner)).toEqual(['partner']);
	});

	it('carries a rename over to the exercise', () => {
		const { figure } = createFigure(db, figureInput);
		updateFigure(db, figure.id, { ...figureInput, name: 'Dile que no (con vuelta)' });
		expect(listExercises(db)[0].name).toBe('Dile que no (con vuelta)');
	});

	it('archives the exercise with the figure, keeping the sets', () => {
		const { figure, exercise } = createFigure(db, figureInput);
		logSet(db, bareSet(exercise.id, 1000));
		expect(archiveFigure(db, figure.id, 2000)).toBe(true);
		expect(listExercises(db)).toHaveLength(0);
		expect(listFigures(db)).toHaveLength(0);
		expect(listSetTimes(db)).toHaveLength(1);
		expect(archiveFigure(db, figure.id, 3000)).toBe(false);
	});

	it('filters and counts recordings', () => {
		const { figure } = createFigure(db, figureInput);
		createFigure(db, { ...figureInput, name: 'Son basic', partner: 'solo', style: 'son' });
		addRecording(db, {
			figureId: figure.id,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 10,
			note: null
		});
		expect(listFigures(db).map((f) => [f.name, f.recordings])).toEqual([
			['Dile que no', 1],
			['Son basic', 0]
		]);
		expect(listFigures(db, { style: 'son' }).map((f) => f.name)).toEqual(['Son basic']);
		expect(listFigures(db, { partner: 'partner' }).map((f) => f.name)).toEqual(['Dile que no']);
		expect(listFigures(db, { q: 'dile' }).map((f) => f.name)).toEqual(['Dile que no']);
	});

	it('returns a deleted recording so its file can be removed', () => {
		const { figure } = createFigure(db, figureInput);
		const rec = addRecording(db, {
			figureId: figure.id,
			file: 'b.webm',
			mime: 'video/webm',
			kind: 'video',
			sizeBytes: 10,
			note: null
		});
		expect(deleteRecording(db, rec.id)?.file).toBe('b.webm');
		expect(getFigure(db, figure.id)?.recordings).toHaveLength(0);
		expect(deleteRecording(db, rec.id)).toBeNull();
	});
});

describe('exercises and sets', () => {
	it('logs and deletes sets', () => {
		const ex = createCustomExercise(db, { name: 'Clave clapping', everyDays: 1, notes: null });
		const s = logSet(db, { ...bareSet(ex.id, 5000), reps: 3, rating: 4 });
		logSet(db, bareSet(ex.id, 6000));
		expect(listSetsBetween(db, 0, 10_000).map((r) => r.doneAt)).toEqual([6000, 5000]);
		expect(listSetsBetween(db, 5500, 10_000)).toHaveLength(1);
		expect(deleteSet(db, s.id)).toBe(true);
		expect(listSetTimes(db)).toEqual([{ exerciseId: ex.id, doneAt: 6000 }]);
	});

	it('refuses a rating outside 1–5', () => {
		const ex = createCustomExercise(db, { name: 'x', everyDays: 1, notes: null });
		expect(() => logSet(db, { ...bareSet(ex.id, 1), rating: 6 })).toThrow();
	});

	it('keeps a figure exercise named after its figure', () => {
		const { exercise } = createFigure(db, figureInput);
		updateExercise(db, exercise.id, { name: 'Other', everyDays: 1, active: false, notes: 'n' });
		const [row] = listExercises(db);
		expect(row.name).toBe('Dile que no');
		expect(row.everyDays).toBe(1);
		expect(row.active).toBe(false);
	});

	it('archives custom exercises only', () => {
		const custom = createCustomExercise(db, { name: 'c', everyDays: 3, notes: null });
		const { exercise } = createFigure(db, figureInput);
		expect(archiveExercise(db, exercise.id, 1)).toBe(false);
		expect(archiveExercise(db, custom.id, 1)).toBe(true);
		expect(listExercises(db).map((e) => e.id)).toEqual([exercise.id]);
	});
});
