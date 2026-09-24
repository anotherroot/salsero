/**
 * The dance wall, tested where it is actually reachable: the actions.
 *
 * Every id in a form body is just a number, so a POST to `/salsa` can carry a
 * bachata exercise, set, figure or song id — and the slug itself can be
 * anything, because a form action runs before the `[dance]` layout's gate.
 * These tests call the real load and action functions and assert a 404 AND
 * that the row is untouched; the second half is the point, because the failure
 * mode being guarded against is one that mutated and then reported a friendly
 * message.
 *
 * The actions reach the database through `getDb()`, which resolves its path
 * from `$env/dynamic/private` — and that does NOT see a `process.env`
 * assignment made from a test file. Mocking the module is therefore the only
 * way to be sure no test ever opens the real database: each test gets its own
 * `openDb(':memory:')`, the same way every other spec in this repo does.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { createFigure, getFigure } from '$lib/server/figures';
import {
	createCustomExercise,
	getExercise,
	getSet,
	listExercises,
	logSet
} from '$lib/server/exercises';
import { createSongFromUrl, failJob, getSong } from '$lib/server/songs';
import { createLesson, getLesson, listLessons } from '$lib/server/lessons';
import { figurePositions } from '$lib/server/graph';
import { listPositions, seedPositions } from '$lib/server/positions';
import { exercises, lessons, sets } from '$lib/server/db/schema';
import { actions as todayActions } from './+page.server';
import { actions as playerActions } from './player/+page.server';
import { actions as songListActions } from './songs/+page.server';
import { actions as lessonListActions } from './lessons/+page.server';
import * as figurePage from './figures/[id]/+page.server';
import * as songPage from './songs/[id]/+page.server';
import * as lessonPage from './lessons/[id]/+page.server';

const USER = { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana' };

/** The shape an action destructures, with nothing in it the actions do not read. */
function post(dance: string, fields: Record<string, string>, id = '') {
	return {
		params: { dance, id },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user: USER }
	};
}

type Invoke = (event: ReturnType<typeof post>) => Promise<unknown>;
const call = (action: unknown, event: ReturnType<typeof post>) => (action as Invoke)(event);

/** A page load only reads `params`, `url` and `locals` off its event. */
type Load = (e: { params: { dance: string; id: string }; url: URL; locals: unknown }) => unknown;
const loadAt = (load: unknown, dance: string, id: string) =>
	(load as Load)({
		params: { dance, id },
		url: new URL('http://localhost/'),
		locals: { user: USER }
	});

const threw404 = expect.objectContaining({ status: 404 });

/**
 * Call an action and assert it refused with a 404. Some actions are `async` and
 * some are not, so the 404 arrives as a rejection or as a synchronous throw;
 * this accepts either, and fails loudly when nothing was thrown at all.
 */
async function refuses(action: unknown, event: ReturnType<typeof post>) {
	try {
		await call(action, event);
	} catch (thrown) {
		expect(thrown).toMatchObject({ status: 404 });
		return;
	}
	expect.unreachable('the cross-dance call should have been refused');
}

const figureInput = {
	name: 'Dile que no',
	partner: 'partner' as const,
	notes: null,
	callable: true,
	callText: null
};

let db: Db;
let salsaExerciseId: number;
let bachataFigureId: number;
let bachataExerciseId: number;
let bachataCustomId: number;
let bachataSetId: number;
let bachataSongId: number;
let bachataLessonId: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	seedPositions(db);

	salsaExerciseId = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.exercise.id;
	const bachata = createFigure(db, 'bachata', {
		...figureInput,
		name: 'Basico',
		style: 'sensual'
	})!;
	bachataFigureId = bachata.figure.id;
	bachataExerciseId = bachata.exercise.id;
	bachataCustomId = createCustomExercise(db, 'bachata', {
		name: 'Hip drills',
		everyDays: 3,
		notes: null
	}).id;
	bachataSetId = logSet(db, {
		exerciseId: bachataExerciseId,
		doneAt: 1_000,
		durationS: null,
		reps: null,
		rating: null,
		note: null,
		playerJson: null
	}).id;
	bachataSongId = createSongFromUrl(db, 'bachata', {
		url: 'https://example.com/b',
		title: 'Bachata song',
		style: 'sensual'
	}).id;
	// `retry` only bites on a failed song, so put it there the way the worker would.
	failJob(db, bachataSongId, 'download failed', true);
	bachataLessonId = createLesson(db, 'bachata', {
		lessonDay: '2020-01-01',
		title: 'Bachata class',
		notes: null
	}).lesson.id;
});

describe("Today refuses the other dance's rows", () => {
	it('will not log a set on an exercise from the other dance', async () => {
		await refuses(
			todayActions.log,
			post('salsa', {
				exerciseId: String(bachataExerciseId),
				durationMin: '',
				reps: '',
				rating: '',
				note: '',
				day: ''
			})
		);
		expect(db.select().from(sets).all()).toHaveLength(1);
	});

	it('will not delete a set that belongs to the other dance', async () => {
		await refuses(todayActions.deleteSet, post('salsa', { setId: String(bachataSetId) }));
		expect(getSet(db, bachataSetId)).not.toBeNull();
	});

	it('will not archive an exercise from the other dance', async () => {
		await refuses(todayActions.archiveExercise, post('salsa', { id: String(bachataCustomId) }));
		expect(getExercise(db, bachataCustomId)?.archivedAt).toBeNull();
	});

	it('will not edit an exercise from the other dance', async () => {
		await refuses(
			todayActions.updateExercise,
			post('salsa', {
				id: String(bachataCustomId),
				name: 'Renamed by the wrong dance',
				everyDays: '7',
				notes: '',
				practiceMode: 'none',
				songId: '',
				countBpm: '',
				active: 'on'
			})
		);
		expect(getExercise(db, bachataCustomId)?.name).toBe('Hip drills');
	});

	it('still acts on its own dance', async () => {
		const salsaSet = logSet(db, {
			exerciseId: salsaExerciseId,
			doneAt: 2_000,
			durationS: null,
			reps: null,
			rating: null,
			note: null,
			playerJson: null
		});
		await call(todayActions.deleteSet, post('salsa', { setId: String(salsaSet.id) }));
		expect(getSet(db, salsaSet.id)).toBeNull();
	});
});

describe("the player refuses the other dance's exercise", () => {
	it('will not save a run against an exercise from the other dance', async () => {
		await refuses(
			playerActions.save,
			post('salsa', {
				exerciseId: String(bachataExerciseId),
				durationS: '120',
				rating: '4',
				note: '',
				run: ''
			})
		);
		// Only the seeded set: the run was never logged.
		expect(db.select().from(sets).all()).toHaveLength(1);
	});
});

describe("the detail pages refuse the other dance's rows", () => {
	it('will not open a bachata figure from a salsa URL', () => {
		expect(loadAt(figurePage.load, 'bachata', String(bachataFigureId))).toMatchObject({
			figure: { name: 'Basico' }
		});
		expect(() => loadAt(figurePage.load, 'salsa', String(bachataFigureId))).toThrow(threw404);
	});

	it('will not archive a bachata figure from a salsa URL', async () => {
		await refuses(figurePage.actions.archive, post('salsa', {}, String(bachataFigureId)));
		expect(getFigure(db, bachataFigureId)?.figure.archivedAt).toBeNull();
	});

	it('refuses positions for a figure from the other dance, writing nothing', async () => {
		// A BACHATA position on a BACHATA figure: `setFigurePositions`'s own
		// per-position dance check would ACCEPT this payload, so the only thing
		// that can refuse it is the route's `figureOf` guard. Posting a salsa
		// position instead would 404 either way and prove nothing about the wall —
		// the next test covers that layer deliberately.
		const bachataClosed = listPositions(db, 'bachata').find((p) => p.slug === 'closed')!;
		await refuses(
			figurePage.actions.positions,
			post('salsa', { startIds: String(bachataClosed.id), eights: '1' }, String(bachataFigureId))
		);
		expect(figurePositions(db, bachataFigureId)).toEqual({ startIds: [], endId: null });
	});

	it('refuses a position from the other dance on a figure of this one', async () => {
		const salsaFigureId = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure.id;
		const bachataShadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;
		await refuses(
			figurePage.actions.positions,
			post('salsa', { startIds: String(bachataShadow.id), eights: '1' }, String(salsaFigureId))
		);
	});

	it('will not open a bachata song from a salsa URL', () => {
		expect(loadAt(songPage.load, 'bachata', String(bachataSongId))).toMatchObject({
			song: { title: 'Bachata song' }
		});
		expect(() => loadAt(songPage.load, 'salsa', String(bachataSongId))).toThrow(threw404);
	});

	it('will not archive a bachata song from a salsa URL', async () => {
		await refuses(songPage.actions.archive, post('salsa', {}, String(bachataSongId)));
		expect(getSong(db, bachataSongId)?.archivedAt).toBeNull();
	});

	it('will not open a bachata lesson from a salsa URL', () => {
		expect(loadAt(lessonPage.load, 'bachata', String(bachataLessonId))).toMatchObject({
			lesson: { title: 'Bachata class' }
		});
		expect(() => loadAt(lessonPage.load, 'salsa', String(bachataLessonId))).toThrow(threw404);
	});

	it('will not archive a bachata lesson from a salsa URL', async () => {
		await refuses(lessonPage.actions.archive, post('salsa', {}, String(bachataLessonId)));
		expect(getLesson(db, bachataLessonId)?.lesson.archivedAt).toBeNull();
	});

	it('will not retry a bachata song from the salsa list', async () => {
		await refuses(songListActions.retry, post('salsa', { id: String(bachataSongId) }));
		// Untouched: still failed, still carrying the reason it failed.
		expect(getSong(db, bachataSongId)).toMatchObject({
			status: 'failed',
			error: 'download failed'
		});
	});

	it('still retries from its own dance', async () => {
		await call(songListActions.retry, post('bachata', { id: String(bachataSongId) }));
		expect(getSong(db, bachataSongId)?.status).toBe('waiting_download');
	});
});

describe('an unknown dance in the URL cannot write a row', () => {
	/*
	 * A form action runs BEFORE any load, so the `[dance]` layout's slug check
	 * has not happened yet when an action writes. Both of these create rows, and
	 * the `dance` column deliberately has no CHECK to fall back on.
	 */
	it('refuses to create a custom exercise under a dance that does not exist', async () => {
		await refuses(
			todayActions.createExercise,
			post('kizomba', { name: 'Smuggled', everyDays: '3', notes: '' })
		);
		expect(listExercises(db, 'salsa').map((e) => e.name)).not.toContain('Smuggled');
		expect(
			db
				.select()
				.from(exercises)
				.all()
				.map((e) => e.dance)
		).not.toContain('kizomba');
	});

	it('refuses to create a lesson under a dance that does not exist', async () => {
		await refuses(
			lessonListActions.create,
			post('kizomba', {
				title: 'Smuggled class',
				notes: '',
				everyDays: '7',
				lessonDay: '2020-01-01'
			})
		);
		expect(
			db
				.select()
				.from(lessons)
				.all()
				.map((l) => l.dance)
		).not.toContain('kizomba');
		expect(listLessons(db, 'salsa')).toHaveLength(0);
	});
});

describe('the guard leaves the friendly failures alone', () => {
	it('still refuses to archive a figure exercise, with the message that explains why', async () => {
		const res = (await call(
			todayActions.archiveExercise,
			post('bachata', { id: String(bachataExerciseId) })
		)) as { status: number; data: { message: string } };
		expect(res.data.message).toContain('Archive a figure from its page');
	});
});
