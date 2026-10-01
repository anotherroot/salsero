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
	createFigure,
	createVariation,
	getFigure
} from '$lib/server/figures';
import {
	createCustomExercise,
	getExercise,
	getSet,
	listExercises,
	logSet
} from '$lib/server/exercises';
import {
	createSongFromUpload,
	createSongFromUrl,
	failJob,
	getSong,
	storeAnalysis
} from '$lib/server/songs';
import { createLesson, getLesson, listLessons } from '$lib/server/lessons';
import { figurePositions } from '$lib/server/graph';
import { getPosition, listPositions, seedPositions } from '$lib/server/positions';
import { addFigureSlot, addOption, createRoutine, routineSlots } from '$lib/server/routines';
import { exercises, lessons, links, sets } from '$lib/server/db/schema';
import { actions as todayActions } from './+page.server';
import { actions as playerActions } from './player/+page.server';
import { actions as songListActions } from './songs/+page.server';
import { actions as lessonListActions } from './lessons/+page.server';
import * as exercisePage from './exercises/[id]/+page.server';
import * as figurePage from './figures/[id]/+page.server';
import * as songPage from './songs/[id]/+page.server';
import * as lessonPage from './lessons/[id]/+page.server';
import * as positionsPage from './positions/+page.server';
import * as routinePage from './routines/[id]/+page.server';
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
	name: 'Dile que no',
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
		name: 'Second salsa figure',
		style: 'salsa'
	})!.figure.id;
	salsaRoutineAId = createRoutine(db, 'salsa', { name: 'Routine A', notes: null }).routine.id;
	salsaRoutineBId = createRoutine(db, 'salsa', { name: 'Routine B', notes: null }).routine.id;
	bachataRoutineId = createRoutine(db, 'bachata', { name: 'Bachata routine', notes: null }).routine
		.id;
	const bachata = createFigure(db, 'bachata', {
		...figureInput,
		name: 'Basico',
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
		const bare = createFigure(db, 'bachata', { ...figureInput, name: 'Bare', style: 'sensual' })!;
		await refuses(figurePage.actions.practise, post('salsa', {}, String(bare.figure.id)));
		expect(getFigure(db, bare.figure.id)?.exercise).toBeNull();
	});

	it('gives a figure its exercise from its own dance', async () => {
		const bare = createFigure(db, 'salsa', { ...figureInput, name: 'Bare', style: 'salsa' })!;
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

	/** A complete, valid figure edit — each test overrides only what it is about. */
	const edit = (fields: Record<string, string>) => ({
		name: 'Renamed',
		partner: 'partner',
		style: 'salsa',
		startCount: '1',
		lengthCounts: '8',
		...fields
	});

	it('refuses an edit of a figure from the other dance, writing nothing', async () => {
		// A BACHATA position on a BACHATA figure: `setFigureShape`'s own
		// per-position dance check would ACCEPT this payload, so the only thing
		// that can refuse it is the route's `figureOf` guard.
		const bachataClosed = listPositions(db, 'bachata').find((p) => p.slug === 'closed')!;
		const before = getFigure(db, bachataFigureId)!.figure.name;
		await refuses(
			figurePage.actions.update,
			post('salsa', edit({ startIds: String(bachataClosed.id) }), String(bachataFigureId))
		);
		expect(figurePositions(db, bachataFigureId)).toEqual({ startIds: [], endId: null });
		expect(getFigure(db, bachataFigureId)!.figure.name).toBe(before);
	});

	it('refuses a position from the other dance on a figure of this one — name included', async () => {
		const salsaFigureId = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure.id;
		const before = getFigure(db, salsaFigureId)!.figure.name;
		const bachataShadow = listPositions(db, 'bachata').find((p) => p.slug === 'shadow')!;
		await refuses(
			figurePage.actions.update,
			post('salsa', edit({ startIds: String(bachataShadow.id) }), String(salsaFigureId))
		);
		// The shape half refused, so the details half must not have run either.
		expect(getFigure(db, salsaFigureId)!.figure.name).toBe(before);
	});

	it('refuses out-of-range timing with a message, writing nothing', async () => {
		const salsaFigureId = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure.id;
		const before = getFigure(db, salsaFigureId)!.figure;
		const bads: Record<string, string>[] = [
			{ startCount: '0' },
			{ startCount: '9' },
			{ startCount: 'abc' },
			{ lengthCounts: '0' },
			{ lengthCounts: '65' }
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

	describe('variations', () => {
		const loadWith = (dance: string, id: string, search = '') =>
			(figurePage.load as unknown as (e: unknown) => unknown)({
				params: { dance, id },
				url: new URL(`http://localhost/${search}`),
				locals: { user: USER }
			});

		it('opens a variation’s own URL on its figure, with its tab chosen', () => {
			const parent = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
			expect(() => loadWith('salsa', String(v.id))).toThrow(
				expect.objectContaining({ status: 303, location: `/salsa/figures/${parent.id}?v=${v.id}` })
			);
		});

		it('will not redirect across the wall: a bachata variation under /salsa/ is a 404', () => {
			const v = createVariation(db, bachataFigureId, { name: 'Doble', notes: null })!;
			expect(() => loadWith('salsa', String(v.id))).toThrow(threw404);
		});

		it('shows the chosen tab, and falls back to Basic for a foreign ?v=', () => {
			const parent = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const v = createVariation(db, parent.id, { name: 'Doble', notes: 'Spot' })!;
			const other = createVariation(db, bachataFigureId, { name: 'Otra', notes: null })!;
			expect(loadWith('salsa', String(parent.id), `?v=${v.id}`)).toMatchObject({
				version: { id: v.id, name: 'Doble', notes: 'Spot', isVariation: true },
				versions: [
					{ id: parent.id, name: 'Basic' },
					{ id: v.id, name: 'Doble' }
				]
			});
			expect(loadWith('salsa', String(parent.id), `?v=${other.id}`)).toMatchObject({
				version: { id: parent.id, isVariation: false }
			});
		});

		/** A complete variation edit — each test overrides only what it is about. */
		const editV = (versionId: number, fields: Record<string, string> = {}) => ({
			versionId: String(versionId),
			name: 'Renamed',
			notes: '',
			startCount: '',
			lengthCounts: '',
			...fields
		});

		it('refuses to edit a variation of another figure, writing nothing', async () => {
			const a = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const b = createFigure(db, 'salsa', { ...figureInput, name: 'B', style: 'salsa' })!.figure;
			const vb = createVariation(db, b.id, { name: 'Doble', notes: null })!;
			await refuses(
				figurePage.actions.updateVariation,
				post('salsa', editV(vb.id, { lengthCounts: '4' }), String(a.id))
			);
			const row = getFigure(db, vb.id)!.figure;
			expect([row.name, row.lengthCounts]).toEqual(['Doble', null]);
		});

		it('refuses a sibling’s name before writing anything', async () => {
			const parent = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
			createVariation(db, parent.id, { name: 'Con giro', notes: null });
			const result = await call(
				figurePage.actions.updateVariation,
				post('salsa', editV(v.id, { name: 'con giro', lengthCounts: '4' }), String(parent.id))
			);
			expect(result).toMatchObject({ status: 400 });
			const row = getFigure(db, v.id)!.figure;
			expect([row.name, row.lengthCounts]).toEqual(['Doble', null]);
		});

		it('saves "same as Basic" as null and a stated value as itself', async () => {
			const parent = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const v = createVariation(db, parent.id, { name: 'Doble', notes: null })!;
			await call(
				figurePage.actions.updateVariation,
				post('salsa', editV(v.id, { name: 'Doble', startCount: '5' }), String(parent.id))
			);
			const row = getFigure(db, v.id)!.figure;
			expect([row.startCount, row.lengthCounts]).toEqual([5, null]);
		});

		it('refuses to archive a variation of another figure', async () => {
			const a = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const b = createFigure(db, 'salsa', { ...figureInput, name: 'B', style: 'salsa' })!.figure;
			const vb = createVariation(db, b.id, { name: 'Doble', notes: null })!;
			await refuses(
				figurePage.actions.archiveVariation,
				post('salsa', { versionId: String(vb.id) }, String(a.id))
			);
			expect(getFigure(db, vb.id)!.figure.archivedAt).toBeNull();
		});

		it('refuses to delete a recording of another figure’s variation', async () => {
			const a = createFigure(db, 'salsa', { ...figureInput, style: 'salsa' })!.figure;
			const b = createFigure(db, 'salsa', { ...figureInput, name: 'B', style: 'salsa' })!.figure;
			const vb = createVariation(db, b.id, { name: 'Doble', notes: null })!;
			const rec = addRecording(db, {
				figureId: vb.id,
				file: 'x.mp4',
				mime: 'video/mp4',
				kind: 'video',
				sizeBytes: 1,
				note: null
			});
			await refuses(
				figurePage.actions.deleteRecording,
				post('salsa', { versionId: String(vb.id), recordingId: String(rec.id) }, String(a.id))
			);
			expect(getFigure(db, vb.id)!.recordings.map((r) => r.id)).toEqual([rec.id]);
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

	it('will not add a bachata figure to a salsa routine', async () => {
		// A BACHATA FIGURE id on a SALSA routine: `requireRoutineInDance` already
		// accepts this routine (it is salsa), so only `addFigureSlot`'s own dance
		// check on the figure can refuse it. Posting a bachata ROUTINE id instead
		// would be rejected by `requireRoutineInDance` — a different guard — and
		// the test would still pass with `addFigureSlot`'s check deleted.
		const res = (await call(
			routinePage.actions.addFigure,
			post('salsa', { figureId: String(bachataFigureId) }, String(salsaRoutineAId))
		)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(res.data.message).toBe('That figure is not part of this dance.');
		expect(routineSlots(db, salsaRoutineAId)).toHaveLength(0);
	});

	it('will not delete a slot belonging to a different salsa routine', async () => {
		// The slot belongs to a DIFFERENT SALSA routine, not a bachata one: a
		// bachata slot id would already be turned away by `deleteSlot`'s own
		// `routine_id` match without proving anything about same-dance ownership,
		// which is the case that actually matters here.
		const stepId = addFigureSlot(db, salsaRoutineBId, salsaFigureId)!;
		const res = (await call(
			routinePage.actions.remove,
			post('salsa', { stepId: String(stepId) }, String(salsaRoutineAId))
		)) as { status: number; data: { message: string } };
		expect(res.status).toBe(400);
		expect(res.data.message).toBe('That slot is already gone.');
		expect(routineSlots(db, salsaRoutineBId)).toHaveLength(1);
	});

	// `addOption`, `removeOption` and `note` all take a bare `stepId` with no
	// routine id to check it against — unlike `remove` and `move`, whose data
	// functions take `routine.id` natively and scope in SQL. For these three,
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
