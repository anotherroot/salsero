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
import {
	addFigureExercise,
	addRecording,
	archiveVariation,
	createFigure,
	createVariationFrom,
	getFigure,
	getGroup,
	listGroupVariations
} from '$lib/server/figures';
import {
	createCustomExercise,
	getExercise,
	getSet,
	listExercises,
	logSet,
	setPracticeSettings
} from '$lib/server/exercises';
import {
	createSongFromUpload,
	createSongFromUrl,
	failJob,
	getSong,
	storeAnalysis
} from '$lib/server/songs';
import { createLesson, getLesson, listLessons } from '$lib/server/lessons';
import { figurePositions, setFigureShape } from '$lib/server/graph';
import { getPosition, listPositions, seedPositions } from '$lib/server/positions';
import { addFigureSlot, addOption, createRoutine, routineSlots } from '$lib/server/routines';
import { eq } from 'drizzle-orm';
import { exercises, figures, lessons, links, sets } from '$lib/server/db/schema';
import { actions as todayActions } from './+page.server';
import { actions as playerActions, load as playerLoad } from './player/+page.server';
import { actions as songListActions } from './songs/+page.server';
import { actions as lessonListActions } from './lessons/+page.server';
import * as exercisePage from './exercises/[id]/+page.server';
import * as figurePage from './figures/[id]/+page.server';
import { actions as figureListActions } from './figures/+page.server';
import * as songPage from './songs/[id]/+page.server';
import * as lessonPage from './lessons/[id]/+page.server';
import * as positionsPage from './positions/+page.server';
import * as routinePage from './routines/[id]/+page.server';
import * as coveragePage from './coverage/+page.server';
import * as gridEndpoint from './songs/[id]/grid/+server';
import * as practiceEndpoint from './exercises/[id]/practice/+server';

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
	figureName: 'Dile que no',
	name: 'Basic',
	partner: 'partner' as const,
	notes: null
};

let db: Db;
let salsaExerciseId: number;
let salsaFigureId: number;
let salsaFigureId2: number;
let salsaRoutineAId: number;
let salsaRoutineBId: number;
let bachataFigureId: number;
let bachataExerciseId: number;
let bachataCustomId: number;
let bachataSetId: number;
let bachataSongId: number;
let bachataLessonId: number;
let bachataRoutineId: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	seedPositions(db);

	const salsaFigure = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!;
	salsaExerciseId = addFigureExercise(db, salsaFigure.figure.id)!.id;
	salsaFigureId = salsaFigure.figure.id;
	salsaFigureId2 = createFigure(db, 'salsa', {
		...figureInput,
		figureName: 'Second salsa figure',
		style: 'salsa'
	})!.figure.id;
	salsaRoutineAId = createRoutine(db, 'salsa', { name: 'Routine A', notes: null }).routine.id;
	salsaRoutineBId = createRoutine(db, 'salsa', { name: 'Routine B', notes: null }).routine.id;
	bachataRoutineId = createRoutine(db, 'bachata', { name: 'Bachata routine', notes: null }).routine
		.id;
	const bachata = createFigure(db, 'bachata', {
		...figureInput,
		figureName: 'Basico',
		style: 'sensual'
	})!;
	bachataFigureId = bachata.figure.id;
	bachataExerciseId = addFigureExercise(db, bachata.figure.id)!.id;
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
		await refuses(exercisePage.actions.archive, post('salsa', {}, String(bachataCustomId)));
		expect(getExercise(db, bachataCustomId)?.archivedAt).toBeNull();
	});

	it('will not edit an exercise from the other dance', async () => {
		await refuses(
			exercisePage.actions.update,
			post(
				'salsa',
				{ name: 'Renamed by the wrong dance', everyDays: '7', notes: '', active: 'on' },
				String(bachataCustomId)
			)
		);
		expect(getExercise(db, bachataCustomId)?.name).toBe('Hip drills');
	});

	it('will not open a bachata exercise under salsa', () =>
		expect(() => loadAt(exercisePage.load, 'salsa', String(bachataCustomId))).toThrow(threw404));

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

describe("the player's song picker stays on its own side", () => {
	const ready = (dance: 'salsa' | 'bachata', title: string) => {
		const song = createSongFromUpload(db, dance, {
			file: `${title}.mp3`,
			mime: 'audio/mpeg',
			title,
			style: dance === 'salsa' ? 'salsa' : 'sensual'
		});
		storeAnalysis(db, song.id, { beats: [0, 0.5], downbeats: [0], durationS: 1 });
		return song.id;
	};
	type PlayerLoad = (e: { params: { dance: string }; url: URL; locals: unknown }) => {
		songs: { id: number; title: string }[];
		start: { source: string; songId: number | null; songGone: boolean };
	};
	const openPlayer = (dance: string, query: string) =>
		(playerLoad as unknown as PlayerLoad)({
			params: { dance },
			url: new URL(`http://localhost/${dance}/player?${query}`),
			locals: { user: USER }
		});

	it("offers only this dance's ready songs, and refuses the other dance's by id", () => {
		const salsaSong = ready('salsa', 'Salsa ready');
		const bachataSong = ready('bachata', 'Bachata ready');
		// The failed `bachataSongId` from `beforeEach` is not ready, so it is not offered either.
		expect(openPlayer('salsa', '').songs).toEqual([{ id: salsaSong, title: 'Salsa ready' }]);
		expect(openPlayer('bachata', '').songs).toEqual([{ id: bachataSong, title: 'Bachata ready' }]);
		expect(() => openPlayer('salsa', `song=${bachataSong}`)).toThrow(threw404);
		expect(openPlayer('salsa', `song=${salsaSong}`).start).toMatchObject({
			source: 'song',
			songId: salsaSong
		});
	});

	it("opens on the song the exercise was last practised with, never the other dance's", () => {
		const salsaSong = ready('salsa', 'Salsa ready');
		setPracticeSettings(db, salsaExerciseId, {
			mode: 'song',
			songId: salsaSong,
			countBpm: null,
			config: { count: 'salsa', clave: null, speed: 1, callEvery: null }
		});
		expect(openPlayer('salsa', `exercise=${salsaExerciseId}`).start).toEqual({
			source: 'song',
			songId: salsaSong,
			songGone: false,
			bpm: null
		});
		// The same exercise id under bachata is no exercise at all, so nothing is remembered.
		expect(openPlayer('bachata', `exercise=${salsaExerciseId}`).start.source).toBe('count');
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
	it('will not give a bachata figure an exercise from a salsa URL', async () => {
		const bare = createFigure(db, 'bachata', {
			...figureInput,
			figureName: 'Bare',
			style: 'sensual'
		})!;
		await refuses(figurePage.actions.practise, post('salsa', {}, String(bare.figure.id)));
		expect(getFigure(db, bare.figure.id)?.exercise).toBeNull();
	});

	it('gives a figure its exercise from its own dance', async () => {
		const bare = createFigure(db, 'salsa', { ...figureInput, figureName: 'Bare', style: 'salsa' })!;
		await call(figurePage.actions.practise, post('salsa', {}, String(bare.figure.id)));
		expect(getFigure(db, bare.figure.id)?.exercise?.source).toBe('figure');
	});

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

	it("will not delete a bachata figure's set from a salsa URL", async () => {
		await refuses(figurePage.actions.deleteSet, post('salsa', { setId: String(bachataSetId) }));
		expect(getSet(db, bachataSetId)).not.toBeNull();
	});

	/** A complete, valid edit of a variation — each test overrides only what it is about. */
	const edit = (fields: Record<string, string>) => ({
		figureName: 'Dile que no',
		name: 'Renamed',
		partner: 'partner',
		style: 'salsa',
		startCount: '1',
		lengthCounts: '8',
		...fields
	});

	const groupOf = (id: number) => getFigure(db, id)!.figure.groupId!;

	it('refuses an edit of a variation from the other dance, writing nothing', async () => {
		// A BACHATA position on a BACHATA variation: `setFigureShape`'s own
		// per-position dance check would ACCEPT this payload, so the only thing
		// that can refuse it is the route's `variationOf` guard.
		const bachataClosed = listPositions(db, 'bachata').find((p) => p.slug === 'closed')!;
		await refuses(
			figurePage.actions.update,
			post(
				'salsa',
				edit({ figureName: 'Basico', startIds: String(bachataClosed.id) }),
				String(bachataFigureId)
			)
		);
		expect(figurePositions(db, bachataFigureId)).toEqual({ startIds: [], endId: null });
		expect(getFigure(db, bachataFigureId)!.figure.name).toBe('Basic');
	});

	it('refuses a position from the other dance on a variation of this one — names included', async () => {
		const bachataShadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;
		await refuses(
			figurePage.actions.update,
			post(
				'salsa',
				edit({ figureName: 'Renamed figure', startIds: String(bachataShadow.id) }),
				String(salsaFigureId)
			)
		);
		// The shape half refused, so neither name may have been written either.
		expect(getFigure(db, salsaFigureId)!.figure.name).toBe('Basic');
		expect(getGroup(db, groupOf(salsaFigureId))!.name).toBe('Dile que no');
	});

	it('refuses out-of-range timing with a message, writing nothing', async () => {
		const before = getFigure(db, salsaFigureId)!.figure;
		const bads: Record<string, string>[] = [
			{ startCount: '0' },
			{ startCount: '9' },
			{ startCount: 'abc' },
			{ startCount: '' },
			{ lengthCounts: '0' },
			{ lengthCounts: '65' },
			{ lengthCounts: '' }
		];
		for (const bad of bads) {
			const result = await call(
				figurePage.actions.update,
				post('salsa', edit(bad), String(salsaFigureId))
			);
			expect(result).toMatchObject({ status: 400 });
		}
		const after = getFigure(db, salsaFigureId)!.figure;
		expect(after.name).toBe(before.name);
		expect(after.lengthCounts).toBe(before.lengthCounts);
	});

	describe('one variation per URL', () => {
		const loadWith = (dance: string, id: string, search = '') =>
			(figurePage.load as unknown as (e: unknown) => unknown)({
				params: { dance, id },
				url: new URL(`http://localhost/${search}`),
				locals: { user: USER }
			});

		/** What a load or an action threw — a redirect, here — failing loudly when nothing was. */
		async function thrownBy(run: () => unknown) {
			try {
				await run();
			} catch (thrown) {
				return thrown;
			}
			expect.unreachable('it should have redirected');
		}

		const doble = () => createVariationFrom(db, salsaFigureId, 'Doble')!;
		const salsaPosition = (slug: string) =>
			listPositions(db, 'salsa').find((p) => p.slug === slug)!;

		it('loads the variation, its figure, its siblings and where it can move', () => {
			const v = doble();
			setFigureShape(db, v.id, {
				startIds: [salsaPosition('cross-hand').id, salsaPosition('closed').id],
				endId: salsaPosition('caida').id,
				startCount: 5,
				lengthCounts: 4
			});
			addRecording(db, {
				figureId: v.id,
				file: 'd.mp4',
				mime: 'video/mp4',
				kind: 'video',
				sizeBytes: 1,
				note: null
			});
			const neutral = 'Abierta (dos manos)';
			expect(loadWith('salsa', String(v.id))).toMatchObject({
				figure: { id: groupOf(salsaFigureId), name: 'Dile que no' },
				variation: { id: v.id, name: 'Doble', partner: 'partner', styleTag: 'salsa' },
				shape: { startCount: 5, lengthCounts: 4 },
				siblings: [
					{
						id: salsaFigureId,
						name: 'Basic',
						holds: `${neutral} → ${neutral}`,
						timing: 'Starts on 1 · 8 counts',
						videos: 0
					},
					{
						id: v.id,
						name: 'Doble',
						holds: 'Cerrada / Manos cruzadas → Caída',
						timing: 'Starts on 5 · 4 counts',
						videos: 1
					}
				],
				moveTargets: [
					{ id: groupOf(salsaFigureId2), name: 'Second salsa figure', variations: ['Basic'] }
				]
			});
		});

		it('a ?v= link redirects to the variation', async () => {
			const v = doble();
			expect(
				await thrownBy(() => loadWith('salsa', String(salsaFigureId), `?v=${v.id}`))
			).toMatchObject({ status: 303, location: `/salsa/figures/${v.id}` });
		});

		it('a bachata variation under /salsa/ is a 404', () => {
			const v = createVariationFrom(db, bachataFigureId, 'Doble')!;
			expect(loadWith('bachata', String(v.id))).toMatchObject({ variation: { id: v.id } });
			expect(() => loadWith('salsa', String(v.id))).toThrow(threw404);
		});

		it('an archived variation is a 404, page and actions alike', async () => {
			const v = doble();
			archiveVariation(db, v.id, 1_000);
			expect(() => loadWith('salsa', String(v.id))).toThrow(threw404);
			await refuses(figurePage.actions.update, post('salsa', edit({}), String(v.id)));
			expect(getFigure(db, v.id)!.figure.name).toBe('Doble');
		});

		it('update saves both names and the timing — a case-only figure rename included', async () => {
			const result = await call(
				figurePage.actions.update,
				post(
					'salsa',
					edit({ figureName: 'DILE QUE NO', startCount: '5', lengthCounts: '4' }),
					String(salsaFigureId)
				)
			);
			expect(result).toEqual({ action: 'update', ok: true });
			const row = getFigure(db, salsaFigureId)!.figure;
			expect([row.name, row.startCount, row.lengthCounts]).toEqual(['Renamed', 5, 4]);
			expect(getGroup(db, row.groupId!)!.name).toBe('DILE QUE NO');
		});

		it('update refuses a taken figure name', async () => {
			const result = await call(
				figurePage.actions.update,
				post(
					'salsa',
					edit({ figureName: 'second salsa figure', lengthCounts: '4' }),
					String(salsaFigureId)
				)
			);
			expect(result).toMatchObject({
				status: 400,
				data: { action: 'update', message: "There's already a figure called second salsa figure." }
			});
			const row = getFigure(db, salsaFigureId)!.figure;
			expect([row.name, row.lengthCounts]).toEqual(['Basic', 8]);
			expect(getGroup(db, row.groupId!)!.name).toBe('Dile que no');
		});

		it('update refuses a sibling’s variation name before writing anything', async () => {
			const v = doble();
			const result = await call(
				figurePage.actions.update,
				post('salsa', edit({ name: 'basic', lengthCounts: '4' }), String(v.id))
			);
			expect(result).toMatchObject({
				status: 400,
				data: {
					action: 'update',
					message: 'Dile que no already has a variation called basic. Rename one first.'
				}
			});
			const row = getFigure(db, v.id)!.figure;
			expect([row.name, row.lengthCounts]).toEqual(['Doble', 8]);
		});

		it('createVariation copies the current variation and opens it', async () => {
			const cross = salsaPosition('cross-hand').id;
			const caida = salsaPosition('caida').id;
			setFigureShape(db, salsaFigureId, {
				startIds: [cross],
				endId: caida,
				startCount: 5,
				lengthCounts: 4
			});
			const thrown = await thrownBy(() =>
				call(
					figurePage.actions.createVariation,
					post('salsa', { name: 'Doble' }, String(salsaFigureId))
				)
			);
			const [, made] = listGroupVariations(db, groupOf(salsaFigureId));
			expect(thrown).toMatchObject({ status: 303, location: `/salsa/figures/${made.id}` });
			expect([made.name, made.startCount, made.lengthCounts, made.endPositionId]).toEqual([
				'Doble',
				5,
				4,
				caida
			]);
			expect(figurePositions(db, made.id).startIds).toEqual([cross]);
		});

		it('createVariation refuses a taken name', async () => {
			const result = await call(
				figurePage.actions.createVariation,
				post('salsa', { name: ' basic ' }, String(salsaFigureId))
			);
			expect(result).toMatchObject({
				status: 400,
				data: {
					action: 'createVariation',
					message: 'Dile que no already has a variation called basic. Rename one first.'
				}
			});
			expect(listGroupVariations(db, groupOf(salsaFigureId))).toHaveLength(1);
		});

		it('move refuses a figure of the other dance', async () => {
			const before = groupOf(salsaFigureId);
			await refuses(
				figurePage.actions.move,
				post('salsa', { target: String(groupOf(bachataFigureId)) }, String(salsaFigureId))
			);
			expect(groupOf(salsaFigureId)).toBe(before);
			expect(getGroup(db, before)!.archivedAt).toBeNull();
		});

		it('move into another figure stays on the same URL', async () => {
			const v = doble();
			const thrown = await thrownBy(() =>
				call(
					figurePage.actions.move,
					post('salsa', { target: String(groupOf(salsaFigureId2)) }, String(v.id))
				)
			);
			expect(thrown).toMatchObject({ status: 303, location: `/salsa/figures/${v.id}` });
			expect(groupOf(v.id)).toBe(groupOf(salsaFigureId2));
		});

		it('move to a new figure of its own', async () => {
			const v = doble();
			const thrown = await thrownBy(() =>
				call(
					figurePage.actions.move,
					post('salsa', { target: 'new', figureName: 'Dile que no Doble' }, String(v.id))
				)
			);
			expect(thrown).toMatchObject({ status: 303, location: `/salsa/figures/${v.id}` });
			expect(getGroup(db, groupOf(v.id))!.name).toBe('Dile que no Doble');
			expect(groupOf(v.id)).not.toBe(groupOf(salsaFigureId));
		});

		it('move refuses a taken variation name, naming the target figure', async () => {
			const result = await call(
				figurePage.actions.move,
				post('salsa', { target: String(groupOf(salsaFigureId2)) }, String(salsaFigureId))
			);
			expect(result).toMatchObject({
				status: 400,
				data: {
					action: 'move',
					message: 'Second salsa figure already has a variation called Basic. Rename one first.'
				}
			});
		});

		it('move refuses a taken name for the new figure, and its own figure as a target', async () => {
			const before = groupOf(salsaFigureId);
			expect(
				await call(
					figurePage.actions.move,
					post('salsa', { target: 'new', figureName: 'second salsa figure' }, String(salsaFigureId))
				)
			).toMatchObject({
				status: 400,
				data: { action: 'move', message: "There's already a figure called second salsa figure." }
			});
			expect(
				await call(
					figurePage.actions.move,
					post('salsa', { target: String(before) }, String(salsaFigureId))
				)
			).toMatchObject({ status: 400, data: { action: 'move' } });
			expect(
				await call(
					figurePage.actions.move,
					post('salsa', { target: 'new', figureName: '' }, String(salsaFigureId))
				)
			).toMatchObject({ status: 400, data: { action: 'move' } });
			expect(groupOf(salsaFigureId)).toBe(before);
		});

		it('archive redirects to a sibling', async () => {
			const v = doble();
			// The lowest id is the one archived, so "the first one left" is the other.
			const thrown = await thrownBy(() =>
				call(figurePage.actions.archive, post('salsa', {}, String(salsaFigureId)))
			);
			expect(thrown).toMatchObject({ status: 303, location: `/salsa/figures/${v.id}` });
			expect(getFigure(db, salsaFigureId)!.figure.archivedAt).not.toBeNull();
			expect(getGroup(db, groupOf(v.id))!.archivedAt).toBeNull();
		});

		it('archive of the last variation goes to the figures list', async () => {
			const thrown = await thrownBy(() =>
				call(figurePage.actions.archive, post('salsa', {}, String(salsaFigureId)))
			);
			expect(thrown).toMatchObject({ status: 303, location: '/salsa/figures' });
			expect(getGroup(db, groupOf(salsaFigureId))!.archivedAt).not.toBeNull();
		});

		it('refuses to delete a recording of a sibling variation', async () => {
			const v = doble();
			const rec = addRecording(db, {
				figureId: v.id,
				file: 'x.mp4',
				mime: 'video/mp4',
				kind: 'video',
				sizeBytes: 1,
				note: null
			});
			const result = await call(
				figurePage.actions.deleteRecording,
				post('salsa', { recordingId: String(rec.id) }, String(salsaFigureId))
			);
			expect(result).toMatchObject({ status: 404 });
			expect(getFigure(db, v.id)!.recordings.map((r) => r.id)).toEqual([rec.id]);
		});
	});

	describe('creating a figure asks for both names', () => {
		const fields = {
			figureName: 'dile que no',
			name: 'Doble',
			partner: 'partner',
			style: 'salsa',
			notes: 'Spin'
		};

		it('the figures list refuses a taken figure name, keeping what was typed', async () => {
			expect(await call(figureListActions.create, post('salsa', fields))).toMatchObject({
				status: 400,
				data: {
					message: "There's already a figure called dile que no.",
					figureName: 'dile que no',
					name: 'Doble',
					notes: 'Spin'
				}
			});
		});

		it('the figures list refuses a missing variation name', async () => {
			expect(
				await call(figureListActions.create, post('salsa', { ...fields, name: '' }))
			).toMatchObject({
				status: 400,
				data: { message: expect.stringMatching(/figure and the variation/) }
			});
		});

		it('the figures list opens the new variation', async () => {
			const thrown = await (async () => {
				try {
					await call(
						figureListActions.create,
						post('salsa', { ...fields, figureName: 'Enchufla' })
					);
				} catch (e) {
					return e as { status: number; location: string };
				}
				expect.unreachable('a created figure redirects');
			})();
			const id = Number(thrown!.location.split('/').pop());
			expect(thrown).toMatchObject({ status: 303, location: `/salsa/figures/${id}` });
			const row = getFigure(db, id)!.figure;
			expect([row.name, getGroup(db, row.groupId!)!.name]).toEqual(['Doble', 'Enchufla']);
		});

		it('a lesson’s new figure refuses a taken figure name, and links one it makes', async () => {
			const lesson = { ...fields, style: 'sensual' };
			expect(
				await call(
					lessonPage.actions.newFigure,
					post('bachata', { ...lesson, figureName: 'basico' }, String(bachataLessonId))
				)
			).toMatchObject({
				status: 400,
				data: { action: 'newFigure', message: "There's already a figure called basico." }
			});
			expect(
				await call(
					lessonPage.actions.newFigure,
					post('bachata', { ...lesson, figureName: 'Paseo' }, String(bachataLessonId))
				)
			).toEqual({ action: 'newFigure', ok: true });
			expect(getLesson(db, bachataLessonId)!.figures.map((f) => f.name)).toEqual(['Paseo · Doble']);
		});
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

describe("the positions page refuses the other dance's rows", () => {
	it('will not rename a bachata position from a salsa URL', async () => {
		const shadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;
		await refuses(
			positionsPage.actions.rename,
			post('salsa', { id: String(shadow.id), name: 'Hijacked' })
		);
		expect(getPosition(db, shadow.id)?.name).toBe('Shadow');
	});

	it('will not archive a bachata position from a salsa URL', async () => {
		const shadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;
		await refuses(positionsPage.actions.archive, post('salsa', { id: String(shadow.id) }));
		expect(getPosition(db, shadow.id)?.archivedAt).toBeNull();
	});

	// Same-dance, unlike the two tests above: this guard is `archivePosition`'s
	// own refusal of the neutral row (src/lib/server/positions.ts), not the
	// dance wall — so it returns a `fail(400)` rather than throwing a 404, and
	// is asserted by calling the action directly, the way the "guard leaves the
	// friendly failures alone" block below does for `archiveExercise`.
	it('refuses to archive the neutral position, with the message that explains why', async () => {
		const neutral = listPositions(db, 'salsa').find((p) => p.neutral)!;
		const res = (await call(
			positionsPage.actions.archive,
			post('salsa', { id: String(neutral.id) })
		)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(res.data.message).toContain('The neutral position cannot be removed');
		const row = getPosition(db, neutral.id);
		expect(row?.archivedAt).toBeNull();
		expect(row?.neutral).toBe(true);
	});
});

describe("the routine detail route refuses the other dance's rows", () => {
	it('will not open a bachata routine from a salsa URL', () => {
		expect(() => loadAt(routinePage.load, 'salsa', String(bachataRoutineId))).toThrow(threw404);
	});

	// `addOption`, `removeOption` and `note` all take a bare `stepId` with no
	// routine id to check it against — unlike `reorder`, `deleteMany`,
	// `duplicateMany` and `extract`, whose data functions take `routine.id`
	// natively and scope in SQL. For these three,
	// `ownsSlot` in the route is the ONLY guard: a same-dance slot from a
	// SECOND salsa routine passes `requireRoutineInDance` (routine A really is
	// salsa) and would pass the data function's own dance check too, since
	// both routines are salsa. A bachata slot would prove nothing here — it
	// would already be caught by a dance check unrelated to `ownsSlot`.
	it("will not add an option to another salsa routine's slot", async () => {
		const stepId = addFigureSlot(db, salsaRoutineBId, salsaFigureId)!;
		const res = (await call(
			routinePage.actions.addOption,
			post(
				'salsa',
				{ stepId: String(stepId), figureId: String(salsaFigureId2) },
				String(salsaRoutineAId)
			)
		)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(res.data.message).toBe('That slot does not belong to this routine.');
		expect(routineSlots(db, salsaRoutineBId)[0].figureIds).toEqual([salsaFigureId]);
	});

	it("will not remove an option from another salsa routine's slot", async () => {
		const stepId = addFigureSlot(db, salsaRoutineBId, salsaFigureId)!;
		// Set up directly through the data function, not the action: the slot
		// needs two options before a removal is even possible, and this call is
		// not what is under test.
		addOption(db, stepId, salsaFigureId2);
		const res = (await call(
			routinePage.actions.removeOption,
			post(
				'salsa',
				{ stepId: String(stepId), figureId: String(salsaFigureId2) },
				String(salsaRoutineAId)
			)
		)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(res.data.message).toBe('That slot does not belong to this routine.');
		expect(routineSlots(db, salsaRoutineBId)[0].figureIds.slice().sort()).toEqual(
			[salsaFigureId, salsaFigureId2].sort()
		);
	});

	it("will not set a note on another salsa routine's slot", async () => {
		const stepId = addFigureSlot(db, salsaRoutineBId, salsaFigureId)!;
		const res = (await call(
			routinePage.actions.note,
			post('salsa', { stepId: String(stepId), note: 'Hijacked' }, String(salsaRoutineAId))
		)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(res.data.message).toBe('That slot does not belong to this routine.');
		expect(routineSlots(db, salsaRoutineBId)[0].note).toBeNull();
	});

	it('will not insert a bachata figure into a salsa routine', async () => {
		const res = (await call(
			routinePage.actions.insert,
			post('salsa', { at: '0', figureId: String(bachataFigureId) }, String(salsaRoutineAId))
		)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(routineSlots(db, salsaRoutineAId)).toHaveLength(0);
	});

	it.each([
		['reorder', { index: '0' }],
		['deleteMany', {}],
		['duplicateMany', {}],
		['extract', { name: 'Stolen' }]
	])("will not %s another salsa routine's slot", async (action, extra) => {
		const stepId = addFigureSlot(db, salsaRoutineBId, salsaFigureId)!;
		const ids: Record<string, string> =
			action === 'reorder' ? { stepId: String(stepId) } : { stepIds: String(stepId) };
		const res = (await call(
			routinePage.actions[action as keyof typeof routinePage.actions],
			post('salsa', { ...ids, ...extra }, String(salsaRoutineAId))
		)) as { status: number };
		expect(res.status).toBe(400);
		expect(routineSlots(db, salsaRoutineBId).map((s) => s.id)).toEqual([stepId]);
		expect(routineSlots(db, salsaRoutineAId)).toHaveLength(0);
	});

	it('will not restore a bachata figure into a salsa routine', async () => {
		const snapshot = JSON.stringify([
			{ position: 0, childId: null, note: null, figureIds: [bachataFigureId] }
		]);
		const res = (await call(
			routinePage.actions.restore,
			post('salsa', { snapshot }, String(salsaRoutineAId))
		)) as { status: number };
		expect(res.status).toBe(400);
		expect(routineSlots(db, salsaRoutineAId)).toHaveLength(0);
	});

	it('will not embed a bachata routine in a salsa routine', async () => {
		const res = (await call(
			routinePage.actions.insert,
			post('salsa', { at: '0', childId: String(bachataRoutineId) }, String(salsaRoutineAId))
		)) as { status: number };
		expect(res.status).toBe(400);
		expect(routineSlots(db, salsaRoutineAId)).toHaveLength(0);
	});

	it('will not restore a bachata routine into a salsa routine', async () => {
		const snapshot = JSON.stringify([
			{ position: 0, childId: bachataRoutineId, note: null, figureIds: [] }
		]);
		const res = (await call(
			routinePage.actions.restore,
			post('salsa', { snapshot }, String(salsaRoutineAId))
		)) as { status: number };
		expect(res.status).toBe(400);
		expect(routineSlots(db, salsaRoutineAId)).toHaveLength(0);
	});

	// Not a wall test, but the one place the routine page's actions are called:
	// the refusal names both rules `addOption` applies — the landing AND the start.
	it('refuses an alternative that does not land like the main figure, saying why', async () => {
		const stepId = addFigureSlot(db, salsaRoutineAId, salsaFigureId)!;
		db.update(figures).set({ lengthCounts: 12 }).where(eq(figures.id, salsaFigureId2)).run();
		const res = (await call(
			routinePage.actions.addOption,
			post(
				'salsa',
				{ stepId: String(stepId), figureId: String(salsaFigureId2) },
				String(salsaRoutineAId)
			)
		)) as { status: number; data: { message: string; stepId: number } };
		expect(res.status).toBe(400);
		expect(res.data).toEqual({
			message:
				'That figure does not start and land like this slot’s figure, so it is not an alternative.',
			stepId
		});
		expect(routineSlots(db, salsaRoutineAId)[0].figureIds).toEqual([salsaFigureId]);
	});

	it("will not put an alternative back on another salsa routine's slot", async () => {
		const stepId = addFigureSlot(db, salsaRoutineBId, salsaFigureId)!;
		const res = (await call(
			routinePage.actions.restoreOption,
			post(
				'salsa',
				{ stepId: String(stepId), figureId: String(salsaFigureId2) },
				String(salsaRoutineAId)
			)
		)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(res.data.message).toBe('That slot does not belong to this routine.');
		expect(routineSlots(db, salsaRoutineBId)[0].figureIds).toEqual([salsaFigureId]);
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

describe('the JSON endpoints refuse the other dance', () => {
	const at = (dance: string, id: string, init?: RequestInit) => ({
		params: { dance, id },
		request: new Request('http://localhost/', init),
		locals: { user: USER }
	});
	type Handler = (e: ReturnType<typeof at>) => unknown;

	it('will not serve a bachata song’s grid under salsa, but does under bachata', async () => {
		// `bachataSongId` (from `beforeEach`) is `status: 'failed'`, which the
		// endpoint's OWN guard already 404s on — that would pass even with the
		// dance wall deleted, and prove nothing about it. A READY song is the
		// only way to isolate the wall: it must be the one thing standing
		// between a salsa request and a 200.
		const ready = createSongFromUpload(db, 'bachata', {
			file: 'bachata-ready.mp3',
			mime: 'audio/mpeg',
			title: 'Bachata ready',
			style: 'sensual'
		});
		storeAnalysis(db, ready.id, { beats: [0, 0.5], downbeats: [0], durationS: 1 });

		await expect(
			(async () => (gridEndpoint.GET as unknown as Handler)(at('salsa', String(ready.id))))()
		).rejects.toMatchObject({ status: 404 });

		const res = (await (gridEndpoint.GET as unknown as Handler)(
			at('bachata', String(ready.id))
		)) as Response;
		expect(await res.json()).toMatchObject({
			audioFile: 'bachata-ready.mp3',
			beats: [0, 0.5],
			counts: expect.any(Array)
		});
	});

	it('will not serve or change a bachata exercise under salsa', async () => {
		await expect(
			(async () =>
				(practiceEndpoint.GET as unknown as Handler)(at('salsa', String(bachataCustomId))))()
		).rejects.toMatchObject({ status: 404 });
		await expect(
			(async () =>
				(practiceEndpoint.POST as unknown as Handler)(
					at('salsa', String(bachataCustomId), {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ mode: 'count', countBpm: 150, songId: null, config: {} })
					})
				))()
		).rejects.toMatchObject({ status: 404 });
		expect(getExercise(db, bachataCustomId)?.practiceMode).toBe('none');
	});

	it('serves its own dance', async () => {
		const res = (await (practiceEndpoint.GET as unknown as Handler)(
			at('bachata', String(bachataCustomId))
		)) as Response;
		expect(((await res.json()) as { content: { type: string } }).content.type).toBe('drill');
	});
});

describe('links stay on their own side of the wall', () => {
	it('will not add a link to a bachata figure or lesson under salsa', async () => {
		await refuses(
			figurePage.actions.addLink,
			post('salsa', { urls: 'https://a.org' }, String(bachataFigureId))
		);
		await refuses(
			lessonPage.actions.addLink,
			post('salsa', { urls: 'https://a.org' }, String(bachataLessonId))
		);
		expect(db.select().from(links).all()).toHaveLength(0);
	});
});

describe('the guard leaves the friendly failures alone', () => {
	it('still refuses to archive a figure exercise, with the message that explains why', async () => {
		const res = (await call(
			exercisePage.actions.archive,
			post('bachata', {}, String(bachataExerciseId))
		)) as { status: number; data: { message: string } };
		expect(res.data.message).toContain('Archive a figure from its page');
	});
});

describe('the coverage page stays inside its dance', () => {
	it('lists only its own dance versions', () => {
		const data = loadAt(coveragePage.load, 'salsa', '') as {
			groups: { rows: { id: number }[] }[];
		};
		const ids = data.groups.flatMap((g) => g.rows.map((r) => r.id));
		expect(ids).toContain(salsaFigureId);
		expect(ids).not.toContain(bachataFigureId);
	});

	it('will not build a salsa routine from a bachata figure', async () => {
		const event = post('salsa', { name: 'Mixed' });
		const body = new URLSearchParams({ name: 'Mixed' });
		body.append('figureIds', String(salsaFigureId));
		body.append('figureIds', String(bachataFigureId));
		await refuses(coveragePage.actions.create, {
			...event,
			request: new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body
			})
		});
		expect(
			db
				.select()
				.from(exercises)
				.all()
				.filter((e) => e.source === 'routine')
		).toHaveLength(3);
	});

	it('builds the routine in tap order and redirects to it', async () => {
		const body = new URLSearchParams({ name: 'Picked' });
		body.append('figureIds', String(salsaFigureId2));
		body.append('figureIds', String(salsaFigureId));
		try {
			await call(coveragePage.actions.create, {
				...post('salsa', {}),
				request: new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'application/x-www-form-urlencoded' },
					body
				})
			});
			expect.unreachable('a created routine redirects');
		} catch (thrown) {
			expect(thrown).toMatchObject({ status: 303 });
		}
	});
});
