import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { songs } from './db/schema';
import {
	archiveExercise,
	createCustomExercise,
	deleteSet,
	exerciseHistory,
	exerciseSummary,
	getExercise,
	lastSet,
	lastSets,
	listExercises,
	listSetTimes,
	listSetsBetween,
	logSet,
	setPracticeSettings,
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
	listFiguresForCall,
	updateFigure
} from './figures';
import { archiveLesson, createLesson, linkFigure, taughtIn } from './lessons';
import { createSongFromUpload, listReadySongs } from './songs';
import { createRoutine } from './routines';

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
	durationS: null as number | null,
	reps: null as number | null,
	rating: null as number | null,
	note: null as string | null,
	playerJson: null as string | null
});
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

	it("carries a routine's exercise routineId through listExercises, and leaves it null elsewhere", () => {
		const { routine, exercise } = createRoutine(db, 'salsa', { name: 'Combo', notes: null });
		const custom = createCustomExercise(db, 'salsa', { name: 'c', everyDays: 3, notes: null });
		const rows = listExercises(db, 'salsa');
		const routineRow = rows.find((r) => r.id === exercise.id)!;
		expect(routineRow.source).toBe('routine');
		expect(routineRow.routineId).toBe(routine.id);
		const customRow = rows.find((r) => r.id === custom.id)!;
		expect(customRow.routineId).toBeNull();
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

	it('names the figures a routine asks for by id, callable or not', () => {
		const plain = createFigure(db, 'salsa', { ...figureInput, name: 'Enchufla' })!;
		const hidden = createFigure(db, 'salsa', {
			...figureInput,
			name: 'Setenta',
			callable: false,
			callText: 'seh-ten-ta'
		})!;
		const gone = createFigure(db, 'salsa', { ...figureInput, name: 'Vacilala' })!;
		createFigure(db, 'salsa', figureInput);
		archiveFigure(db, gone.figure.id, Date.now());

		const out = listFiguresForCall(db, 'salsa', [
			plain.figure.id,
			hidden.figure.id,
			gone.figure.id
		]);
		// The uncallable one IS named — a routine names its figures explicitly —
		// while the archived one, and the figure nobody asked for, are not.
		expect(out.map((f) => f.name)).toEqual(['Enchufla', 'Setenta']);
		expect(out.find((f) => f.id === hidden.figure.id)?.say).toBe('seh-ten-ta');
	});

	// A routine with no options at all asks for nothing, and must get nothing —
	// never the whole repertoire. This pins the contract rather than the early
	// return that implements it: drizzle renders `inArray(col, [])` as a false
	// condition, so today the query would answer the same way on its own.
	it('names nothing for an empty id list', () => {
		createFigure(db, 'salsa', figureInput);
		expect(listFiguresForCall(db, 'salsa', [])).toEqual([]);
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

	it('names only its own dance figures when a routine asks by id', () => {
		const salsa = createFigure(db, 'salsa', figureInput)!;
		const bachata = createFigure(db, 'bachata', bachataInput)!;
		// Both ids, both times: a routine's option list reaches the player as bare
		// numbers, so the dance has to be what decides, not the caller's honesty.
		const ids = [salsa.figure.id, bachata.figure.id];
		expect(listFiguresForCall(db, 'salsa', ids).map((f) => f.name)).toEqual(['Dile que no']);
		expect(listFiguresForCall(db, 'bachata', ids).map((f) => f.name)).toEqual(['Basico']);
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

describe('practice settings', () => {
	const config = {
		count: 'son' as const,
		clave: '2-3' as const,
		speed: 1 as const,
		callEvery: null
	};
	const readySong = (dance: 'salsa' | 'bachata') => {
		const s = createSongFromUpload(db, dance, {
			file: `${dance}.m4a`,
			mime: 'audio/mp4',
			title: 'Song',
			style: 'salsa'
		});
		db.update(songs).set({ status: 'ready' }).where(eq(songs.id, s.id)).run();
		return s;
	};

	it('stores count mode with its tempo and config, clearing the song', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		expect(
			setPracticeSettings(db, e.id, { mode: 'count', songId: null, countBpm: 150, config })
		).toBe(true);
		const row = getExercise(db, e.id)!;
		expect([row.practiceMode, row.countBpm, row.songId]).toEqual(['count', 150, null]);
		expect(JSON.parse(row.practiceJson!)).toEqual(config);
	});

	it('stores a ready song of the same dance, clearing the tempo', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		const song = readySong('salsa');
		expect(
			setPracticeSettings(db, e.id, { mode: 'song', songId: song.id, countBpm: null, config })
		).toBe(true);
		expect(getExercise(db, e.id)?.songId).toBe(song.id);
	});

	it('refuses a song from the other dance, or one that is not ready', () => {
		const e = createCustomExercise(db, 'bachata', { name: 'Footwork', everyDays: 2, notes: null });
		const salsaSong = readySong('salsa');
		expect(
			setPracticeSettings(db, e.id, { mode: 'song', songId: salsaSong.id, countBpm: null, config })
		).toBe(false);
		const waiting = createSongFromUpload(db, 'bachata', {
			file: 'w.m4a',
			mime: 'audio/mp4',
			title: 'W',
			style: 'sensual'
		});
		expect(
			setPracticeSettings(db, e.id, { mode: 'song', songId: waiting.id, countBpm: null, config })
		).toBe(false);
		expect(getExercise(db, e.id)?.practiceMode).toBe('none');
	});
});

describe('history', () => {
	const set = (
		exerciseId: number,
		doneAt: number,
		extra: Partial<ReturnType<typeof bareSet>> = {}
	) => logSet(db, { ...bareSet(exerciseId, doneAt), ...extra });

	it('lists an exercise’s sets newest first, capped', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		for (let i = 1; i <= 5; i++) set(e.id, i * 1000);
		expect(exerciseHistory(db, e.id, 3).map((s) => s.doneAt)).toEqual([5000, 4000, 3000]);
	});

	it('summarises every set, and averages the latest five rated ones', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		set(e.id, 1, { rating: 1, durationS: 60 });
		for (let i = 2; i <= 6; i++) set(e.id, i, { rating: 4, durationS: 120 });
		set(e.id, 7); // unrated, no duration
		expect(exerciseSummary(db, e.id)).toEqual({ sets: 7, totalS: 660, recentRating: 4 });
	});

	it('summarises an exercise with no sets', () => {
		const e = createCustomExercise(db, 'salsa', { name: 'Drill', everyDays: 1, notes: null });
		expect(exerciseSummary(db, e.id)).toEqual({ sets: 0, totalS: 0, recentRating: null });
	});

	it('finds the latest set per exercise, within one dance', () => {
		const a = createCustomExercise(db, 'salsa', { name: 'A', everyDays: 1, notes: null });
		const b = createCustomExercise(db, 'bachata', { name: 'B', everyDays: 1, notes: null });
		set(a.id, 1000, { rating: 2 });
		set(a.id, 3000, { rating: 5, note: 'clean' });
		set(b.id, 2000, { rating: 1 });
		const last = lastSets(db, 'salsa');
		expect([...last.keys()]).toEqual([a.id]);
		expect(last.get(a.id)).toMatchObject({ doneAt: 3000, rating: 5, note: 'clean' });
		expect(lastSet(db, a.id)?.doneAt).toBe(3000);
		expect(
			lastSet(db, createCustomExercise(db, 'salsa', { name: 'C', everyDays: 1, notes: null }).id)
		).toBeNull();
	});
});

describe('taught in', () => {
	it('lists the live lessons that linked a figure, newest first', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		const older = createLesson(db, 'salsa', {
			lessonDay: '2026-09-01',
			title: 'Older',
			notes: null
		}).lesson;
		const newer = createLesson(db, 'salsa', {
			lessonDay: '2026-09-20',
			title: 'Newer',
			notes: null
		}).lesson;
		const gone = createLesson(db, 'salsa', {
			lessonDay: '2026-09-10',
			title: 'Gone',
			notes: null
		}).lesson;
		for (const l of [older, newer, gone]) linkFigure(db, l.id, figure.id);
		archiveLesson(db, gone.id, 1);
		expect(taughtIn(db, figure.id).map((l) => l.title)).toEqual(['Newer', 'Older']);
	});
});
