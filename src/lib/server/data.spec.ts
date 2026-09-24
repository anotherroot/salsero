import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { songs } from './db/schema';
import {
	archiveExercise,
	createCustomExercise,
	deleteSet,
	getExercise,
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
	listCallableFigures,
	listFigures,
	updateFigure
} from './figures';
import { createSongFromUpload, listReadySongs } from './songs';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const figureInput = {
	name: 'Dile que no',
	partner: 'partner' as const,
	style: 'salsa' as const,
	notes: null,
	callable: true,
	callText: null
};
const bareSet = (exerciseId: number, doneAt: number) => ({
	exerciseId,
	doneAt,
	durationS: null,
	reps: null,
	rating: null,
	note: null,
	playerJson: null
});
/** The practice-mode fields `updateExercise` needs, beyond the plain settings form. */
const base = { practiceMode: 'none' as const, songId: null, countBpm: null };

describe('figures', () => {
	it('creates the figure and its exercise together', () => {
		const { figure, exercise } = createFigure(db, 'salsa', figureInput)!;
		expect(exercise.figureId).toBe(figure.id);
		expect(exercise.source).toBe('figure');
		expect(exercise.name).toBe('Dile que no');
		expect(listExercises(db, 'salsa').map((e) => e.partner)).toEqual(['partner']);
	});

	it('carries a rename over to the exercise', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		updateFigure(db, figure.id, { ...figureInput, name: 'Dile que no (con vuelta)' });
		expect(listExercises(db, 'salsa')[0].name).toBe('Dile que no (con vuelta)');
	});

	it('archives the exercise with the figure, keeping the sets', () => {
		const { figure, exercise } = createFigure(db, 'salsa', figureInput)!;
		logSet(db, bareSet(exercise.id, 1000));
		expect(archiveFigure(db, figure.id, 2000)).toBe(true);
		expect(listExercises(db, 'salsa')).toHaveLength(0);
		expect(listFigures(db, 'salsa')).toHaveLength(0);
		expect(listSetTimes(db, 'salsa')).toHaveLength(1);
		expect(archiveFigure(db, figure.id, 3000)).toBe(false);
	});

	it('filters and counts recordings', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		createFigure(db, 'salsa', { ...figureInput, name: 'Son basic', partner: 'solo', style: 'son' });
		addRecording(db, {
			figureId: figure.id,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 10,
			note: null
		});
		expect(listFigures(db, 'salsa').map((f) => [f.name, f.recordings])).toEqual([
			['Dile que no', 1],
			['Son basic', 0]
		]);
		expect(listFigures(db, 'salsa', { style: 'son' }).map((f) => f.name)).toEqual(['Son basic']);
		expect(listFigures(db, 'salsa', { partner: 'partner' }).map((f) => f.name)).toEqual([
			'Dile que no'
		]);
		expect(listFigures(db, 'salsa', { q: 'dile' }).map((f) => f.name)).toEqual(['Dile que no']);
	});

	it('returns a deleted recording so its file can be removed', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
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
		const ex = createCustomExercise(db, 'salsa', {
			name: 'Clave clapping',
			everyDays: 1,
			notes: null
		});
		const s = logSet(db, { ...bareSet(ex.id, 5000), reps: 3, rating: 4 });
		logSet(db, bareSet(ex.id, 6000));
		expect(listSetsBetween(db, 0, 10_000, 'salsa').map((r) => r.doneAt)).toEqual([6000, 5000]);
		expect(listSetsBetween(db, 5500, 10_000, 'salsa')).toHaveLength(1);
		expect(deleteSet(db, s.id)).toBe(true);
		expect(listSetTimes(db, 'salsa')).toEqual([{ exerciseId: ex.id, doneAt: 6000 }]);
	});

	it('refuses a rating outside 1–5', () => {
		const ex = createCustomExercise(db, 'salsa', { name: 'x', everyDays: 1, notes: null });
		expect(() => logSet(db, { ...bareSet(ex.id, 1), rating: 6 })).toThrow();
	});

	it('keeps a figure exercise named after its figure', () => {
		const { exercise } = createFigure(db, 'salsa', figureInput)!;
		updateExercise(db, exercise.id, {
			...base,
			name: 'Other',
			everyDays: 1,
			active: false,
			notes: 'n'
		});
		const [row] = listExercises(db, 'salsa');
		expect(row.name).toBe('Dile que no');
		expect(row.everyDays).toBe(1);
		expect(row.active).toBe(false);
	});

	it('archives custom exercises only', () => {
		const custom = createCustomExercise(db, 'salsa', { name: 'c', everyDays: 3, notes: null });
		const { exercise } = createFigure(db, 'salsa', figureInput)!;
		expect(archiveExercise(db, exercise.id, 1)).toBe(false);
		expect(archiveExercise(db, custom.id, 1)).toBe(true);
		expect(listExercises(db, 'salsa').map((e) => e.id)).toEqual([exercise.id]);
	});

	it('lists only callable, unarchived figures, and says callText when set', () => {
		const a = createFigure(db, 'salsa', { ...figureInput, name: 'Enchufla' })!;
		createFigure(db, 'salsa', { ...figureInput, name: 'Hidden', partner: 'solo', callable: false });
		const c = createFigure(db, 'salsa', {
			...figureInput,
			name: 'Dile que no',
			callText: 'dee-lay kay no'
		})!;
		archiveFigure(db, a.figure.id, Date.now());

		const out = listCallableFigures(db, 'salsa');
		expect(out.map((f) => f.name)).toEqual(['Dile que no']);
		expect(out[0].say).toBe('dee-lay kay no');
		expect(c.figure.id).toBe(out[0].id);
	});

	it('clears the unused practice column when the mode changes', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		updateExercise(db, e.id, {
			...base,
			name: 'Drill',
			everyDays: 1,
			active: true,
			notes: null,
			practiceMode: 'count',
			songId: null,
			countBpm: 180
		});
		expect(getExercise(db, e.id)?.countBpm).toBe(180);
		updateExercise(db, e.id, {
			...base,
			name: 'Drill',
			everyDays: 1,
			active: true,
			notes: null,
			practiceMode: 'none',
			songId: null,
			countBpm: 180
		});
		expect(getExercise(db, e.id)?.countBpm).toBeNull();
	});

	it('keeps a player run on its set', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		const s = logSet(db, {
			...bareSet(e.id, 1),
			durationS: 300,
			playerJson: '{"speed":0.8}'
		});
		expect(JSON.parse(s.playerJson!).speed).toBe(0.8);
	});
});

describe('figures are walled off by dance', () => {
	const bachataInput = { ...figureInput, name: 'Basico', style: 'sensual' };

	it('lists only its own dance', () => {
		createFigure(db, 'salsa', figureInput);
		createFigure(db, 'bachata', bachataInput);

		expect(listFigures(db, 'salsa').map((f) => f.name)).toEqual(['Dile que no']);
		expect(listFigures(db, 'bachata').map((f) => f.name)).toEqual(['Basico']);
	});

	it('gives the figure exercise its figure dance', () => {
		const made = createFigure(db, 'bachata', bachataInput);
		expect(made).not.toBeNull();
		expect(getExercise(db, made!.exercise.id)?.dance).toBe('bachata');
	});

	it('refuses a style that belongs to another dance', () => {
		expect(createFigure(db, 'bachata', { ...bachataInput, style: 'son' })).toBeNull();
		expect(createFigure(db, 'salsa', { ...figureInput, style: 'sensual' })).toBeNull();
		expect(listFigures(db, 'salsa')).toEqual([]);
		expect(listFigures(db, 'bachata')).toEqual([]);
	});

	it('refuses an edit that moves a figure outside its dance styles', () => {
		const made = createFigure(db, 'salsa', figureInput)!;
		expect(updateFigure(db, made.figure.id, { ...figureInput, style: 'sensual' })).toBeNull();
		expect(listFigures(db, 'salsa')[0].style).toBe('salsa');
	});

	it('a figure knows the dance it belongs to, so a loader can refuse it', () => {
		const made = createFigure(db, 'bachata', bachataInput)!;
		expect(getFigure(db, made.figure.id)?.figure.dance).toBe('bachata');
	});

	it('calls only its own dance figures', () => {
		createFigure(db, 'salsa', figureInput);
		createFigure(db, 'bachata', bachataInput);
		expect(listCallableFigures(db, 'bachata').map((f) => f.name)).toEqual(['Basico']);
	});
});

describe('Today is walled off by dance', () => {
	it('never shows another dance exercise, set or song', () => {
		const salsa = createFigure(db, 'salsa', figureInput)!;
		const bachata = createFigure(db, 'bachata', {
			...figureInput,
			name: 'Basico',
			style: 'sensual'
		})!;
		logSet(db, bareSet(salsa.exercise.id, 1_000));
		logSet(db, bareSet(bachata.exercise.id, 2_000));

		expect(listExercises(db, 'salsa').map((e) => e.name)).toEqual(['Dile que no']);
		expect(listExercises(db, 'bachata').map((e) => e.name)).toEqual(['Basico']);

		expect(listSetTimes(db, 'salsa')).toEqual([{ exerciseId: salsa.exercise.id, doneAt: 1_000 }]);
		expect(listSetTimes(db, 'bachata')).toEqual([
			{ exerciseId: bachata.exercise.id, doneAt: 2_000 }
		]);

		expect(listSetsBetween(db, 0, 10_000, 'bachata').map((s) => s.exerciseName)).toEqual([
			'Basico'
		]);
	});

	it('creates a custom exercise into the dance it was asked for', () => {
		const made = createCustomExercise(db, 'bachata', {
			name: 'Footwork',
			everyDays: 2,
			notes: null
		});
		expect(made.dance).toBe('bachata');
		expect(listExercises(db, 'salsa')).toEqual([]);
		expect(listExercises(db, 'bachata').map((e) => e.name)).toEqual(['Footwork']);
	});

	it('refuses to point an exercise at a song from another dance', () => {
		const song = createSongFromUpload(db, 'salsa', {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'El Cantante',
			style: 'salsa'
		});
		const ex = createCustomExercise(db, 'bachata', { name: 'Footwork', everyDays: 2, notes: null });

		const updated = updateExercise(db, ex.id, {
			name: 'Footwork',
			practiceMode: 'song',
			songId: song.id,
			countBpm: null,
			everyDays: 2,
			active: true,
			notes: null
		});
		expect(updated?.songId).toBeNull();
	});

	it('offers only its own dance ready songs to the picker', () => {
		createSongFromUpload(db, 'salsa', {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'El Cantante',
			style: 'salsa'
		});
		createSongFromUpload(db, 'bachata', {
			file: 'b.m4a',
			mime: 'audio/mp4',
			title: 'Obsesion',
			style: 'salsa'
		});
		// createSongFromUpload leaves status 'waiting_analysis'; mark both ready.
		db.update(songs).set({ status: 'ready' }).run();

		expect(listReadySongs(db, 'bachata').map((s) => s.title)).toEqual(['Obsesion']);
	});
});
