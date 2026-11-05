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
	listExercises,
	listSetTimes,
	listSetsBetween,
	logSet,
	setPracticeSettings,
	updateExercise
} from './exercises';
import {
	addFigureExercise,
	addRecording,
	archiveVariation,
	createFigure,
	createVariationFrom,
	deleteRecording,
	getFigure,
	listFigures,
	listFiguresForCall,
	renameFigure,
	updateVariation
} from './figures';
import { archiveLesson, createLesson, linkFigure, taughtIn } from './lessons';
import { createSongFromUpload, songChoices } from './songs';
import { createRoutine } from './routines';
import { T1_SALSA, U1_SALSA, U1_BACHATA } from '$lib/server/test-walls';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const figureInput = {
	figureName: 'Dile que no',
	name: 'Basic',
	partner: 'partner' as const,
	style: 'salsa' as const,
	notes: null
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
	it('creates a figure without an exercise', () => {
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		expect(getFigure(db, figure.id, 'u1')?.exercise).toBeNull();
		expect(listExercises(db, U1_SALSA)).toEqual([]);
	});

	it('adds a figure exercise on request, with the figure name and dance', () => {
		const { figure } = createFigure(db, U1_BACHATA, { ...figureInput, style: 'sensual' })!;
		const exercise = addFigureExercise(db, 'u1', figure.id, 7)!;
		expect(exercise).toMatchObject({
			name: 'Dile que no · Basic',
			source: 'figure',
			figureId: figure.id,
			dance: 'bachata',
			everyDays: 7
		});
		expect(getFigure(db, figure.id, 'u1')?.exercise?.id).toBe(exercise.id);
		expect(listExercises(db, U1_BACHATA).map((e) => e.partner)).toEqual(['partner']);
	});

	it('refuses a variation that already has one, an archived or missing variation', () => {
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		addFigureExercise(db, 'u1', figure.id);
		expect(addFigureExercise(db, 'u1', figure.id)).toBeNull();

		// A second variation may have its own exercise, named with its label.
		const v = createVariationFrom(db, figure.id, 'Doble')!;
		expect(addFigureExercise(db, 'u1', v.id)?.name).toBe('Dile que no · Doble');

		const gone = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Gone' })!.figure;
		archiveVariation(db, gone.id, 1);
		expect(addFigureExercise(db, 'u1', gone.id)).toBeNull();

		expect(addFigureExercise(db, 'u1', 9999)).toBeNull();
		expect(listExercises(db, U1_SALSA)).toHaveLength(2);
	});

	it('renames and archives the exercise with its variation only when there is one', () => {
		const bare = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Bare' })!.figure;
		expect(updateVariation(db, bare.id, { ...figureInput, name: 'Bare 2' })?.name).toBe('Bare 2');
		expect(archiveVariation(db, bare.id, 1)).toEqual({ figureRemoved: true });

		const owned = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Owned' })!;
		const exercise = addFigureExercise(db, 'u1', owned.figure.id)!;
		updateVariation(db, owned.figure.id, { ...figureInput, name: 'Owned 2' });
		expect(getExercise(db, exercise.id)?.name).toBe('Owned · Owned 2');
		archiveVariation(db, owned.figure.id, 5);
		expect(getExercise(db, exercise.id)?.archivedAt).toBe(5);
	});

	it('carries a variation rename and a figure rename over to the exercise', () => {
		const { figure, group } = createFigure(db, U1_SALSA, figureInput)!;
		addFigureExercise(db, 'u1', figure.id);
		updateVariation(db, figure.id, { ...figureInput, name: 'Con vuelta' });
		expect(listExercises(db, U1_SALSA)[0].name).toBe('Dile que no · Con vuelta');
		expect(renameFigure(db, group.id, 'Dile que si')).toBe(true);
		expect(listExercises(db, U1_SALSA)[0].name).toBe('Dile que si · Con vuelta');
	});

	it('archives the exercise with the variation, keeping the sets', () => {
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const exercise = addFigureExercise(db, 'u1', figure.id)!;
		logSet(db, bareSet(exercise.id, 1000));
		expect(archiveVariation(db, figure.id, 2000)).toEqual({ figureRemoved: true });
		expect(listExercises(db, U1_SALSA)).toHaveLength(0);
		expect(listFigures(db, U1_SALSA)).toHaveLength(0);
		expect(listSetTimes(db, U1_SALSA)).toHaveLength(1);
		expect(archiveVariation(db, figure.id, 3000)).toBeNull();
	});

	it('filters and counts recordings', () => {
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		createFigure(db, U1_SALSA, {
			...figureInput,
			figureName: 'Son basic',
			partner: 'solo',
			style: 'son'
		});
		addRecording(db, {
			figureId: figure.id,
			file: 'a.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 10,
			note: null
		});
		expect(listFigures(db, U1_SALSA).map((m) => [m.name, m.figures[0].recordings])).toEqual([
			['Dile que no', 1],
			['Son basic', 0]
		]);
		expect(listFigures(db, U1_SALSA, { style: 'son' }).map((f) => f.name)).toEqual(['Son basic']);
		expect(listFigures(db, U1_SALSA, { partner: 'partner' }).map((f) => f.name)).toEqual([
			'Dile que no'
		]);
		expect(listFigures(db, U1_SALSA, { q: 'dile' }).map((f) => f.name)).toEqual(['Dile que no']);
	});

	it('returns a deleted recording so its file can be removed', () => {
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const rec = addRecording(db, {
			figureId: figure.id,
			file: 'b.webm',
			mime: 'video/webm',
			kind: 'video',
			sizeBytes: 10,
			note: null
		});
		expect(deleteRecording(db, rec.id)?.file).toBe('b.webm');
		expect(getFigure(db, figure.id, 'u1')?.recordings).toHaveLength(0);
		expect(deleteRecording(db, rec.id)).toBeNull();
	});
});

describe('exercises and sets', () => {
	it('logs and deletes sets', () => {
		const ex = createCustomExercise(db, U1_SALSA, {
			name: 'Clave clapping',
			everyDays: 1,
			notes: null
		});
		const s = logSet(db, { ...bareSet(ex.id, 5000), reps: 3, rating: 4 });
		logSet(db, bareSet(ex.id, 6000));
		expect(listSetsBetween(db, 0, 10_000, U1_SALSA).map((r) => r.doneAt)).toEqual([6000, 5000]);
		expect(listSetsBetween(db, 5500, 10_000, U1_SALSA)).toHaveLength(1);
		expect(deleteSet(db, s.id)).toBe(true);
		expect(listSetTimes(db, U1_SALSA)).toEqual([{ exerciseId: ex.id, doneAt: 6000 }]);
	});

	it('refuses a rating outside 1–5', () => {
		const ex = createCustomExercise(db, U1_SALSA, { name: 'x', everyDays: 1, notes: null });
		expect(() => logSet(db, { ...bareSet(ex.id, 1), rating: 6 })).toThrow();
	});

	it('keeps a figure exercise named after its figure', () => {
		const exercise = addFigureExercise(
			db,
			'u1',
			createFigure(db, U1_SALSA, figureInput)!.figure.id
		)!;
		updateExercise(db, exercise.id, {
			name: 'Other',
			everyDays: 1,
			active: false,
			notes: 'n'
		});
		const [row] = listExercises(db, U1_SALSA);
		expect(row.name).toBe('Dile que no · Basic');
		expect(row.everyDays).toBe(1);
		expect(row.active).toBe(false);
	});

	it('archives custom exercises only', () => {
		const custom = createCustomExercise(db, U1_SALSA, { name: 'c', everyDays: 3, notes: null });
		const exercise = addFigureExercise(
			db,
			'u1',
			createFigure(db, U1_SALSA, figureInput)!.figure.id
		)!;
		expect(archiveExercise(db, exercise.id, 1)).toBe(false);
		expect(archiveExercise(db, custom.id, 1)).toBe(true);
		expect(listExercises(db, U1_SALSA).map((e) => e.id)).toEqual([exercise.id]);
	});

	it("carries a routine's exercise routineId through listExercises, and leaves it null elsewhere", () => {
		const { routine, exercise } = createRoutine(db, U1_SALSA, { name: 'Combo', notes: null });
		const custom = createCustomExercise(db, U1_SALSA, { name: 'c', everyDays: 3, notes: null });
		const rows = listExercises(db, U1_SALSA);
		const routineRow = rows.find((r) => r.id === exercise.id)!;
		expect(routineRow.source).toBe('routine');
		expect(routineRow.routineId).toBe(routine.id);
		const customRow = rows.find((r) => r.id === custom.id)!;
		expect(customRow.routineId).toBeNull();
	});

	it('names and says the figures a routine asks for by id', () => {
		const plain = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Enchufla' })!;
		const other = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Setenta' })!;
		const gone = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Vacilala' })!;
		createFigure(db, U1_SALSA, figureInput);
		archiveVariation(db, gone.figure.id, Date.now());

		const out = listFiguresForCall(db, U1_SALSA, [
			plain.figure.id,
			other.figure.id,
			gone.figure.id
		]);
		// The archived one, and the figure nobody asked for, are not named.
		expect(out.map((f) => f.name)).toEqual(['Enchufla · Basic', 'Setenta · Basic']);
		expect(out.find((f) => f.id === other.figure.id)?.say).toBe('Setenta');
	});

	// A routine with no options at all asks for nothing, and must get nothing —
	// never the whole repertoire. This pins the contract rather than the early
	// return that implements it: drizzle renders `inArray(col, [])` as a false
	// condition, so today the query would answer the same way on its own.
	it('names nothing for an empty id list', () => {
		createFigure(db, U1_SALSA, figureInput);
		expect(listFiguresForCall(db, U1_SALSA, [])).toEqual([]);
	});

	it('keeps a player run on its set', () => {
		const e = createCustomExercise(db, U1_SALSA, { name: 'Drill', everyDays: 1, notes: null });
		const s = logSet(db, {
			...bareSet(e.id, 1),
			durationS: 300,
			playerJson: '{"speed":0.8}'
		});
		expect(JSON.parse(s.playerJson!).speed).toBe(0.8);
	});
});

describe('figures are walled off by dance', () => {
	const bachataInput = { ...figureInput, figureName: 'Basico', style: 'sensual' };

	it('lists only its own dance', () => {
		createFigure(db, U1_SALSA, figureInput);
		createFigure(db, U1_BACHATA, bachataInput);

		expect(listFigures(db, U1_SALSA).map((f) => f.name)).toEqual(['Dile que no']);
		expect(listFigures(db, U1_BACHATA).map((f) => f.name)).toEqual(['Basico']);
	});

	it('gives the figure exercise its figure dance', () => {
		const made = createFigure(db, U1_BACHATA, bachataInput);
		expect(made).not.toBeNull();
		const exercise = addFigureExercise(db, 'u1', made!.figure.id)!;
		expect(getExercise(db, exercise.id)?.dance).toBe('bachata');
	});

	it('refuses a style that belongs to another dance', () => {
		expect(createFigure(db, U1_BACHATA, { ...bachataInput, style: 'son' })).toBeNull();
		expect(createFigure(db, U1_SALSA, { ...figureInput, style: 'sensual' })).toBeNull();
		expect(listFigures(db, U1_SALSA)).toEqual([]);
		expect(listFigures(db, U1_BACHATA)).toEqual([]);
	});

	it('refuses an edit that moves a figure outside its dance styles', () => {
		const made = createFigure(db, U1_SALSA, figureInput)!;
		expect(updateVariation(db, made.figure.id, { ...figureInput, style: 'sensual' })).toBeNull();
		expect(getFigure(db, made.figure.id, 'u1')?.figure.styleTag).toBe('salsa');
	});

	it('a figure knows the dance it belongs to, so a loader can refuse it', () => {
		const made = createFigure(db, U1_BACHATA, bachataInput)!;
		expect(getFigure(db, made.figure.id, 'u1')?.figure.dance).toBe('bachata');
	});

	it('names only its own dance figures when a routine asks by id', () => {
		const salsa = createFigure(db, U1_SALSA, figureInput)!;
		const bachata = createFigure(db, U1_BACHATA, bachataInput)!;
		// Both ids, both times: a routine's option list reaches the player as bare
		// numbers, so the dance has to be what decides, not the caller's honesty.
		const ids = [salsa.figure.id, bachata.figure.id];
		expect(listFiguresForCall(db, U1_SALSA, ids).map((f) => f.name)).toEqual([
			'Dile que no · Basic'
		]);
		expect(listFiguresForCall(db, U1_BACHATA, ids).map((f) => f.name)).toEqual(['Basico · Basic']);
	});
});

describe('Today is walled off by dance', () => {
	it('never shows another dance exercise, set or song', () => {
		const salsa = createFigure(db, U1_SALSA, figureInput)!;
		const bachata = createFigure(db, U1_BACHATA, {
			...figureInput,
			figureName: 'Basico',
			style: 'sensual'
		})!;
		const salsaExercise = addFigureExercise(db, 'u1', salsa.figure.id)!;
		const bachataExercise = addFigureExercise(db, 'u1', bachata.figure.id)!;
		logSet(db, bareSet(salsaExercise.id, 1_000));
		logSet(db, bareSet(bachataExercise.id, 2_000));

		expect(listExercises(db, U1_SALSA).map((e) => e.name)).toEqual(['Dile que no · Basic']);
		expect(listExercises(db, U1_BACHATA).map((e) => e.name)).toEqual(['Basico · Basic']);

		expect(listSetTimes(db, U1_SALSA)).toEqual([{ exerciseId: salsaExercise.id, doneAt: 1_000 }]);
		expect(listSetTimes(db, U1_BACHATA)).toEqual([
			{ exerciseId: bachataExercise.id, doneAt: 2_000 }
		]);

		expect(listSetsBetween(db, 0, 10_000, U1_BACHATA).map((s) => s.exerciseName)).toEqual([
			'Basico · Basic'
		]);
	});

	it('creates a custom exercise into the dance it was asked for', () => {
		const made = createCustomExercise(db, U1_BACHATA, {
			name: 'Footwork',
			everyDays: 2,
			notes: null
		});
		expect(made.dance).toBe('bachata');
		expect(listExercises(db, U1_SALSA)).toEqual([]);
		expect(listExercises(db, U1_BACHATA).map((e) => e.name)).toEqual(['Footwork']);
	});

	it('offers only its own dance ready songs to the picker', () => {
		createSongFromUpload(db, U1_SALSA, {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'El Cantante',
			style: 'salsa'
		});
		createSongFromUpload(db, U1_BACHATA, {
			file: 'b.m4a',
			mime: 'audio/mp4',
			title: 'Obsesion',
			style: 'salsa'
		});
		// createSongFromUpload leaves status 'waiting_analysis'; mark both ready.
		db.update(songs).set({ status: 'ready' }).run();

		expect(songChoices(db, U1_BACHATA).map((s) => s.title)).toEqual(['Obsesion']);
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
		const s = createSongFromUpload(
			db,
			{ userId: 'u1', dance },
			{
				file: `${dance}.m4a`,
				mime: 'audio/mp4',
				title: 'Song',
				style: 'salsa'
			}
		);
		db.update(songs).set({ status: 'ready' }).where(eq(songs.id, s.id)).run();
		return s;
	};

	it('stores count mode with its tempo and config, clearing the song', () => {
		const e = createCustomExercise(db, U1_SALSA, { name: 'Drill', everyDays: 1, notes: null });
		expect(
			setPracticeSettings(db, e.id, { mode: 'count', songId: null, countBpm: 150, config })
		).toBe(true);
		const row = getExercise(db, e.id)!;
		expect([row.practiceMode, row.countBpm, row.songId]).toEqual(['count', 150, null]);
		expect(JSON.parse(row.practiceJson!)).toEqual(config);
	});

	it('stores a ready song of the same dance, clearing the tempo', () => {
		const e = createCustomExercise(db, U1_SALSA, { name: 'Drill', everyDays: 1, notes: null });
		const song = readySong('salsa');
		expect(
			setPracticeSettings(db, e.id, { mode: 'song', songId: song.id, countBpm: null, config })
		).toBe(true);
		expect(getExercise(db, e.id)?.songId).toBe(song.id);
	});

	it('refuses a song from the other dance, or one that is not ready', () => {
		const e = createCustomExercise(db, U1_BACHATA, { name: 'Footwork', everyDays: 2, notes: null });
		const salsaSong = readySong('salsa');
		expect(
			setPracticeSettings(db, e.id, { mode: 'song', songId: salsaSong.id, countBpm: null, config })
		).toBe(false);
		const waiting = createSongFromUpload(db, U1_BACHATA, {
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

	it("makes a group's drill with no song, and never stores one on it", () => {
		const e = createCustomExercise(db, T1_SALSA, {
			name: 'Group drill',
			everyDays: 1,
			notes: null
		});
		expect(e).toMatchObject({ userId: null, teamId: 1, songId: null, source: 'custom' });
		const song = readySong('salsa');
		expect(
			setPracticeSettings(db, e.id, { mode: 'song', songId: song.id, countBpm: null, config })
		).toBe(false);
		expect(
			setPracticeSettings(db, e.id, { mode: 'count', songId: null, countBpm: 150, config })
		).toBe(true);
	});
});

describe('history', () => {
	const set = (
		exerciseId: number,
		doneAt: number,
		extra: Partial<ReturnType<typeof bareSet>> = {}
	) => logSet(db, { ...bareSet(exerciseId, doneAt), ...extra });

	it('lists an exercise’s sets newest first, capped', () => {
		const e = createCustomExercise(db, U1_SALSA, { name: 'Drill', everyDays: 1, notes: null });
		for (let i = 1; i <= 5; i++) set(e.id, i * 1000);
		expect(exerciseHistory(db, e.id, 3).map((s) => s.doneAt)).toEqual([5000, 4000, 3000]);
	});

	it('summarises every set, and averages the latest five rated ones', () => {
		const e = createCustomExercise(db, U1_SALSA, { name: 'Drill', everyDays: 1, notes: null });
		set(e.id, 1, { rating: 1, durationS: 60 });
		for (let i = 2; i <= 6; i++) set(e.id, i, { rating: 4, durationS: 120 });
		set(e.id, 7); // unrated, no duration
		expect(exerciseSummary(db, e.id)).toEqual({ sets: 7, totalS: 660, recentRating: 4 });
	});

	it('summarises an exercise with no sets', () => {
		const e = createCustomExercise(db, U1_SALSA, { name: 'Drill', everyDays: 1, notes: null });
		expect(exerciseSummary(db, e.id)).toEqual({ sets: 0, totalS: 0, recentRating: null });
	});

	it("finds an exercise's latest set", () => {
		const a = createCustomExercise(db, U1_SALSA, { name: 'A', everyDays: 1, notes: null });
		set(a.id, 1000, { rating: 2 });
		set(a.id, 3000, { rating: 5, note: 'clean' });
		expect(lastSet(db, a.id)).toMatchObject({ doneAt: 3000, rating: 5, note: 'clean' });
		expect(
			lastSet(db, createCustomExercise(db, U1_SALSA, { name: 'C', everyDays: 1, notes: null }).id)
		).toBeNull();
	});
});

describe('taught in', () => {
	it('lists the live lessons that linked a figure, newest first', () => {
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const older = createLesson(db, U1_SALSA, {
			lessonDay: '2026-09-01',
			title: 'Older',
			notes: null
		}).lesson;
		const newer = createLesson(db, U1_SALSA, {
			lessonDay: '2026-09-20',
			title: 'Newer',
			notes: null
		}).lesson;
		const gone = createLesson(db, U1_SALSA, {
			lessonDay: '2026-09-10',
			title: 'Gone',
			notes: null
		}).lesson;
		for (const l of [older, newer, gone]) linkFigure(db, l.id, figure.id);
		archiveLesson(db, gone.id, 1);
		expect(taughtIn(db, U1_SALSA, figure.id).map((l) => l.title)).toEqual(['Newer', 'Older']);
	});
});
