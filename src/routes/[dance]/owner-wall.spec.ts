/**
 * The owner wall, tested where it is reachable: the loads and actions.
 *
 * A wall is one person's side of one dance. These tests act as `u2` on rows
 * `u1` made IN THE SAME DANCE, so the dance part of the wall can never be what
 * refuses: every id in a form body that is another person's gets the same 404 a
 * missing row gets, and the row is untouched. Each area task appends its section.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { U1_BACHATA, U1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import {
	addFigureExercise,
	addRecording,
	createVariationFrom,
	createVariationIn,
	figureLabels,
	getFigure,
	getGroup,
	listFigures,
	listFiguresForCall,
	listGroupVariations,
	listMoveTargets,
	listVersions,
	moveVariation
} from '$lib/server/figures';
import { buildGraph, taggedFigures } from '$lib/server/graph';
import { getPosition, listPositions, seedPositions } from '$lib/server/positions';
import { createRoutineFromFigures } from '$lib/server/routines';
import { exercises, figureGroups, figures, recordings, routines } from '$lib/server/db/schema';
import * as figurePage from './figures/[id]/+page.server';
import * as figureList from './figures/+page.server';
import * as coveragePage from './coverage/+page.server';
import * as positionsPage from './positions/+page.server';

const U1 = { id: 'u1', email: 'u1@example.com', timezone: 'Europe/Ljubljana', isAdmin: true };
const U2 = { id: 'u2', email: 'u2@example.com', timezone: 'Europe/Ljubljana', isAdmin: false };
type User = typeof U1;

/** The shape an action destructures, with nothing in it the actions do not read. */
function post(user: User, dance: string, fields: Record<string, string>, id = '') {
	return {
		params: { dance, id },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user }
	};
}
type Event = ReturnType<typeof post>;
type Invoke = (event: Event) => Promise<unknown>;
const call = (action: unknown, event: Event) => (action as Invoke)(event);

type Load = (e: { params: { dance: string; id: string }; url: URL; locals: unknown }) => unknown;
const loadAt = (load: unknown, user: User, dance: string, id = '') =>
	(load as Load)({
		params: { dance, id },
		url: new URL('http://localhost/'),
		locals: { user }
	});

const threw404 = expect.objectContaining({ status: 404 });

/** Call an action and assert it refused with a 404 (a rejection or a sync throw). */
async function refuses(action: unknown, event: Event) {
	try {
		await call(action, event);
	} catch (thrown) {
		expect(thrown).toMatchObject({ status: 404 });
		return;
	}
	expect.unreachable('the cross-person call should have been refused');
}

/** What an action that ends in a redirect threw. */
async function redirectOf(
	action: unknown,
	event: Event
): Promise<{ status: number; location: string }> {
	try {
		await call(action, event);
	} catch (thrown) {
		return thrown as { status: number; location: string };
	}
	return expect.unreachable('expected a redirect');
}

const figureInput = {
	figureName: 'Enchufla',
	name: 'Basic',
	partner: 'partner' as const,
	style: 'salsa',
	notes: null
};

let db: Db;
let figureId: number;
let groupId: number;
let recordingId: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	seedPositions(db);
	const made = createFigure(db, U1_SALSA, figureInput)!;
	figureId = made.figure.id;
	groupId = made.group.id;
	recordingId = addRecording(db, {
		figureId,
		file: '00000000-0000-4000-8000-000000000001.mp4',
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: 10,
		note: null
	}).id;
});

import { createFigure } from '$lib/server/figures';

describe('figures: the data functions stand behind a wall', () => {
	it("lists show none of another person's figures, in the same dance", () => {
		expect(listFigures(db, U1_SALSA)).toHaveLength(1);
		expect(listFigures(db, U2_SALSA)).toEqual([]);
		expect(listVersions(db, U2_SALSA)).toEqual([]);
		expect(figureLabels(db, U2_SALSA).size).toBe(0);
		expect(listMoveTargets(db, U2_SALSA, null)).toEqual([]);
		expect(listFiguresForCall(db, U2_SALSA, [figureId])).toEqual([]);
		expect(buildGraph(db, U2_SALSA).figures).toEqual([]);
		expect(taggedFigures(db, U2_SALSA)).toEqual({ done: 0, total: 0 });
		// …and none of the same person's other dance.
		expect(listFigures(db, U1_BACHATA)).toEqual([]);
	});

	it('a second person can make a figure of the same name, each carrying its owner', () => {
		const theirs = createFigure(db, U2_SALSA, figureInput)!;
		expect(theirs.group.userId).toBe('u2');
		expect(theirs.figure.userId).toBe('u2');
		expect(listFigures(db, U2_SALSA).map((f) => f.name)).toEqual(['Enchufla']);
		expect(createFigure(db, U2_SALSA, figureInput)).toBeNull();
		expect(listFigures(db, U1_SALSA)).toHaveLength(1);
	});

	it('every create path carries the owner of the figure it extends', () => {
		const made = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Setenta' })!;
		expect(made.group.userId).toBe('u1');
		expect(made.figure.userId).toBe('u1');
		const into = createVariationIn(db, made.group.id, {
			name: 'Doble',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;
		expect(into.userId).toBe('u1');
		expect(createVariationFrom(db, into.id, 'Triple')!.userId).toBe('u1');
		expect(addFigureExercise(db, 'u1', into.id)!.userId).toBe('u1');
		const moved = moveVariation(db, into.id, { newFigure: 'Elsewhere' });
		expect(moved.ok).toBe(true);
		const groups = db.select().from(figureGroups).all();
		expect(groups.every((g) => g.userId === 'u1')).toBe(true);
	});

	it("a variation cannot be moved into another person's figure", () => {
		const theirs = createFigure(db, U2_SALSA, { ...figureInput, figureName: 'Theirs' })!;
		expect(moveVariation(db, theirs.figure.id, { groupId })).toEqual({ ok: false, reason: 'gone' });
		expect(getFigure(db, theirs.figure.id, 'u1')!.figure.groupId).toBe(theirs.group.id);
	});
});

describe("the figure page refuses another person's figure", () => {
	const snapshot = () => ({
		figure: db.select().from(figures).where(eq(figures.id, figureId)).get(),
		group: getGroup(db, groupId),
		variations: listGroupVariations(db, groupId).length,
		groups: db.select().from(figureGroups).all().length,
		recordings: db.select().from(recordings).all().length,
		exercises: db.select().from(exercises).all().length
	});

	it('load', () => {
		expect(() => loadAt(figurePage.load, U2, 'salsa', String(figureId))).toThrow(threw404);
		expect(loadAt(figurePage.load, U1, 'salsa', String(figureId))).toMatchObject({
			variation: { id: figureId }
		});
	});

	const actions: [string, Record<string, string>][] = [
		[
			'update',
			{
				figureName: 'Hijacked',
				name: 'Hijacked',
				partner: 'partner',
				style: 'salsa',
				startCount: '1',
				lengthCounts: '8'
			}
		],
		['createVariation', { name: 'Intruder' }],
		['move', { target: 'new', figureName: 'Stolen' }],
		['archive', {}],
		['practise', {}],
		['deleteRecording', { recordingId: '1' }],
		['linkSection', { spotId: '1' }],
		['unlinkSection', { linkId: '1' }],
		['addLink', { url: 'https://example.com/x' }],
		['deleteLink', { linkId: '1' }],
		['saveVideo', { linkId: '1' }],
		['retryVideo', { linkId: '1' }]
	];
	for (const [name, fields] of actions) {
		it(`${name} is a 404 and changes nothing`, async () => {
			const before = snapshot();
			await refuses(
				(figurePage.actions as Record<string, unknown>)[name],
				post(U2, 'salsa', fields, String(figureId))
			);
			expect(snapshot()).toEqual(before);
		});
	}

	it("a recording id in the form cannot reach another person's recording", async () => {
		// u2 owns a figure of their own and names u1's recording on it.
		const mine = createFigure(db, U2_SALSA, { ...figureInput, figureName: 'Mine' })!;
		const result = (await call(
			figurePage.actions.deleteRecording,
			post(U2, 'salsa', { recordingId: String(recordingId) }, String(mine.figure.id))
		)) as { status: number };
		expect(result.status).toBe(404);
		expect(db.select().from(recordings).all()).toHaveLength(1);
	});
});

describe("the figures list and coverage show only the person's own", () => {
	it('the list load', () => {
		const mine = loadAt(figureList.load, U1, 'salsa') as { figures: unknown[] };
		const theirs = loadAt(figureList.load, U2, 'salsa') as {
			figures: unknown[];
			tagged: { total: number };
			unlinked: number;
			unrouted: number;
		};
		expect(mine.figures).toHaveLength(1);
		expect(theirs.figures).toEqual([]);
		expect(theirs.tagged.total).toBe(0);
		expect(theirs.unrouted).toBe(0);
	});

	it('create makes the figure the signed-in person’s, and the same name is free for them', async () => {
		const redirect = await redirectOf(
			figureList.actions.create,
			post(U2, 'salsa', {
				figureName: 'Enchufla',
				name: 'Basic',
				partner: 'partner',
				style: 'salsa'
			})
		);
		expect(redirect.status).toBe(303);
		const rows = db.select().from(figureGroups).all();
		expect(rows.map((g) => [g.name, g.userId])).toEqual([
			['Enchufla', 'u1'],
			['Enchufla', 'u2']
		]);
		expect(
			db
				.select()
				.from(figures)
				.all()
				.map((f) => f.userId)
		).toEqual(['u1', 'u2']);
	});

	it('coverage lists none of u1’s versions', () => {
		const theirs = loadAt(coveragePage.load, U2, 'salsa') as { groups: unknown[] };
		expect(theirs.groups).toEqual([]);
		const mine = loadAt(coveragePage.load, U1, 'salsa') as { groups: unknown[] };
		expect(mine.groups.length).toBeGreaterThan(0);
	});

	it("a routine from a selection refuses another person's figure ids and writes nothing", async () => {
		await refuses(
			coveragePage.actions.create,
			post(U2, 'salsa', { name: 'Stolen set', figureIds: String(figureId) })
		);
		expect(db.select().from(routines).all()).toEqual([]);
		expect(db.select().from(exercises).all()).toEqual([]);
	});

	it('a routine from one’s own selection carries the owner, and so does its exercise', () => {
		const mine = createFigure(db, U2_SALSA, { ...figureInput, figureName: 'Mine' })!;
		const made = createRoutineFromFigures(db, U2_SALSA, { name: 'Set', notes: null }, [
			mine.figure.id
		])!;
		expect(made.routine.userId).toBe('u2');
		expect(made.exercise.userId).toBe('u2');
	});
});

describe('positions are shared, and only the admin changes them', () => {
	const neutralId = () => listPositions(db, 'salsa').find((p) => p.neutral)!.id;

	it('the load is open to everyone and says who may change them', () => {
		const theirs = loadAt(positionsPage.load, U2, 'salsa') as {
			isAdmin: boolean;
			positions: unknown[];
			tagged: { total: number };
		};
		expect(theirs.isAdmin).toBe(false);
		expect(theirs.positions.length).toBe(listPositions(db, 'salsa').length);
		// The counts are of the person's own figures: u2 has none.
		expect(theirs.tagged.total).toBe(0);
		expect((loadAt(positionsPage.load, U1, 'salsa') as { isAdmin: boolean }).isAdmin).toBe(true);
	});

	const actions: [string, () => Record<string, string>][] = [
		['create', () => ({ name: 'Brand new hold' })],
		['rename', () => ({ id: String(neutralId()), name: 'Renamed' })],
		['archive', () => ({ id: String(listPositions(db, 'salsa').find((p) => !p.neutral)!.id) })],
		['restore', () => ({ id: String(neutralId()) })]
	];
	for (const [name, fields] of actions) {
		it(`${name} is a 404 for someone who is not the admin, and changes nothing`, async () => {
			const before = JSON.stringify(listPositions(db, 'salsa'));
			await refuses(
				(positionsPage.actions as Record<string, unknown>)[name],
				post(U2, 'salsa', fields())
			);
			expect(JSON.stringify(listPositions(db, 'salsa'))).toBe(before);
			expect(getPosition(db, neutralId())!.name).not.toBe('Renamed');
		});
	}

	it('the admin still can', async () => {
		await call(positionsPage.actions.create, post(U1, 'salsa', { name: 'Brand new hold' }));
		expect(listPositions(db, 'salsa').map((p) => p.name)).toContain('Brand new hold');
	});

	it("tagging a figure with positions stays the figure owner's action", async () => {
		const id = listPositions(db, 'salsa').find((p) => !p.neutral)!.id;
		await refuses(
			figurePage.actions.update,
			post(
				U2,
				'salsa',
				{
					figureName: 'Enchufla',
					name: 'Basic',
					partner: 'partner',
					style: 'salsa',
					startCount: '1',
					lengthCounts: '8',
					endId: String(id)
				},
				String(figureId)
			)
		);
	});
});

/* ── Exercises, sets, Today, the player ───────────────────────────────── */

import {
	archiveExercise,
	createCustomExercise,
	exerciseHistory,
	getExercise,
	lastSets,
	listExercises,
	listPickExercises,
	listSetsBetween,
	listSetTimes,
	logSet,
	setPracticeSettings
} from '$lib/server/exercises';
import { createSongFromUpload } from '$lib/server/songs';
import { dueByDance } from '$lib/server/devices';
import { requireExerciseInWall, requireSetInWall } from '$lib/server/scope';
import { sets as setsTable, songs } from '$lib/server/db/schema';
import * as todayPage from './+page.server';
import * as exercisePage from './exercises/[id]/+page.server';
import * as practiceEndpoint from './exercises/[id]/practice/+server';
import * as playerPage from './player/+page.server';

describe('exercises: the data functions stand behind a wall', () => {
	let mine: number;
	beforeEach(() => {
		mine = createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 2, notes: null }).id;
		logSet(db, {
			exerciseId: mine,
			doneAt: 5000,
			durationS: 60,
			reps: null,
			rating: 3,
			note: null,
			playerJson: null
		});
	});

	it('a created exercise carries the wall owner and dance', () => {
		const row = getExercise(db, mine)!;
		expect(row.userId).toBe('u1');
		expect(row.dance).toBe('salsa');
		const other = createCustomExercise(db, U1_BACHATA, { name: 'B', everyDays: 1, notes: null });
		expect(other.userId).toBe('u1');
		expect(other.dance).toBe('bachata');
	});

	it("lists show none of another person's exercises or sets, in the same dance", () => {
		expect(listExercises(db, U1_SALSA)).toHaveLength(1);
		expect(listExercises(db, U2_SALSA)).toEqual([]);
		expect(listPickExercises(db, U2_SALSA)).toEqual([]);
		expect(listSetTimes(db, U1_SALSA)).toHaveLength(1);
		expect(listSetTimes(db, U2_SALSA)).toEqual([]);
		expect(listSetsBetween(db, 0, 10_000, U2_SALSA)).toEqual([]);
		expect(lastSets(db, U2_SALSA).size).toBe(0);
		expect(dueByDance(db, 'u2', 10 * 86_400_000, 'UTC')).toEqual({
			salsa: { due: [] },
			bachata: { due: [] }
		});
		expect(dueByDance(db, 'u1', 10 * 86_400_000, 'UTC').salsa.due).toEqual(['Clave']);
	});

	it('the guards refuse another person’s exercise and set with a 404', () => {
		const set = db.select().from(setsTable).get()!;
		expect(() => requireExerciseInWall(db, U2_SALSA, mine)).toThrow(
			expect.objectContaining({ status: 404 })
		);
		expect(() => requireSetInWall(db, U2_SALSA, set.id)).toThrow(
			expect.objectContaining({ status: 404 })
		);
		expect(requireExerciseInWall(db, U1_SALSA, mine).id).toBe(mine);
		expect(requireSetInWall(db, U1_SALSA, set.id).id).toBe(set.id);
	});

	it("a practice song must be the exercise's owner's", () => {
		const song = createSongFromUpload(db, U1_SALSA, {
			file: 's.m4a',
			mime: 'audio/mp4',
			title: 'S',
			style: 'salsa'
		});
		expect(song.userId).toBe('u1');
		const owned = (userId: string) =>
			db.update(songs).set({ status: 'ready', userId }).where(eq(songs.id, song.id)).run();
		const input = { mode: 'song', songId: song.id, countBpm: null, config: {} } as never;
		owned('u2');
		expect(setPracticeSettings(db, mine, input)).toBe(false);
		owned('u1');
		expect(setPracticeSettings(db, mine, input)).toBe(true);
	});
});

describe("Today, the exercise page and the player refuse another person's exercise", () => {
	let mine: number;
	let setId: number;
	beforeEach(() => {
		mine = createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 2, notes: 'n' }).id;
		setId = logSet(db, {
			exerciseId: mine,
			doneAt: Date.now(),
			durationS: 60,
			reps: null,
			rating: 3,
			note: null,
			playerJson: null
		}).id;
	});

	const unchanged = () => {
		const row = getExercise(db, mine)!;
		expect(row.archivedAt).toBeNull();
		expect(row.name).toBe('Clave');
		expect(row.notes).toBe('n');
		expect(exerciseHistory(db, mine)).toHaveLength(1);
	};

	it('Today shows none of the other person’s exercises or sets', async () => {
		const data = (await loadAt(todayPage.load, U2, 'salsa')) as {
			plan: { due: unknown[]; upcoming: unknown[]; doneToday: unknown[] };
			daySets: unknown[];
			exercises: unknown[];
			lastRatings: Record<string, unknown>;
		};
		expect(data.exercises).toEqual([]);
		expect(data.daySets).toEqual([]);
		expect(data.plan.due).toEqual([]);
		expect(Object.keys(data.lastRatings)).toEqual([]);
		const own = (await loadAt(todayPage.load, U1, 'salsa')) as typeof data;
		expect(own.exercises).toHaveLength(1);
	});

	it('creating an exercise on Today carries the person', async () => {
		await call(
			todayPage.actions.createExercise,
			post(U2, 'salsa', { name: 'Mine', everyDays: '3' })
		);
		const made = db.select().from(exercises).where(eq(exercises.name, 'Mine')).get()!;
		expect(made.userId).toBe('u2');
		expect(listExercises(db, U1_SALSA).map((e) => e.name)).toEqual(['Clave']);
	});

	it('logging, deleting and restoring a set of another person is a 404', async () => {
		await refuses(
			todayPage.actions.log,
			post(U2, 'salsa', { exerciseId: String(mine), reps: '5' })
		);
		await refuses(todayPage.actions.deleteSet, post(U2, 'salsa', { setId: String(setId) }));
		await refuses(
			todayPage.actions.restoreSet,
			post(U2, 'salsa', {
				snapshot: JSON.stringify({
					exerciseId: mine,
					doneAt: 1000,
					durationS: 5,
					reps: null,
					rating: null,
					note: null,
					playerJson: null
				})
			})
		);
		expect(exerciseHistory(db, mine)).toHaveLength(1);
		expect(db.select().from(setsTable).all()).toHaveLength(1);
	});

	it('the exercise page: load and every action by id are a 404, nothing changes', async () => {
		const id = String(mine);
		expect(() => loadAt(exercisePage.load, U2, 'salsa', id)).toThrow(threw404);
		for (const [name, fields] of [
			['log', { exerciseId: id, reps: '5' }],
			['deleteSet', { setId: String(setId) }],
			['update', { name: 'Hijack', everyDays: '1', notes: 'x' }],
			['archive', {}],
			['linkSection', { spotId: '1' }],
			['unlinkSection', { spotId: '1' }],
			['addLink', { url: 'https://example.com', title: 't' }],
			['deleteLink', { linkId: '1' }]
		] as const) {
			await refuses(
				(exercisePage.actions as Record<string, unknown>)[name],
				post(U2, 'salsa', { ...fields }, id)
			);
		}
		unchanged();
		expect(archiveExercise(db, mine, 1)).toBe(true);
	});

	it('the practice endpoint is a 404 for another person’s exercise', async () => {
		const get = practiceEndpoint.GET as unknown as (e: unknown) => unknown;
		const put = practiceEndpoint.POST as unknown as (e: unknown) => Promise<unknown>;
		expect(() =>
			get({ params: { dance: 'salsa', id: String(mine) }, locals: { user: U2 } })
		).toThrow(threw404);
		await expect(
			put({
				params: { dance: 'salsa', id: String(mine) },
				locals: { user: U2 },
				request: new Request('http://localhost/', {
					method: 'POST',
					body: JSON.stringify({ mode: 'count', countBpm: 100 })
				})
			})
		).rejects.toMatchObject({ status: 404 });
		expect(getExercise(db, mine)!.countBpm).toBeNull();
	});

	it('the player offers no exercise of another person, and refuses to save a run on it', async () => {
		const url = new URL(`http://localhost/?exercise=${mine}`);
		const load = playerPage.load as unknown as (e: unknown) => {
			exercise: unknown;
			exercises: unknown[];
		};
		const theirs = load({ url, params: { dance: 'salsa' }, locals: { user: U2 } });
		expect(theirs.exercise).toBeNull();
		expect(theirs.exercises).toEqual([]);
		expect(load({ url, params: { dance: 'salsa' }, locals: { user: U1 } }).exercise).not.toBeNull();
		await refuses(
			playerPage.actions.save,
			post(U2, 'salsa', { exerciseId: String(mine), durationS: '60' })
		);
		expect(exerciseHistory(db, mine)).toHaveLength(1);
	});
});

// ---- Songs and the count voice -------------------------------------------

import {
	createSongFromUrl,
	failJob,
	getSong,
	listSongs,
	recentSongIds,
	songChoices,
	storeAnalysis
} from '$lib/server/songs';
import { requireSongInWall } from '$lib/server/scope';
import {
	deleteCountTake,
	listCountTakes,
	putCountTake,
	restoreCountTake
} from '$lib/server/countTakes';
import { countTakes } from '$lib/server/db/schema';
import * as songList from './songs/+page.server';
import * as songPage from './songs/[id]/+page.server';
import * as songGrid from './songs/[id]/grid/+server';
import * as voicePage from '../voice/+page.server';

describe('songs: the data functions stand behind a wall', () => {
	let mine: number;
	beforeEach(() => {
		mine = createSongFromUpload(db, U1_SALSA, {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'Mine',
			style: 'salsa'
		}).id;
		storeAnalysis(db, mine, { beats: [0, 0.5, 1, 1.5], downbeats: [0], durationS: 2 });
	});

	it('both create paths carry the wall owner and dance', () => {
		const up = getSong(db, mine)!;
		expect([up.userId, up.dance]).toEqual(['u1', 'salsa']);
		const url = createSongFromUrl(db, U1_BACHATA, {
			url: 'https://x.test/',
			title: '',
			style: 'bachata'
		});
		expect([url.userId, url.dance]).toEqual(['u1', 'bachata']);
	});

	it("lists and choices show none of another person's songs, in the same dance", () => {
		expect(listSongs(db, U1_SALSA)).toHaveLength(1);
		expect(listSongs(db, U2_SALSA)).toEqual([]);
		expect(songChoices(db, U1_SALSA)).toHaveLength(1);
		expect(songChoices(db, U2_SALSA)).toEqual([]);
		expect(recentSongIds(db, U2_SALSA)).toEqual([]);
	});

	it("recent songs come from the person's own sets only", () => {
		const ex = createCustomExercise(db, U1_SALSA, { name: 'E', everyDays: 1, notes: null }).id;
		logSet(db, {
			exerciseId: ex,
			doneAt: 1,
			durationS: 60,
			reps: null,
			rating: null,
			note: null,
			playerJson: JSON.stringify({ songId: mine })
		});
		expect(recentSongIds(db, U1_SALSA)).toEqual([mine]);
		expect(recentSongIds(db, U2_SALSA)).toEqual([]);
	});

	it('the guard refuses another person’s song with a 404', () => {
		expect(() => requireSongInWall(db, U2_SALSA, mine)).toThrow(threw404);
		expect(() => requireSongInWall(db, U1_BACHATA, mine)).toThrow(threw404);
		expect(requireSongInWall(db, U1_SALSA, mine).id).toBe(mine);
	});
});

describe("the songs pages refuse another person's song", () => {
	let mine: number;
	let failed: number;
	beforeEach(() => {
		mine = createSongFromUpload(db, U1_SALSA, {
			file: 'a.m4a',
			mime: 'audio/mp4',
			title: 'Mine',
			style: 'salsa'
		}).id;
		storeAnalysis(db, mine, { beats: [0, 0.5, 1, 1.5], downbeats: [0], durationS: 2 });
		failed = createSongFromUrl(db, U1_SALSA, {
			url: 'https://x.test/',
			title: 'F',
			style: 'salsa'
		}).id;
		failJob(db, failed, 'nope', true);
	});

	it('the list shows none of them, and adding by URL makes the person’s own', async () => {
		const data = (await loadAt(songList.load, U2, 'salsa')) as { songs: unknown[] };
		expect(data.songs).toEqual([]);
		const own = (await loadAt(songList.load, U1, 'salsa')) as { songs: unknown[] };
		expect(own.songs).toHaveLength(2);
		await call(
			songList.actions.addUrl,
			post(U2, 'salsa', { url: 'https://y.test/', style: 'salsa' })
		);
		const added = db.select().from(songs).where(eq(songs.sourceUrl, 'https://y.test/')).get()!;
		expect(added.userId).toBe('u2');
	});

	it('retry on the list is a 404 and leaves the song failed', async () => {
		await refuses(songList.actions.retry, post(U2, 'salsa', { id: String(failed) }));
		expect(getSong(db, failed)!.status).toBe('failed');
	});

	it('the song page: load and every action are a 404, nothing changes', async () => {
		expect(() => loadAt(songPage.load, U2, 'salsa', String(mine))).toThrow(threw404);
		const before = getSong(db, mine)!;
		const names = Object.keys(songPage.actions);
		expect(names.length).toBeGreaterThan(5);
		for (const name of names) {
			const action = (songPage.actions as Record<string, unknown>)[name];
			await refuses(
				action,
				post(
					U2,
					'salsa',
					{ index: '1', factor: '0.5', startS: '1', title: 'Hijack', style: 'salsa' },
					String(mine)
				)
			);
		}
		expect(getSong(db, mine)).toEqual(before);
	});

	it('the grid endpoint is a 404 for another person', () => {
		const get = songGrid.GET as unknown as (e: unknown) => Response;
		const ev = (user: User) => ({ params: { dance: 'salsa', id: String(mine) }, locals: { user } });
		expect(() => get(ev(U2))).toThrow(threw404);
		expect(get(ev(U1)).status).toBe(200);
	});
});

describe('count takes are per person', () => {
	const take = (file: string, phrase: 'a' | 'b' = 'a') => ({
		pattern: 'salsa' as const,
		bpm: 120,
		phrase,
		file,
		sampleRate: 44100,
		preRollS: 0.1,
		lengthS: 1,
		durationS: 1.5,
		sizeBytes: 10
	});

	it('a take carries its owner, and the same slot is free for each person', () => {
		expect(putCountTake(db, 'u1', take('a.wav')).replaced).toBeNull();
		expect(putCountTake(db, 'u2', take('b.wav')).replaced).toBeNull();
		expect(listCountTakes(db, 'u1').map((t) => [t.userId, t.file])).toEqual([['u1', 'a.wav']]);
		expect(listCountTakes(db, 'u2').map((t) => [t.userId, t.file])).toEqual([['u2', 'b.wav']]);
	});

	it('replacing a take replaces only that person’s', () => {
		putCountTake(db, 'u1', take('a.wav'));
		putCountTake(db, 'u2', take('b.wav'));
		expect(putCountTake(db, 'u2', take('c.wav')).replaced).toBe('b.wav');
		expect(listCountTakes(db, 'u1').map((t) => t.file)).toEqual(['a.wav']);
		expect(listCountTakes(db, 'u2').map((t) => t.file)).toEqual(['c.wav']);
	});

	it('deleting another person’s take gives null and keeps it; restore goes back to the owner', () => {
		putCountTake(db, 'u1', take('a.wav'));
		const id = listCountTakes(db, 'u1')[0].id;
		expect(deleteCountTake(db, 'u2', id)).toBeNull();
		expect(listCountTakes(db, 'u1')).toHaveLength(1);
		const row = deleteCountTake(db, 'u1', id)!;
		putCountTake(db, 'u2', take('b.wav'));
		expect(restoreCountTake(db, row)).toBe('ok');
		expect(listCountTakes(db, 'u1').map((t) => t.file)).toEqual(['a.wav']);
		expect(listCountTakes(db, 'u2').map((t) => t.file)).toEqual(['b.wav']);
		const owners = db
			.select()
			.from(countTakes)
			.all()
			.map((t) => t.userId);
		expect(owners.sort()).toEqual(['u1', 'u2']);
	});

	it('/voice lists and deletes only the signed-in person’s takes', async () => {
		putCountTake(db, 'u1', take('a.wav'));
		const id = listCountTakes(db, 'u1')[0].id;
		const data = (await loadAt(voicePage.load, U2, 'salsa')) as { takes: unknown[] };
		expect(data.takes).toEqual([]);
		const res = (await call(voicePage.actions.delete, post(U2, 'salsa', { id: String(id) }))) as {
			status: number;
		};
		expect(res.status).toBe(404);
		expect(listCountTakes(db, 'u1')).toHaveLength(1);
	});

	it('a restore by another person finds no hold', async () => {
		putCountTake(db, 'u1', take('a.wav'));
		const id = listCountTakes(db, 'u1')[0].id;
		await call(voicePage.actions.delete, post(U1, 'salsa', { id: String(id) }));
		const res = (await call(voicePage.actions.restore, post(U2, 'salsa', { id: String(id) }))) as {
			status: number;
		};
		expect(res.status).toBe(410);
		expect(listCountTakes(db, 'u1')).toEqual([]);
		const ok = await call(voicePage.actions.restore, post(U1, 'salsa', { id: String(id) }));
		expect(ok).toEqual({ ok: true });
		expect(listCountTakes(db, 'u1')).toHaveLength(1);
	});
});

/* ── Routines ─────────────────────────────────────────────────────────── */

import {
	addChildSlot,
	addFigureSlot,
	addOption,
	createRoutine,
	duplicateRoutine,
	embeddable,
	extractRoutine,
	listPickRoutines,
	listRoutines,
	restoreOption,
	restoreSlots,
	routineShapes,
	routineSlots
} from '$lib/server/routines';
import { requireRoutineInWall } from '$lib/server/scope';
import * as routinePage from './routines/[id]/+page.server';
import * as routineList from './routines/+page.server';

describe('routines: the data functions stand behind a wall', () => {
	let mine: number;
	let theirs: number;

	beforeEach(() => {
		mine = createRoutine(db, U1_SALSA, { name: 'Mine', notes: null }).routine.id;
		theirs = createRoutine(db, U2_SALSA, { name: 'Theirs', notes: null }).routine.id;
	});

	it("lists, shapes and pickers show none of another person's routines, in the same dance", () => {
		expect(listRoutines(db, U1_SALSA).map((r) => r.name)).toEqual(['Mine']);
		expect(listRoutines(db, U2_SALSA).map((r) => r.name)).toEqual(['Theirs']);
		expect([...routineShapes(db, U1_SALSA).keys()]).toEqual([mine]);
		expect([...routineShapes(db, U2_SALSA).keys()]).toEqual([theirs]);
		expect(listPickRoutines(db, U2_SALSA).map((r) => r.id)).toEqual([theirs]);
		expect(listRoutines(db, U1_BACHATA)).toEqual([]);
	});

	it('every create path carries the wall owner, on the routine and on its exercise', () => {
		const exerciseOwner = (routineId: number) =>
			db.select().from(exercises).where(eq(exercises.routineId, routineId)).get()?.userId;
		const fromFigures = createRoutineFromFigures(
			db,
			U1_SALSA,
			{ name: 'FromFigures', notes: null },
			[figureId]
		)!;
		const copy = duplicateRoutine(db, mine)!;
		addFigureSlot(db, mine, figureId);
		const stepId = routineSlots(db, mine)[0].id;
		const extracted = extractRoutine(db, mine, [stepId], 'Extracted')!;
		for (const id of [mine, fromFigures.routine.id, copy.id, extracted.routineId]) {
			expect(getRoutineRow(id).userId).toBe('u1');
			expect(exerciseOwner(id)).toBe('u1');
		}
		expect(getRoutineRow(theirs).userId).toBe('u2');
		expect(exerciseOwner(theirs)).toBe('u2');
		// A copy of someone's routine is the copy-maker's only through their own wall:
		// duplicating keeps the source's owner, never a guess.
		expect(duplicateRoutine(db, theirs)!.userId).toBe('u2');
	});

	it('the library create action makes a routine for the signed-in person', async () => {
		const res = await redirectOf(
			routineList.actions.create,
			post(U2, 'salsa', { name: 'Another' })
		);
		expect(res.status).toBe(303);
		const id = Number(res.location.split('/').pop());
		expect(getRoutineRow(id).userId).toBe('u2');
		expect(db.select().from(exercises).where(eq(exercises.routineId, id)).get()?.userId).toBe('u2');
		expect(listRoutines(db, U1_SALSA).map((r) => r.name)).toEqual(['Mine']);
	});

	it("requireRoutineInWall gives another person's routine the missing one's 404", () => {
		expect(requireRoutineInWall(db, U1_SALSA, mine).id).toBe(mine);
		for (const id of [theirs, 9999]) {
			expect(() => requireRoutineInWall(db, U1_SALSA, id)).toThrow(threw404);
		}
		expect(() => requireRoutineInWall(db, U1_BACHATA, mine)).toThrow(threw404);
	});

	it("will not build a routine from another person's figure, and writes nothing", () => {
		const theirFigure = createFigure(db, U2_SALSA, { ...figureInput, figureName: 'Theirs' })!.figure
			.id;
		const before = db.select().from(routines).all().length;
		expect(
			createRoutineFromFigures(db, U1_SALSA, { name: 'X', notes: null }, [figureId, theirFigure])
		).toBeNull();
		expect(db.select().from(routines).all()).toHaveLength(before);
		expect(
			db
				.select()
				.from(exercises)
				.all()
				.filter((e) => e.name === 'X')
		).toEqual([]);
	});

	describe('ids in a form body from the other side of the wall', () => {
		let theirFigure: number;
		let sibling: number;

		beforeEach(() => {
			theirFigure = createFigure(db, U2_SALSA, { ...figureInput, figureName: 'Theirs' })!.figure.id;
			// Same landing as figureId, in u1's own wall: the control that a refusal
			// below comes from the wall and not from the alternative rules.
			sibling = createVariationIn(db, groupId, {
				name: 'Doble',
				partner: 'partner',
				style: 'salsa',
				notes: null
			})!.id;
		});

		it('accepts u1’s own sibling variation as an alternative (the control)', () => {
			const stepId = addFigureSlot(db, mine, figureId)!;
			expect(addOption(db, stepId, sibling)).toBe(true);
		});

		it("addOption, restoreOption and insertSlot refuse another person's figure", async () => {
			const stepId = addFigureSlot(db, mine, figureId)!;
			expect(addOption(db, stepId, theirFigure)).toBe(false);
			expect(restoreOption(db, stepId, theirFigure)).toBe(false);
			expect(addFigureSlot(db, mine, theirFigure)).toBeNull();
			const res = (await call(
				routinePage.actions.addOption,
				post(U1, 'salsa', { stepId: String(stepId), figureId: String(theirFigure) }, String(mine))
			)) as { status: number };
			expect(res.status).toBe(400);
			const inserted = (await call(
				routinePage.actions.insert,
				post(U1, 'salsa', { at: '0', figureId: String(theirFigure) }, String(mine))
			)) as { status: number };
			expect(inserted.status).toBe(400);
			expect(routineSlots(db, mine)).toHaveLength(1);
			expect(routineSlots(db, mine)[0].figureIds).toEqual([figureId]);
		});

		it('restoreSlots refuses a snapshot holding another person’s figure or routine', async () => {
			const figureSnap = [{ position: 0, childId: null, note: null, figureIds: [theirFigure] }];
			const childSnap = [{ position: 0, childId: theirs, note: null, figureIds: [] }];
			expect(restoreSlots(db, mine, figureSnap)).toBe(false);
			expect(restoreSlots(db, mine, childSnap)).toBe(false);
			for (const snap of [figureSnap, childSnap]) {
				const res = (await call(
					routinePage.actions.restore,
					post(U1, 'salsa', { snapshot: JSON.stringify(snap) }, String(mine))
				)) as { status: number };
				expect(res.status).toBe(400);
			}
			expect(routineSlots(db, mine)).toEqual([]);
		});

		it("will not embed another person's routine, and never offers it", async () => {
			expect(addChildSlot(db, mine, theirs)).toBeNull();
			expect(embeddable(db, mine)).toEqual([]);
			const res = (await call(
				routinePage.actions.insert,
				post(U1, 'salsa', { at: '0', childId: String(theirs) }, String(mine))
			)) as { status: number };
			expect(res.status).toBe(400);
			expect(routineSlots(db, mine)).toEqual([]);
			expect(routineSlots(db, theirs)).toEqual([]);
			// The control: u1's own second routine can be embedded.
			const own = createRoutine(db, U1_SALSA, { name: 'Own', notes: null }).routine.id;
			expect(embeddable(db, mine).map((r) => r.id)).toEqual([own]);
			expect(addChildSlot(db, mine, own)).not.toBeNull();
		});

		it('the coverage page 404s on another person’s figure id and writes nothing', async () => {
			const before = db.select().from(routines).all().length;
			await refuses(
				coveragePage.actions.create,
				post(U1, 'salsa', { name: 'Mix', figureIds: String(theirFigure) })
			);
			await refuses(coveragePage.actions.create, {
				...post(U1, 'salsa', {}),
				request: new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'application/x-www-form-urlencoded' },
					body: `name=Mix&figureIds=${figureId}&figureIds=${theirFigure}`
				})
			});
			expect(db.select().from(routines).all()).toHaveLength(before);
		});
	});
});

describe("the routine pages refuse another person's routine", () => {
	let mine: number;
	let theirs: number;
	let theirStep: number;

	beforeEach(() => {
		mine = createRoutine(db, U1_SALSA, { name: 'Mine', notes: 'n' }).routine.id;
		theirs = createRoutine(db, U2_SALSA, { name: 'Theirs', notes: null }).routine.id;
		addFigureSlot(db, mine, figureId);
		addFigureSlot(db, mine, figureId);
		theirStep = routineSlots(db, mine)[0].id;
	});

	const snapshot = () => ({
		routines: db.select().from(routines).all(),
		slots: routineSlots(db, mine),
		exercises: db.select().from(exercises).all()
	});

	it('the library lists none of u1’s routines for u2', async () => {
		const data = (await loadAt(routineList.load, U2, 'salsa')) as { routines: { id: number }[] };
		expect(data.routines.map((r) => r.id)).toEqual([theirs]);
		const own = (await loadAt(routineList.load, U1, 'salsa')) as { routines: { id: number }[] };
		expect(own.routines.map((r) => r.id)).toEqual([mine]);
	});

	it('the page 404s for another person, and for the same person in the other dance', () => {
		expect(() => loadAt(routinePage.load, U2, 'salsa', String(mine))).toThrow(threw404);
		expect(() => loadAt(routinePage.load, U1, 'bachata', String(mine))).toThrow(threw404);
		expect(() => loadAt(routinePage.load, U1, 'salsa', String(theirs))).toThrow(threw404);
		expect(loadAt(routinePage.load, U1, 'salsa', String(mine))).toMatchObject({
			routine: { id: mine }
		});
	});

	it.each([
		['rename', { name: 'Hijacked', notes: '' }],
		['duplicate', {}],
		['archive', {}],
		['addOption', { figureId: '1' }],
		['removeOption', { figureId: '1' }],
		['note', { note: 'Hijacked' }],
		['insert', { at: '0', figureId: '1' }],
		['reorder', { index: '1' }],
		['deleteMany', {}],
		[
			'restore',
			{ snapshot: JSON.stringify([{ position: 0, childId: null, note: null, figureIds: [1] }]) }
		],
		['restoreOption', { figureId: '1' }],
		['duplicateMany', {}],
		['extract', { name: 'Taken' }]
	])('%s on u1’s routine as u2 is a 404 and changes nothing', async (action, extra) => {
		const before = snapshot();
		const ids = { stepId: String(theirStep), stepIds: String(theirStep) };
		await refuses(
			routinePage.actions[action as keyof typeof routinePage.actions],
			post(U2, 'salsa', { ...ids, ...extra }, String(mine))
		);
		expect(snapshot()).toEqual(before);
	});

	it('u1 acting on u2’s routine is refused the same way', async () => {
		const before = snapshot();
		await refuses(
			routinePage.actions.rename,
			post(U1, 'salsa', { name: 'Hijacked', notes: '' }, String(theirs))
		);
		await refuses(routinePage.actions.archive, post(U1, 'salsa', {}, String(theirs)));
		await refuses(routinePage.actions.duplicate, post(U1, 'salsa', {}, String(theirs)));
		expect(snapshot()).toEqual(before);
		expect(db.select().from(routines).where(eq(routines.id, theirs)).get()).toMatchObject({
			name: 'Theirs',
			archivedAt: null
		});
	});
});

function getRoutineRow(id: number) {
	return db.select().from(routines).where(eq(routines.id, id)).get()!;
}

import {
	addLessonVideo,
	createLesson,
	getLesson,
	lessonDays,
	lessonVideoBytes,
	linkExercise,
	linkFigure,
	linkRoutine,
	listLessons,
	listLinkableExercises,
	listLinkableFigures,
	listLinkableRoutines,
	routineTaughtIn,
	taughtIn
} from '$lib/server/lessons';
import { addSpot } from '$lib/server/spots';
import { linkableSections, sectionsFor } from '$lib/server/spot-links';
import {
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessons,
	lessonVideos,
	links as linksTable,
	spotLinks
} from '$lib/server/db/schema';
import * as lessonPage from './lessons/[id]/+page.server';
import * as lessonList from './lessons/+page.server';
import * as sharePage from './share/+page.server';

describe('lessons, sections and their links stand behind a wall', () => {
	let mine: number;
	let theirFigure: number;
	let theirGroup: number;
	let theirRoutine: number;
	let theirDrill: number;
	let theirSection: number;
	let mySection: number;

	beforeEach(() => {
		mine = createLesson(db, U1_SALSA, { lessonDay: '2026-10-14', title: 'Mine', notes: 'n' }).lesson
			.id;
		const video = addLessonVideo(db, {
			lessonId: mine,
			file: '00000000-0000-4000-8000-0000000000d1.mp4',
			mime: 'video/mp4',
			sizeBytes: 100
		});
		mySection = addSpot(
			db,
			{ lessonVideoId: video.id },
			{ startMs: 0, endMs: 1000, label: 'My bit' }
		)!.id;

		const made = createFigure(db, U2_SALSA, { ...figureInput, figureName: 'Theirs' })!;
		theirFigure = made.figure.id;
		theirGroup = made.group.id;
		const theirRec = addRecording(db, {
			figureId: theirFigure,
			file: '00000000-0000-4000-8000-0000000000d2.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 50,
			note: null
		}).id;
		theirSection = addSpot(
			db,
			{ recordingId: theirRec },
			{ startMs: 0, endMs: 500, label: 'Their bit' }
		)!.id;
		theirRoutine = createRoutine(db, U2_SALSA, { name: 'Their routine', notes: null }).routine.id;
		theirDrill = createCustomExercise(db, U2_SALSA, {
			name: 'Their drill',
			everyDays: 3,
			notes: null
		}).id;
	});

	const snapshot = () => ({
		lessons: db.select().from(lessons).all(),
		exercises: db.select().from(exercises).all(),
		figures: db.select().from(figures).all(),
		groups: db.select().from(figureGroups).all(),
		routines: db.select().from(routines).all(),
		lessonFigures: db.select().from(lessonFigures).all(),
		lessonRoutines: db.select().from(lessonRoutines).all(),
		lessonExercises: db.select().from(lessonExercises).all(),
		lessonVideos: db.select().from(lessonVideos).all(),
		links: db.select().from(linksTable).all(),
		spotLinks: db.select().from(spotLinks).all()
	});

	it('a lesson and its review exercise carry the wall owner', () => {
		const { lesson, exercise } = getLesson(db, mine, 'u1')! as ReturnType<typeof getLesson> & {};
		expect([lesson.userId, lesson.dance]).toEqual(['u1', 'salsa']);
		expect([exercise!.userId, exercise!.dance]).toEqual(['u1', 'salsa']);
	});

	it("lists and Today's lesson days show none of another person's lessons", () => {
		expect(listLessons(db, U1_SALSA).map((l) => l.id)).toEqual([mine]);
		expect(listLessons(db, U2_SALSA)).toEqual([]);
		expect(Object.keys(lessonDays(db, U2_SALSA))).toEqual([]);
		expect(Object.keys(lessonDays(db, U1_SALSA))).toEqual([String(mine)]);
		expect(lessonVideoBytes(db, 'u1')).toBe(100);
		expect(lessonVideoBytes(db, 'u2')).toBe(0);
	});

	it("a lesson links none of another person's figures, routines or exercises", () => {
		const before = snapshot();
		expect(linkFigure(db, mine, theirFigure)).toBe(false);
		expect(linkRoutine(db, mine, theirRoutine)).toBe(false);
		expect(linkExercise(db, mine, theirDrill)).toBe(false);
		expect(snapshot()).toEqual(before);
		expect(listLinkableFigures(db, mine).map((f) => f.id)).not.toContain(theirFigure);
		expect(listLinkableRoutines(db, mine).map((r) => r.id)).not.toContain(theirRoutine);
		expect(listLinkableExercises(db, mine).map((e) => e.id)).not.toContain(theirDrill);
		// The owner's own figure still links.
		expect(linkFigure(db, mine, figureId)).toBe(true);
	});

	it("taught-in lists only the person's own lessons", () => {
		const theirLesson = createLesson(db, U2_SALSA, {
			lessonDay: '2026-10-14',
			title: 'Their lesson',
			notes: null
		}).lesson.id;
		const myRoutine = createRoutine(db, U1_SALSA, { name: 'R', notes: null }).routine.id;
		// Rows no data function writes any more, as old data could hold them.
		db.insert(lessonFigures).values({ lessonId: theirLesson, figureId }).run();
		db.insert(lessonRoutines).values({ lessonId: theirLesson, routineId: myRoutine }).run();
		expect(taughtIn(db, U1_SALSA, figureId)).toEqual([]);
		expect(routineTaughtIn(db, U1_SALSA, myRoutine)).toEqual([]);
	});

	it("the section picker lists only the person's own sections (R3)", () => {
		const offered = (groups: ReturnType<typeof linkableSections>) =>
			groups.flatMap((g) => g.sections.map((s) => s.id));
		expect(offered(linkableSections(db, { figureId }))).toEqual([mySection]);
		const myDrill = createCustomExercise(db, U1_SALSA, { name: 'D', everyDays: 3, notes: null }).id;
		expect(offered(linkableSections(db, { exerciseId: myDrill }))).toEqual([mySection]);
		expect(offered(linkableSections(db, { figureId: theirFigure }))).toEqual([theirSection]);
		// A link written before the wall still shows nothing of the other person's.
		db.insert(spotLinks).values({ spotId: theirSection, figureId }).run();
		expect(sectionsFor(db, { figureId })).toEqual([]);
	});

	it("the figure and exercise pages refuse another person's section id (R3)", async () => {
		const myDrill = createCustomExercise(db, U1_SALSA, { name: 'D', everyDays: 3, notes: null }).id;
		const figureData = (await loadAt(figurePage.load, U1, 'salsa', String(figureId))) as {
			linkable: { sections: { id: number }[] }[];
		};
		expect(figureData.linkable.flatMap((g) => g.sections.map((s) => s.id))).toEqual([mySection]);
		const exerciseData = (await loadAt(exercisePage.load, U1, 'salsa', String(myDrill))) as {
			linkable: { sections: { id: number }[] }[];
		};
		expect(exerciseData.linkable.flatMap((g) => g.sections.map((s) => s.id))).toEqual([mySection]);

		const before = snapshot();
		const onFigure = await call(
			figurePage.actions.linkSection,
			post(U1, 'salsa', { spotId: String(theirSection) }, String(figureId))
		);
		expect(onFigure).toMatchObject({ status: 400 });
		const onDrill = await call(
			exercisePage.actions.linkSection,
			post(U1, 'salsa', { spotId: String(theirSection) }, String(myDrill))
		);
		expect(onDrill).toMatchObject({ status: 400 });
		expect(snapshot()).toEqual(before);
		// The owner's own section links.
		await call(
			figurePage.actions.linkSection,
			post(U1, 'salsa', { spotId: String(mySection) }, String(figureId))
		);
		expect(db.select().from(spotLinks).all()).toHaveLength(1);
	});

	it('the lesson list, Today and the share sheet show u2 none of u1’s lessons', async () => {
		const list = (await loadAt(lessonList.load, U2, 'salsa')) as {
			lessons: unknown[];
			storageBytes: number;
		};
		expect(list.lessons).toEqual([]);
		expect(list.storageBytes).toBe(0);
		const share = (await (sharePage.load as unknown as Load)({
			params: { dance: 'salsa', id: '' },
			url: new URL('http://localhost/?key=0f8fad5b-d9cb-469f-a165-70867728950e'),
			locals: { user: U2 }
		})) as { lessons: unknown[] };
		expect(share.lessons).toEqual([]);
		const today = (await loadAt(todayPage.load, U2, 'salsa')) as {
			lessonDays: Record<string, string>;
		};
		expect(today.lessonDays).toEqual({});
	});

	it('a lesson made from the list belongs to whoever made it', async () => {
		const made = await redirectOf(
			lessonList.actions.create,
			post(U2, 'salsa', { title: 'Theirs', notes: '', everyDays: '3', lessonDay: '2026-10-01' })
		);
		const id = Number(made.location.split('/').pop());
		const { lesson, exercise } = getLesson(db, id, 'u2')!;
		expect([lesson.userId, exercise!.userId]).toEqual(['u2', 'u2']);
	});

	it('the lesson page 404s for another person', () => {
		expect(() => loadAt(lessonPage.load, U2, 'salsa', String(mine))).toThrow(threw404);
		expect(() => loadAt(lessonPage.load, U1, 'bachata', String(mine))).toThrow(threw404);
		expect(loadAt(lessonPage.load, U1, 'salsa', String(mine))).toMatchObject({
			lesson: { id: mine }
		});
	});

	it.each([
		['update', { title: 'Hijacked', notes: '', lessonDay: '2026-10-01' }],
		['archive', {}],
		['newFigure', { figureName: 'X', name: 'Y', partner: 'partner', style: 'salsa', notes: '' }],
		['newVariation', { groupId: '1', name: 'Y', partner: 'partner', style: 'salsa', notes: '' }],
		['newExercise', { name: 'X', everyDays: '3', notes: '' }],
		['newRoutine', { name: 'X', notes: '', everyDays: '3' }],
		['linkFigure', { figureId: '1' }],
		['unlinkFigure', { figureId: '1' }],
		['linkRoutine', { routineId: '1' }],
		['unlinkRoutine', { routineId: '1' }],
		['linkExercise', { exerciseId: '1' }],
		['unlinkExercise', { exerciseId: '1' }],
		['deleteVideo', { videoId: '1' }],
		['addLink', { urls: 'https://example.com/a' }],
		['deleteLink', { linkId: '1' }],
		['saveVideo', { linkId: '1' }],
		['retryVideo', { linkId: '1' }]
	])('%s on u1’s lesson as u2 is a 404 and changes nothing', async (action, fields) => {
		const before = snapshot();
		await refuses(
			lessonPage.actions[action as keyof typeof lessonPage.actions],
			post(U2, 'salsa', fields, String(mine))
		);
		expect(snapshot()).toEqual(before);
	});

	it('ids in a form body from another person are refused on one’s own lesson', async () => {
		const before = snapshot();
		const on = (action: keyof typeof lessonPage.actions, fields: Record<string, string>) =>
			call(lessonPage.actions[action], post(U1, 'salsa', fields, String(mine)));
		expect(await on('linkFigure', { figureId: String(theirFigure) })).toMatchObject({
			status: 400
		});
		expect(await on('linkRoutine', { routineId: String(theirRoutine) })).toMatchObject({
			status: 400
		});
		expect(await on('linkExercise', { exerciseId: String(theirDrill) })).toMatchObject({
			status: 400
		});
		await refuses(
			lessonPage.actions.newVariation,
			post(
				U1,
				'salsa',
				{ groupId: String(theirGroup), name: 'Y', partner: 'partner', style: 'salsa', notes: '' },
				String(mine)
			)
		);
		expect(snapshot()).toEqual(before);
	});
});
