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
import { U1_SALSA, U1_BACHATA } from '$lib/server/test-walls';

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
import {
	createLesson,
	getLesson,
	linkFigure,
	listLessons,
	publishLesson
} from '$lib/server/lessons';
import { figurePositions, setFigureShape } from '$lib/server/graph';
import { listPositions } from '$lib/server/positions';
import { addPosition, insertFixturePositions } from '$lib/server/test-positions';
import { createTeam, joinTeam } from '$lib/server/teams';
import { addLesson } from '$lib/server/entries';
import {
	addFigureSlot,
	addOption,
	archiveRoutine,
	createRoutine,
	createRoutineFromFigures,
	routineSlots
} from '$lib/server/routines';
import { eq } from 'drizzle-orm';
import { exercises, figures, lessons, links, positions, sets } from '$lib/server/db/schema';
import { actions as todayActions, load as todayLoad } from './(today)/+page.server';
import { actions as playerActions, load as playerLoad } from './player/+page.server';
import { actions as songListActions } from './songs/+page.server';
import { actions as lessonListActions } from './lessons/+page.server';
import * as exercisePage from './(today)/exercises/[id]/+page.server';
import * as figurePage from './(moves)/figures/[id]/+page.server';
import {
	actions as figureListActions,
	load as figureListLoad
} from './(moves)/figures/+page.server';
import * as songPage from './songs/[id]/+page.server';
import * as lessonPage from './lessons/[id]/+page.server';
import * as routinePage from './(moves)/routines/[id]/+page.server';
import * as coveragePage from './(moves)/coverage/+page.server';
import * as gridEndpoint from './songs/[id]/grid/+server';
import * as practiceEndpoint from './(today)/exercises/[id]/practice/+server';
import type { PickerSong } from '$lib/types';

const USER = {
	id: 'u1',
	email: 'u@example.com',
	timezone: 'Europe/Ljubljana',
	dance: 'salsa',
	isAdmin: true
};

/** The shape an action destructures, with nothing in it the actions do not read. */
function post(dance: string, fields: Record<string, string | string[]>, id = '') {
	// A list posts its field once per value, as the form's hidden inputs do.
	const body = new URLSearchParams();
	for (const [key, v] of Object.entries(fields)) {
		for (const one of Array.isArray(v) ? v : [v]) body.append(key, one);
	}
	return {
		params: { dance, id },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body
		}),
		cookies: { get: () => undefined, delete: () => {} },
		locals: { user: { ...USER, dance } }
	};
}

type Invoke = (event: ReturnType<typeof post>) => Promise<unknown>;
const call = (action: unknown, event: ReturnType<typeof post>) => (action as Invoke)(event);

/** A page load only reads `params`, `url` and `locals` off its event. */
type Load = (e: {
	params: { dance: string; id: string };
	url: URL;
	locals: unknown;
	cookies?: unknown;
}) => unknown;
const loadAt = (load: unknown, dance: string, id: string) =>
	(load as Load)({
		params: { dance, id },
		url: new URL('http://localhost/'),
		cookies: { get: () => undefined, delete: () => {} },
		locals: { user: { ...USER, dance } }
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
	insertFixturePositions(db);

	const salsaFigure = createFigure(db, U1_SALSA, { ...figureInput, style: 'salsa' })!;
	salsaExerciseId = addFigureExercise(db, 'u1', salsaFigure.figure.id)!.id;
	salsaFigureId = salsaFigure.figure.id;
	salsaFigureId2 = createFigure(db, U1_SALSA, {
		...figureInput,
		figureName: 'Second salsa figure',
		style: 'salsa'
	})!.figure.id;
	salsaRoutineAId = createRoutine(db, U1_SALSA, { name: 'Routine A', notes: null }).routine.id;
	salsaRoutineBId = createRoutine(db, U1_SALSA, { name: 'Routine B', notes: null }).routine.id;
	bachataRoutineId = createRoutine(db, U1_BACHATA, { name: 'Bachata routine', notes: null }).routine
		.id;
	const bachata = createFigure(db, U1_BACHATA, {
		...figureInput,
		figureName: 'Basico',
		style: 'sensual'
	})!;
	bachataFigureId = bachata.figure.id;
	bachataExerciseId = addFigureExercise(db, 'u1', bachata.figure.id)!.id;
	bachataCustomId = createCustomExercise(db, U1_BACHATA, {
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
	bachataSongId = createSongFromUrl(db, U1_BACHATA, {
		url: 'https://example.com/b',
		title: 'Bachata song',
		style: 'sensual'
	}).id;
	// `retry` only bites on a failed song, so put it there the way the worker would.
	failJob(db, bachataSongId, 'download failed', true);
	bachataLessonId = createLesson(db, U1_BACHATA, {
		lessonDay: '2020-01-01',
		title: 'Bachata class',
		notes: null
	}).lesson.id;
});

describe("Today refuses the other dance's rows", () => {
	it('will not save Done on an exercise from the other dance, today or a past day', async () => {
		for (const day of ['', '2020-01-01'])
			await refuses(
				todayActions.done,
				post('salsa', { exerciseId: String(bachataExerciseId), rating: '4', note: '', day })
			);
		expect(db.select().from(sets).all()).toHaveLength(1);
	});

	it("will not undo a save of the other dance's", async () => {
		await refuses(
			todayActions.undoDone,
			post('salsa', { setId: String(bachataSetId), before: '' })
		);
		expect(getSet(db, bachataSetId)).not.toBeNull();
	});

	it("will not put back the other dance's entry, by Undo or a day's restore", async () => {
		const snapshot = JSON.stringify({
			exerciseId: bachataExerciseId,
			doneAt: 1_000,
			durationS: null,
			reps: null,
			rating: null,
			note: null,
			playerJson: null
		});
		const salsaSet = logSet(db, {
			exerciseId: salsaExerciseId,
			doneAt: 1_000,
			durationS: 60,
			reps: null,
			rating: 3,
			note: null,
			playerJson: null
		});
		const before = db.select().from(sets).all();
		// The salsa row's Undo, handed the bachata exercise's snapshot: refused, nothing changes.
		const undone = await call(
			todayActions.undoDone,
			post('salsa', { setId: String(salsaSet.id), before: snapshot })
		);
		expect(undone).toMatchObject({ status: 400 });
		await refuses(
			exercisePage.actions.restoreDay,
			post('salsa', { snapshots: `[${snapshot}]` }, String(salsaExerciseId))
		);
		expect(db.select().from(sets).all()).toEqual(before);
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
		await call(todayActions.undoDone, post('salsa', { setId: String(salsaSet.id), before: '' }));
		expect(getSet(db, salsaSet.id)).toBeNull();
	});
});

describe("the player's song picker stays on its own side", () => {
	const ready = (dance: 'salsa' | 'bachata', title: string) => {
		const song = createSongFromUpload(
			db,
			{ userId: 'u1', dance },
			{
				file: `${title}.mp3`,
				mime: 'audio/mpeg',
				title,
				style: dance === 'salsa' ? 'salsa' : 'sensual'
			}
		);
		storeAnalysis(db, song.id, { beats: [0, 0.5], downbeats: [0], durationS: 1 });
		return song.id;
	};
	type PlayerLoad = (e: { params: { dance: string }; url: URL; locals: unknown }) => {
		songs: PickerSong[];
		back: { href: string; label: string };
		start: { source: string; songId: number | null; songGone: boolean };
	};
	const openPlayer = (dance: string, query: string) =>
		(playerLoad as unknown as PlayerLoad)({
			params: { dance },
			url: new URL(`http://localhost/${dance}/player?${query}`),
			locals: { user: { ...USER, dance } }
		});

	it("offers only this dance's ready songs, and refuses the other dance's by id", () => {
		const salsaSong = ready('salsa', 'Salsa ready');
		const bachataSong = ready('bachata', 'Bachata ready');
		// The failed `bachataSongId` from `beforeEach` is not ready, so it is not offered either.
		expect(openPlayer('salsa', '').songs.map((s) => [s.id, s.title])).toEqual([
			[salsaSong, 'Salsa ready']
		]);
		expect(openPlayer('bachata', '').songs.map((s) => [s.id, s.title])).toEqual([
			[bachataSong, 'Bachata ready']
		]);
		expect(() => openPlayer('salsa', `song=${bachataSong}`)).toThrow(threw404);
		expect(openPlayer('salsa', `song=${salsaSong}`).back).toEqual({
			href: `/salsa/songs/${salsaSong}`,
			label: 'Back to Salsa ready'
		});
		expect(openPlayer('salsa', `song=${salsaSong}`).start).toMatchObject({
			source: 'song',
			songId: salsaSong
		});
	});

	it('hands the client the graph as plain data, without the server’s canonical-id map', () => {
		const opened = openPlayer('salsa', '') as unknown as { graph: Record<string, unknown> };
		expect(opened.graph).toHaveProperty('figures');
		expect(opened.graph).toHaveProperty('positions');
		expect(opened.graph).not.toHaveProperty('canon');
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
		const bare = createFigure(db, U1_BACHATA, {
			...figureInput,
			figureName: 'Bare',
			style: 'sensual'
		})!;
		await refuses(figurePage.actions.practise, post('salsa', {}, String(bare.figure.id)));
		expect(getFigure(db, bare.figure.id, 'u1')?.exercise).toBeNull();
	});

	it('gives a figure its exercise from its own dance', async () => {
		const bare = createFigure(db, U1_SALSA, {
			...figureInput,
			figureName: 'Bare',
			style: 'salsa'
		})!;
		await call(figurePage.actions.practise, post('salsa', {}, String(bare.figure.id)));
		expect(getFigure(db, bare.figure.id, 'u1')?.exercise?.source).toBe('figure');
	});

	it('will not open a bachata figure from a salsa URL', () => {
		expect(loadAt(figurePage.load, 'bachata', String(bachataFigureId))).toMatchObject({
			figure: { name: 'Basico' }
		});
		expect(() => loadAt(figurePage.load, 'salsa', String(bachataFigureId))).toThrow(threw404);
	});

	it('will not archive a bachata figure from a salsa URL', async () => {
		await refuses(figurePage.actions.archive, post('salsa', {}, String(bachataFigureId)));
		expect(getFigure(db, bachataFigureId, 'u1')?.figure.archivedAt).toBeNull();
	});

	it("will not delete a bachata figure's set from a salsa URL", async () => {
		await refuses(figurePage.actions.deleteSet, post('salsa', { setId: String(bachataSetId) }));
		expect(getSet(db, bachataSetId)).not.toBeNull();
	});

	/** A complete, valid edit of a variation — each test overrides only what it is about. */
	const edit = (fields: Record<string, string | string[]>) => ({
		figureName: 'Dile que no',
		name: 'Renamed',
		partner: 'partner',
		style: 'salsa',
		startCount: '1',
		lengthCounts: '8',
		...fields
	});

	const groupOf = (id: number) => getFigure(db, id, 'u1')!.figure.groupId!;

	it('refuses an edit of a variation from the other dance, writing nothing', async () => {
		// A BACHATA position on a BACHATA variation: `setFigureShape`'s own
		// per-position dance check would ACCEPT this payload, so the only thing
		// that can refuse it is the route's `variationOf` guard.
		const bachataClosed = listPositions(db, U1_BACHATA).find((p) => p.slug === 'closed')!;
		await refuses(
			figurePage.actions.update,
			post(
				'salsa',
				edit({ figureName: 'Basico', startIds: String(bachataClosed.id) }),
				String(bachataFigureId)
			)
		);
		expect(figurePositions(db, bachataFigureId)).toEqual({ startIds: [], endIds: [] });
		expect(getFigure(db, bachataFigureId, 'u1')!.figure.name).toBe('Basic');
	});

	it('refuses a position from the other dance on a variation of this one — names included', async () => {
		const bachataShadow = listPositions(db, U1_BACHATA).find((p) => p.slug === 'shadow')!;
		await refuses(
			figurePage.actions.update,
			post(
				'salsa',
				edit({ figureName: 'Renamed figure', startIds: String(bachataShadow.id) }),
				String(salsaFigureId)
			)
		);
		// The shape half refused, so neither name may have been written either.
		expect(getFigure(db, salsaFigureId, 'u1')!.figure.name).toBe('Basic');
		expect(getGroup(db, groupOf(salsaFigureId))!.name).toBe('Dile que no');
	});

	it('refuses out-of-range timing with a message, writing nothing', async () => {
		const before = getFigure(db, salsaFigureId, 'u1')!.figure;
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
		const after = getFigure(db, salsaFigureId, 'u1')!.figure;
		expect(after.name).toBe(before.name);
		expect(after.lengthCounts).toBe(before.lengthCounts);
	});

	describe('one variation per URL', () => {
		const loadWith = (dance: string, id: string, search = '') =>
			(figurePage.load as unknown as (e: unknown) => unknown)({
				params: { dance, id },
				url: new URL(`http://localhost/${search}`),
				locals: { user: { ...USER, dance } }
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
			listPositions(db, U1_SALSA).find((p) => p.slug === slug)!;

		it('loads the variation, its figure, its siblings and where it can move', () => {
			const v = doble();
			setFigureShape(db, v.id, {
				startIds: [salsaPosition('cross-hand').id, salsaPosition('closed').id],
				endIds: [salsaPosition('caida').id],
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
			expect(loadWith('salsa', String(v.id))).toMatchObject({
				figure: { id: groupOf(salsaFigureId), name: 'Dile que no' },
				variation: { id: v.id, name: 'Doble', partner: 'partner', styleTag: 'salsa' },
				shape: { startCount: 5, lengthCounts: 4 },
				siblings: [
					{
						id: salsaFigureId,
						name: 'Basic',
						// Untagged: no position, which fits anywhere.
						holds: 'No position',
						timing: 'Starts on 1 · 8 counts',
						videos: 0
					},
					{
						id: v.id,
						name: 'Doble',
						holds: 'Cerrada or Manos cruzadas → Caída',
						timing: 'Starts on 5 · 4 counts',
						videos: 1
					}
				],
				moveTargets: [
					{ id: groupOf(salsaFigureId2), name: 'Second salsa figure', variations: ['Basic'] }
				]
			});
		});

		it('Handholds: the figure’s own tags by their real ids, live ones only, a group’s it uses included', () => {
			const T = 1_790_000_000_000;
			const EVA = { teamId: 1, actorId: 'u5', dance: 'salsa' } as const;
			createTeam(db, 'u5', 'salsa', 'Rueda club', T);
			joinTeam(db, 'u1', 1, T);
			// u1's own Abierta and the group's are one family; the page links the group's real row.
			addPosition(db, U1_SALSA, 'Abierta mía', { geneId: 'g-open' });
			const theirOpen = addPosition(db, EVA, 'Abierta', { geneId: 'g-open' });
			const F = createFigure(db, EVA, { ...figureInput, figureName: 'Vacilala', style: 'salsa' })!
				.figure.id;
			setFigureShape(
				db,
				F,
				{ startIds: [theirOpen], endIds: [], startCount: 1, lengthCounts: 8 },
				'u5'
			);
			const L = createLesson(db, EVA, { lessonDay: '2026-11-03', title: 'W1', notes: null }).lesson
				.id;
			linkFigure(db, L, F, 'u5');
			publishLesson(db, EVA, L, T);
			addLesson(db, 'u1', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, T);

			const old = addPosition(db, U1_SALSA, 'Vieja');
			const v = doble();
			const closed = salsaPosition('closed').id;
			const cross = salsaPosition('cross-hand').id;
			expect(
				setFigureShape(db, v.id, {
					startIds: [cross, closed],
					endIds: [theirOpen, old],
					startCount: 1,
					lengthCounts: 8
				})
			).toBe(true);
			// An archived position is invisible but kept (ruling 4).
			db.update(positions).set({ archivedAt: T }).where(eq(positions.id, old)).run();

			const data = loadWith('salsa', String(v.id)) as {
				handholds: { starts: { id: number; name: string }[]; ends: { id: number; name: string }[] };
				siblings: { id: number; holds: string }[];
			};
			expect(data.handholds).toEqual({
				starts: [
					{ id: closed, name: 'Cerrada' },
					{ id: cross, name: 'Manos cruzadas' }
				],
				ends: [{ id: theirOpen, name: 'Abierta' }]
			});
			expect(data.siblings.find((s) => s.id === v.id)?.holds).toBe(
				'Cerrada or Manos cruzadas → Abierta'
			);
			// The untagged one: nothing on either side, which the page reads as "fits anywhere".
			expect(
				(
					loadWith('salsa', String(salsaFigureId)) as {
						handholds: { starts: unknown[]; ends: unknown[] };
					}
				).handholds
			).toEqual({ starts: [], ends: [] });
		});

		it('Leads to and Follows from walk the viewer’s graph: a group’s position they use counts', () => {
			const T = 1_790_000_000_000;
			const EVA = { teamId: 1, actorId: 'u5', dance: 'salsa' } as const;
			createTeam(db, 'u5', 'salsa', 'Rueda club', T);
			joinTeam(db, 'u1', 1, T);
			// u1 has no member of the Abierta family: only the group's.
			const theirOpen = addPosition(db, EVA, 'Abierta', { geneId: 'g-open' });
			const F = createFigure(db, EVA, { ...figureInput, figureName: 'Vacilala', style: 'salsa' })!
				.figure.id;
			setFigureShape(
				db,
				F,
				{ startIds: [theirOpen], endIds: [], startCount: 1, lengthCounts: 8 },
				'u5'
			);
			const L = createLesson(db, EVA, { lessonDay: '2026-11-03', title: 'W1', notes: null }).lesson
				.id;
			linkFigure(db, L, F, 'u5');
			publishLesson(db, EVA, L, T);
			addLesson(db, 'u1', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, T);

			const A = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'A', style: 'salsa' })!
				.figure.id;
			expect(
				setFigureShape(db, A, {
					startIds: [],
					endIds: [theirOpen],
					startCount: 1,
					lengthCounts: 8
				})
			).toBe(true);
			const B = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'B', style: 'salsa' })!
				.figure.id;
			setFigureShape(db, B, {
				startIds: [salsaPosition('closed').id],
				endIds: [],
				startCount: 1,
				lengthCounts: 8
			});

			type Linked = { leadsTo: { id: number; name: string }[]; followsFrom: { id: number }[] };
			const a = loadWith('salsa', String(A)) as Linked;
			const leads = a.leadsTo.map((x) => x.id);
			// A ends in the group's Abierta: B (from Cerrada) cannot follow it…
			expect(leads).not.toContain(B);
			// …the group's figure starting there can, named; an untagged figure fits anywhere.
			expect(a.leadsTo).toContainEqual({ id: F, name: 'Vacilala · Basic' });
			expect(leads).toContain(salsaFigureId);
			// The other way round: B's Follows from leaves A out.
			const b = loadWith('salsa', String(B)) as Linked;
			expect(b.followsFrom.map((x) => x.id)).not.toContain(A);
		});

		it('load lists the routines that use the variation', () => {
			createRoutineFromFigures(db, U1_SALSA, { name: 'Set A', notes: null }, [
				salsaFigureId2,
				salsaFigureId
			]);
			const second = createRoutineFromFigures(db, U1_SALSA, { name: 'Old set', notes: null }, [
				salsaFigureId
			])!;
			archiveRoutine(db, second.routine.id, Date.now());
			const data = loadWith('salsa', String(salsaFigureId)) as { routines: unknown[] };
			expect(data.routines).toHaveLength(1);
			expect(data).toMatchObject({ routines: [{ name: 'Set A', slots: [2], slotCount: 2 }] });
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

		it('an archived variation is a 404; a save on it says it is gone', async () => {
			const v = doble();
			archiveVariation(db, v.id, 1_000);
			expect(() => loadWith('salsa', String(v.id))).toThrow(threw404);
			// The clash check's answer, so the typed text stays to copy (Task 11).
			expect(
				await call(figurePage.actions.update, post('salsa', edit({}), String(v.id)))
			).toMatchObject({ status: 410, data: { gone: { by: null, at: null } } });
			expect(getFigure(db, v.id, 'u1')!.figure.name).toBe('Doble');
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
			const row = getFigure(db, salsaFigureId, 'u1')!.figure;
			expect([row.name, row.startCount, row.lengthCounts]).toEqual(['Renamed', 5, 4]);
			expect(getGroup(db, row.groupId!)!.name).toBe('DILE QUE NO');
		});

		const sorted = (ids: number[]) => [...ids].sort((x, y) => x - y);
		type Choices = { title: string; entries: { value: number; label: string; meta?: string }[] }[];
		const valuesIn = (groups: Choices) => groups.flatMap((g) => g.entries.map((e) => e.value));

		it('update stores any number of starts and ends; none at all clears them', async () => {
			const [a, b] = sorted([salsaPosition('closed').id, salsaPosition('caida').id]);
			const c = salsaPosition('cross-hand').id;
			const id = String(salsaFigureId);
			expect(
				await call(
					figurePage.actions.update,
					post('salsa', edit({ startIds: [String(c)], endIds: [String(b), String(a)] }), id)
				)
			).toEqual({ action: 'update', ok: true });
			expect(figurePositions(db, salsaFigureId)).toEqual({ startIds: [c], endIds: [a, b] });
			// The form shows every chosen one again.
			expect(loadWith('salsa', id)).toMatchObject({ tags: { startIds: [c], endIds: [a, b] } });
			// Two ends, one of them swapped: the other stays.
			await call(
				figurePage.actions.update,
				post('salsa', edit({ startIds: [String(c)], endIds: [String(a), String(c)] }), id)
			);
			expect(figurePositions(db, salsaFigureId)).toEqual({
				startIds: [c],
				endIds: sorted([a, c])
			});
			// Nothing posted: no position on either side.
			await call(figurePage.actions.update, post('salsa', edit({}), id));
			expect(figurePositions(db, salsaFigureId)).toEqual({ startIds: [], endIds: [] });
		});

		it('a save keeps a tag to an archived position, which the picker never shows (ruling 4)', async () => {
			const a = salsaPosition('closed').id;
			const b = salsaPosition('caida').id;
			const old = addPosition(db, U1_SALSA, 'Vieja');
			const id = String(salsaFigureId);
			setFigureShape(db, salsaFigureId, {
				startIds: [old],
				endIds: [a, old],
				startCount: 1,
				lengthCounts: 8
			});
			db.update(positions).set({ archivedAt: 5 }).where(eq(positions.id, old)).run();
			const data = loadWith('salsa', id) as {
				tags: { startIds: number[]; endIds: number[] };
				positionChoices: Choices;
			};
			expect(data.tags).toEqual({ startIds: [], endIds: [a] });
			expect(valuesIn(data.positionChoices)).not.toContain(old);
			expect(valuesIn(data.positionChoices)).toContain(a);
			await call(figurePage.actions.update, post('salsa', edit({ endIds: [String(b)] }), id));
			expect(figurePositions(db, salsaFigureId)).toEqual({
				startIds: [old],
				endIds: sorted([b, old])
			});
		});

		it('a person’s figure offers their positions by type, the figure’s first, then a group’s they may use', async () => {
			const T = 1_790_000_000_000;
			const EVA = { teamId: 1, actorId: 'u5', dance: 'salsa' } as const;
			createTeam(db, 'u5', 'salsa', 'Rueda club', T);
			joinTeam(db, 'u1', 1, T);
			// The group's Abierta is one family with u1's own: a copy of theirs hides it.
			addPosition(db, U1_SALSA, 'Abierta mía', { geneId: 'g-open' });
			const theirOpen = addPosition(db, EVA, 'Abierta', { geneId: 'g-open' });
			const hammer = addPosition(db, EVA, 'Hammerlock');
			db.update(positions).set({ styleTag: 'salsa' }).where(eq(positions.id, hammer)).run();
			const closed = salsaPosition('closed').id;
			db.update(positions)
				.set({ styleTag: 'salsa', hands: 'two', frame: 'closed' })
				.where(eq(positions.id, closed))
				.run();
			const F = createFigure(db, EVA, { ...figureInput, figureName: 'Vacilala', style: 'salsa' })!
				.figure.id;
			setFigureShape(
				db,
				F,
				{ startIds: [theirOpen], endIds: [hammer], startCount: 1, lengthCounts: 8 },
				'u5'
			);
			const L = createLesson(db, EVA, { lessonDay: '2026-11-03', title: 'W1', notes: null }).lesson
				.id;
			linkFigure(db, L, F, 'u5');
			publishLesson(db, EVA, L, T);
			addLesson(db, 'u1', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, T);

			const id = String(salsaFigureId);
			const before = (loadWith('salsa', id) as { positionChoices: Choices }).positionChoices;
			expect(before.map((g) => g.title)).toEqual([
				'Salsa · this figure’s type',
				'Other',
				'Rueda club’s'
			]);
			expect(before[0].entries).toEqual([
				{ key: `position:${closed}`, value: closed, label: 'Cerrada', meta: 'Two hands · closed' }
			]);
			expect(before[2].entries).toEqual([
				{
					key: `position:${hammer}`,
					value: hammer,
					label: 'Hammerlock',
					meta: 'Salsa · tag with it as it is'
				}
			]);
			// Nobody else's, no group figure's own rows beyond what u1 may use.
			expect(valuesIn(before)).not.toContain(theirOpen);

			// Tagged with both of the group's: saved, and the chosen one is offered even though hidden.
			expect(
				await call(
					figurePage.actions.update,
					post('salsa', edit({ endIds: [String(theirOpen), String(hammer)] }), id)
				)
			).toEqual({ action: 'update', ok: true });
			expect(figurePositions(db, salsaFigureId).endIds).toEqual(sorted([theirOpen, hammer]));
			const after = loadWith('salsa', id) as { positionChoices: Choices; tags: unknown };
			expect(after.tags).toEqual({ startIds: [], endIds: sorted([theirOpen, hammer]) });
			expect(after.positionChoices.find((g) => g.title === 'Rueda club’s')!.entries).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ value: theirOpen, label: 'Abierta' }),
					expect.objectContaining({ value: hammer })
				])
			);
		});

		it('a group’s figure offers only the group’s positions', () => {
			const T = 1_790_000_000_000;
			createTeam(db, 'u1', 'salsa', 'Rueda club', T);
			const GROUP = { teamId: 1, actorId: 'u1', dance: 'salsa' } as const;
			const theirs = addPosition(db, GROUP, 'Cerrada');
			const F = createFigure(db, GROUP, { ...figureInput, figureName: 'Vacilala', style: 'salsa' })!
				.figure.id;
			const data = loadWith('salsa', String(F)) as { positionChoices: Choices; canEdit: boolean };
			expect(data.canEdit).toBe(true);
			expect(data.positionChoices).toEqual([
				{
					title: 'Other',
					entries: [{ key: `position:${theirs}`, value: theirs, label: 'Cerrada' }]
				}
			]);
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
				data: { action: 'update', message: "There's already a move called second salsa figure." }
			});
			const row = getFigure(db, salsaFigureId, 'u1')!.figure;
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
					message: 'Dile que no already has a figure called basic. Rename one first.'
				}
			});
			const row = getFigure(db, v.id, 'u1')!.figure;
			expect([row.name, row.lengthCounts]).toEqual(['Doble', 8]);
		});

		it('createVariation copies the current variation and opens it', async () => {
			const cross = salsaPosition('cross-hand').id;
			const caida = salsaPosition('caida').id;
			setFigureShape(db, salsaFigureId, {
				startIds: [cross],
				endIds: [caida],
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
			expect([made.name, made.startCount, made.lengthCounts]).toEqual(['Doble', 5, 4]);
			expect(figurePositions(db, made.id)).toEqual({ startIds: [cross], endIds: [caida] });
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
					field: 'name',
					name: ' basic ',
					message: 'Dile que no already has a figure called basic. Rename one first.'
				}
			});
			expect(
				await call(
					figurePage.actions.createVariation,
					post('salsa', { name: '  ' }, String(salsaFigureId))
				)
			).toMatchObject({
				status: 400,
				data: {
					field: 'name',
					message: 'Give the figure a name (up to 200 characters).'
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
					field: 'name',
					message: 'Second salsa figure already has a figure called Basic. Rename one first.'
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
				data: {
					action: 'move',
					field: 'figureName',
					message: "There's already a move called second salsa figure."
				}
			});
			const same = await call(
				figurePage.actions.move,
				post('salsa', { target: String(before) }, String(salsaFigureId))
			);
			expect(same).toMatchObject({ status: 400, data: { action: 'move' } });
			expect((same as { data: object }).data).not.toHaveProperty('field');
			expect(
				await call(
					figurePage.actions.move,
					post('salsa', { target: 'new', figureName: '' }, String(salsaFigureId))
				)
			).toMatchObject({ status: 400, data: { action: 'move', field: 'figureName' } });
			expect(groupOf(salsaFigureId)).toBe(before);
		});

		it('archive redirects to a sibling', async () => {
			const v = doble();
			// The lowest id is the one archived, so "the first one left" is the other.
			const thrown = await thrownBy(() =>
				call(figurePage.actions.archive, post('salsa', {}, String(salsaFigureId)))
			);
			expect(thrown).toMatchObject({ status: 303, location: `/salsa/figures/${v.id}` });
			expect(getFigure(db, salsaFigureId, 'u1')!.figure.archivedAt).not.toBeNull();
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
			expect(getFigure(db, v.id, 'u1')!.recordings.map((r) => r.id)).toEqual([rec.id]);
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
					message: "There's already a move called dile que no.",
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
				data: { message: 'Give the figure a name (up to 200 characters).' }
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
			const row = getFigure(db, id, 'u1')!.figure;
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
				data: { action: 'newFigure', message: "There's already a move called basico." }
			});
			expect(
				await call(
					lessonPage.actions.newFigure,
					post('bachata', { ...lesson, figureName: 'Paseo' }, String(bachataLessonId))
				)
			).toEqual({ action: 'newFigure', ok: true });
			expect(getLesson(db, bachataLessonId, 'u1')!.figures.map((f) => f.name)).toEqual([
				'Paseo · Doble'
			]);
		});

		const variationFields = (groupId: number, name = 'Doble') => ({
			groupId: String(groupId),
			name,
			partner: 'solo',
			style: 'sensual',
			notes: 'Spin'
		});

		it('newVariation links a blank variation to the lesson', async () => {
			const basico = groupOf(bachataFigureId);
			setFigureShape(db, bachataFigureId, {
				startIds: [listPositions(db, U1_BACHATA)[0].id],
				endIds: [listPositions(db, U1_BACHATA)[1].id],
				startCount: 5,
				lengthCounts: 4
			});
			expect(
				await call(
					lessonPage.actions.newVariation,
					post('bachata', variationFields(basico), String(bachataLessonId))
				)
			).toEqual({ action: 'newVariation', ok: true });
			const [, made] = listGroupVariations(db, basico);
			expect(made).toMatchObject({
				name: 'Doble',
				partner: 'solo',
				styleTag: 'sensual',
				notes: 'Spin',
				startCount: 1,
				lengthCounts: 8
			});
			expect(figurePositions(db, made.id)).toEqual({ startIds: [], endIds: [] });
			expect(getLesson(db, bachataLessonId, 'u1')!.figures.map((f) => [f.id, f.name])).toEqual([
				[made.id, 'Basico · Doble']
			]);
		});

		it('newVariation refuses a figure of the other dance', async () => {
			const salsa = groupOf(salsaFigureId);
			await refuses(
				lessonPage.actions.newVariation,
				post('bachata', variationFields(salsa), String(bachataLessonId))
			);
			expect(listGroupVariations(db, salsa)).toHaveLength(1);
			expect(getLesson(db, bachataLessonId, 'u1')!.figures).toEqual([]);
		});

		it('newVariation refuses a taken name', async () => {
			const basico = groupOf(bachataFigureId);
			expect(
				await call(
					lessonPage.actions.newVariation,
					post('bachata', variationFields(basico, 'basic'), String(bachataLessonId))
				)
			).toMatchObject({
				status: 400,
				data: {
					action: 'newVariation',
					message: 'Basico already has a figure called basic. Rename one first.',
					groupId: String(basico),
					name: 'basic',
					notes: 'Spin'
				}
			});
			expect(
				await call(
					lessonPage.actions.newVariation,
					post('bachata', { ...variationFields(basico), groupId: '' }, String(bachataLessonId))
				)
			).toMatchObject({ status: 400, data: { action: 'newVariation', message: 'Pick a move.' } });
			expect(
				await call(
					lessonPage.actions.newVariation,
					post('bachata', variationFields(basico, ''), String(bachataLessonId))
				)
			).toMatchObject({
				status: 400,
				data: {
					action: 'newVariation',
					message: 'Give the figure a name (up to 200 characters).'
				}
			});
			expect(listGroupVariations(db, basico)).toHaveLength(1);
			expect(getLesson(db, bachataLessonId, 'u1')!.figures).toEqual([]);
		});

		it('figure page: move with a name renames into the target', async () => {
			const target = groupOf(salsaFigureId2);
			const ex = getExercise(db, salsaExerciseId)!;
			let thrown: unknown;
			try {
				await call(
					figurePage.actions.move,
					post('salsa', { target: String(target), name: 'Basic 2' }, String(salsaFigureId))
				);
			} catch (e) {
				thrown = e;
			}
			expect(thrown).toMatchObject({ status: 303, location: `/salsa/figures/${salsaFigureId}` });
			const row = getFigure(db, salsaFigureId, 'u1')!.figure;
			expect([row.groupId, row.name]).toEqual([target, 'Basic 2']);
			expect(getExercise(db, ex.id)!.name).toBe('Second salsa figure · Basic 2');

			// A name taken in the target is refused, keeping what was typed.
			const back = groupOf(salsaFigureId2);
			createVariationFrom(db, salsaFigureId2, 'Doble');
			const other = createFigure(db, U1_SALSA, {
				...figureInput,
				figureName: 'Third',
				name: 'Solo',
				style: 'salsa'
			})!;
			expect(
				await call(
					figurePage.actions.move,
					post('salsa', { target: String(back), name: 'doble' }, String(other.figure.id))
				)
			).toMatchObject({
				status: 400,
				data: {
					action: 'move',
					field: 'name',
					message: 'Second salsa figure already has a figure called doble. Rename one first.',
					name: 'doble'
				}
			});
			expect(getFigure(db, other.figure.id, 'u1')!.figure.name).toBe('Solo');
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

	it('gives the lesson and figure Log the start-of-today schedule and the day', () => {
		const lesson = loadAt(lessonPage.load, 'bachata', String(bachataLessonId)) as {
			scheduleAtStart: { gap: number } | null;
			today: string;
		};
		expect(lesson.scheduleAtStart).toMatchObject({ gap: expect.any(Number) });
		expect(lesson.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		const figure = loadAt(figurePage.load, 'bachata', String(bachataFigureId)) as {
			scheduleAtStart: { gap: number } | null;
			today: string;
		};
		expect(figure.scheduleAtStart).toMatchObject({ gap: expect.any(Number) });
		expect(figure.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it('will not archive a bachata lesson from a salsa URL', async () => {
		await refuses(lessonPage.actions.archive, post('salsa', {}, String(bachataLessonId)));
		expect(getLesson(db, bachataLessonId, 'u1')?.lesson.archivedAt).toBeNull();
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

describe("the routine detail route refuses the other dance's rows", () => {
	it('will not open a bachata routine from a salsa URL', () => {
		expect(() => loadAt(routinePage.load, 'salsa', String(bachataRoutineId))).toThrow(threw404);
	});

	// `addOption`, `removeOption` and `note` all take a bare `stepId` with no
	// routine id to check it against — unlike `reorder`, `deleteMany`,
	// `duplicateMany` and `extract`, whose data functions take `routine.id`
	// natively and scope in SQL. For these three,
	// `ownsSlot` in the route is the ONLY guard: a same-dance slot from a
	// SECOND salsa routine passes `requireRoutineAccess` (routine A really is
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
		expect(listExercises(db, U1_SALSA).map((e) => e.name)).not.toContain('Smuggled');
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
		expect(listLessons(db, U1_SALSA)).toHaveLength(0);
	});
});

describe('the JSON endpoints refuse the other dance', () => {
	const at = (dance: string, id: string, init?: RequestInit) => ({
		params: { dance, id },
		request: new Request('http://localhost/', init),
		locals: { user: { ...USER, dance } }
	});
	type Handler = (e: ReturnType<typeof at>) => unknown;

	it('will not serve a bachata song’s grid under salsa, but does under bachata', async () => {
		// `bachataSongId` (from `beforeEach`) is `status: 'failed'`, which the
		// endpoint's OWN guard already 404s on — that would pass even with the
		// dance wall deleted, and prove nothing about it. A READY song is the
		// only way to isolate the wall: it must be the one thing standing
		// between a salsa request and a 200.
		const ready = createSongFromUpload(db, U1_BACHATA, {
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

describe('an account reaches only its own dance', () => {
	// Catches: a salsa account opening the bachata side through its URL, the
	// dance split's wall (wallOf compares the account's dance with the route's).
	it("refuses a salsa account's Today and Moves under /bachata", async () => {
		const asSalsa = (load: unknown) =>
			(load as Load)({
				params: { dance: 'bachata', id: '' },
				url: new URL('http://localhost/bachata'),
				cookies: { get: () => undefined, delete: () => {} },
				locals: { user: { ...USER, dance: 'salsa' } }
			});
		for (const load of [todayLoad, figureListLoad]) {
			let thrown: unknown = null;
			try {
				await asSalsa(load);
			} catch (e) {
				thrown = e;
			}
			expect(thrown).toEqual(threw404);
		}
	});
});
