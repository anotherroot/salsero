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

import { and, eq } from 'drizzle-orm';
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
import { buildGraph } from '$lib/server/graph';
import { listPositions } from '$lib/server/positions';
import { insertFixturePositions } from '$lib/server/test-positions';
import { createRoutineFromFigures } from '$lib/server/routines';
import { exercises, figureGroups, figures, recordings, routines } from '$lib/server/db/schema';
import * as figurePage from './figures/[id]/+page.server';
import * as figureList from './figures/+page.server';
import * as coveragePage from './coverage/+page.server';
import * as positionsPage from './positions/+page.server';
import * as positionPage from './positions/[id]/+page.server';

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
		cookies: { get: () => undefined, delete: () => {} },
		locals: { user }
	};
}
type Event = Omit<ReturnType<typeof post>, 'cookies'> & { cookies?: unknown };
type Invoke = (event: Event) => Promise<unknown>;
const call = (action: unknown, event: Event) => (action as Invoke)(event);

type Load = (e: {
	params: { dance: string; id: string };
	url: URL;
	locals: unknown;
	cookies?: unknown;
}) => unknown;
const loadAt = (load: unknown, user: User, dance: string, id = '') =>
	(load as Load)({
		params: { dance, id },
		url: new URL('http://localhost/'),
		cookies: { get: () => undefined, delete: () => {} },
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
	insertFixturePositions(db);
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
			unlinked: number;
			unrouted: number;
		};
		expect(mine.figures).toHaveLength(1);
		expect(theirs.figures).toEqual([]);
		expect(theirs).not.toHaveProperty('tagged');
		expect((loadAt(positionsPage.load, U2, 'salsa') as { tagged: unknown }).tagged).toEqual({
			done: 0,
			total: 0
		});
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

import { requirePositionAccess } from '$lib/server/scope';
import { addPosition } from '$lib/server/test-positions';
import { lessonPositions } from '$lib/server/db/schema';
import { setRole } from '$lib/server/membership';
import { publishLesson } from '$lib/server/lessons';
import { crossRefs } from '$lib/server/integrity';

describe('positions are each owner’s', () => {
	const U3 = { id: 'u3', email: 'u3@example.com', timezone: 'Europe/Ljubljana', isAdmin: false };
	const as = (user: User, dance = 'salsa') => [db, { user } as App.Locals, { dance }] as const;

	it("u2 gets the missing one's 404 reading or editing u1's position", () => {
		const id = listPositions(db, U1_SALSA)[0].id;
		expect(requirePositionAccess(...as(U1), id, 'edit').position.id).toBe(id);
		for (const target of [id, 9999]) {
			for (const need of ['read', 'edit'] as const) {
				expect(() => requirePositionAccess(...as(U2), target, need)).toThrow(threw404);
			}
		}
	});

	it('another dance’s position is a 404, its owner included', () => {
		const bachata = listPositions(db, U1_BACHATA)[0].id;
		expect(() => requirePositionAccess(...as(U1), bachata, 'read')).toThrow(threw404);
		const salsa = listPositions(db, U1_SALSA)[0].id;
		expect(() => requirePositionAccess(...as(U1, 'bachata'), salsa, 'read')).toThrow(threw404);
	});

	it('a member reads a group position a published lesson reaches, read-only; an editor edits it', () => {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		if (!made.ok) throw new Error('team expected');
		const T = { dance: 'salsa' as const, teamId: made.teamId, actorId: 'u1' };
		joinTeam(db, 'u2', T.teamId, 2);
		joinTeam(db, 'u3', T.teamId, 2);
		setRole(db, T.teamId, 'u3', 'editor');
		const ours = addPosition(db, T, 'Cerrada');
		const L = createLesson(db, T, { lessonDay: '2026-11-04', title: 'W1', notes: null }).lesson.id;
		db.insert(lessonPositions).values({ lessonId: L, positionId: ours }).run();

		// A draft reaches nobody.
		expect(() => requirePositionAccess(...as(U2), ours, 'read')).toThrow(threw404);
		expect(publishLesson(db, T, L, 3)).toBe(true);

		expect(requirePositionAccess(...as(U2), ours, 'read')).toMatchObject({
			access: 'read',
			space: { teamId: T.teamId, dance: 'salsa', actorId: 'u2' }
		});
		expect(() => requirePositionAccess(...as(U2), ours, 'edit')).toThrow(threw404);
		expect(requirePositionAccess(...as(U3), ours, 'edit')).toMatchObject({
			access: 'edit',
			reach: null,
			space: { teamId: T.teamId, actorId: 'u3' }
		});
		expect(crossRefs(db)).toEqual([]);
	});

	it("a position's page and its actions refuse another person's position", async () => {
		const id = listPositions(db, U1_SALSA)[0].id;
		expect(() => loadAt(positionPage.load, U2, 'salsa', String(id))).toThrow(threw404);
		expect(() => loadAt(positionPage.load, U1, 'bachata', String(id))).toThrow(threw404);
		for (const action of [
			'update',
			'archive',
			'restore',
			'makeMine',
			'detach',
			'linkSpot',
			'unlinkSpot',
			'linkLesson',
			'unlinkLesson'
		] as const) {
			await refuses(positionPage.actions[action], post(U2, 'salsa', { name: 'Mine' }, String(id)));
		}
		expect(listPositions(db, U1_SALSA)[0]).toMatchObject({ id, archivedAt: null });
		expect(
			(loadAt(positionPage.load, U1, 'salsa', String(id)) as { canEdit: boolean }).canEdit
		).toBe(true);
	});

	it('the load lists only the space’s own positions', () => {
		const theirs = loadAt(positionsPage.load, U2, 'salsa') as { rows: unknown[] };
		expect(theirs.rows).toEqual([]);
		const mine = loadAt(positionsPage.load, U1, 'salsa') as { rows: unknown[] };
		expect(mine.rows.length).toBe(listPositions(db, U1_SALSA).length);
	});

	it("tagging a figure with positions stays the figure owner's action", async () => {
		const id = listPositions(db, U1_SALSA)[1].id;
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
					endIds: String(id)
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
import * as songListLayout from './songs/+layout.server';
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
		const data = (await loadAt(songListLayout.load, U2, 'salsa')) as { songs: unknown[] };
		expect(data.songs).toEqual([]);
		const own = (await loadAt(songListLayout.load, U1, 'salsa')) as { songs: unknown[] };
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
import { requireRoutineAccess } from '$lib/server/scope';
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

	it("requireRoutineAccess gives another person's routine the missing one's 404", () => {
		const as = (dance: string) => [db, { user: U1 } as App.Locals, { dance }] as const;
		expect(requireRoutineAccess(...as('salsa'), mine, 'edit').routine.id).toBe(mine);
		for (const id of [theirs, 9999]) {
			for (const need of ['read', 'edit'] as const) {
				expect(() => requireRoutineAccess(...as('salsa'), id, need)).toThrow(threw404);
			}
		}
		expect(() => requireRoutineAccess(...as('bachata'), mine, 'read')).toThrow(threw404);
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

/* ── Group lessons: drafts, publish, and the reader's pages (groups Task 8) ── */

import { createTeam, joinTeam } from '$lib/server/teams';
import { linkInSpace } from '$lib/server/spot-links';
import {
	lessonAdds,
	links as linkRows,
	sets as setRows,
	teamMembers,
	videoSpots
} from '$lib/server/db/schema';
import type { TeamSpace } from '$lib/server/scope';
import * as groupPage from './groups/[id]/+page.server';
import * as linksEndpoint from '../api/video-spots/[id]/links/+server';
import * as spotsEndpoint from '../api/video-spots/+server';
import { addLesson, entryFor } from '$lib/server/entries';

describe('a group lesson: its draft, its publish, and what each person may open', () => {
	const U3 = { id: 'u3', email: 'u3@example.com', timezone: 'Europe/Ljubljana', isAdmin: false };
	const U4 = { id: 'u4', email: 'u4@example.com', timezone: 'Europe/Ljubljana', isAdmin: false };
	let T: TeamSpace;
	let P: number, D: number;
	let V2: number, V3: number, tGroup: number;
	let R: number, C: number, RD: number;
	let shines: number, draftDrill: number;
	let pVideo: number, dVideo: number, rec: number;
	let pSection: number, dSection: number, recSection: number;

	/** Strings and ids only the draft holds: none may reach a member's page. */
	const DRAFT_ONLY = [
		'Draft lesson Kappa',
		'Doble-only-in-draft',
		'Draft routine Zeta',
		'Draft drill Omega',
		'draft-video-kappa.mp4',
		'Draft section Sigma'
	];

	const lessonInput = (title: string) => ({ lessonDay: '2026-11-01', title, notes: null });
	const must = <T>(made: T | null | undefined | false): T => {
		if (!made) throw new Error('setup step refused');
		return made;
	};

	beforeEach(async () => {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		if (!made.ok) throw new Error('team expected');
		T = { dance: 'salsa', teamId: made.teamId, actorId: 'u1' };
		joinTeam(db, 'u2', T.teamId, 2);
		joinTeam(db, 'u4', T.teamId, 2);

		const fig = must(
			createFigure(db, T, {
				figureName: 'Enchufla',
				name: 'Basic',
				partner: 'partner',
				style: 'salsa',
				notes: null
			})
		);
		V2 = fig.figure.id;
		tGroup = fig.group.id;
		V3 = must(
			createVariationIn(
				db,
				tGroup,
				{
					name: 'Doble-only-in-draft',
					partner: 'partner',
					style: 'salsa',
					notes: null
				},
				'u1'
			)
		).id;
		rec = addRecording(
			db,
			{
				figureId: V2,
				file: '00000000-0000-4000-8000-0000000000e1.mp4',
				mime: 'video/mp4',
				kind: 'video',
				sizeBytes: 10,
				note: null
			},
			'u1'
		).id;
		// A section of V2's recording, linked to the draft's variation too.
		recSection = must(
			addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 9, label: 'R' }, 'u1')
		).id;
		linkInSpace(db, T, recSection, { figureId: V2 });
		linkInSpace(db, T, recSection, { figureId: V3 });

		C = createRoutine(db, T, { name: 'Child routine', notes: null }).routine.id;
		must(addFigureSlot(db, C, V2, 'u1'));
		R = createRoutine(db, T, { name: 'Published routine', notes: null }).routine.id;
		must(addChildSlot(db, R, C, 'u1'));
		RD = createRoutine(db, T, { name: 'Draft routine Zeta', notes: null }).routine.id;
		must(addFigureSlot(db, RD, V2, 'u1'));

		shines = createCustomExercise(db, T, { name: 'Shines', everyDays: 3, notes: null }).id;
		draftDrill = createCustomExercise(db, T, {
			name: 'Draft drill Omega',
			everyDays: 3,
			notes: null
		}).id;

		P = createLesson(db, T, lessonInput('Published lesson')).lesson.id;
		must(linkRoutine(db, P, R, 'u1'));
		must(linkFigure(db, P, V2, 'u1'));
		must(linkExercise(db, P, shines, 'u1'));
		pVideo = addLessonVideo(
			db,
			{
				lessonId: P,
				file: '00000000-0000-4000-8000-0000000000e2.mp4',
				mime: 'video/mp4',
				sizeBytes: 5
			},
			'u1'
		).id;
		pSection = must(
			addSpot(db, { lessonVideoId: pVideo }, { startMs: 0, endMs: 9, label: 'P' }, 'u1')
		).id;
		linkInSpace(db, T, pSection, { figureId: V2 });
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, P)).run();

		D = createLesson(db, T, lessonInput('Draft lesson Kappa')).lesson.id;
		must(linkFigure(db, D, V3, 'u1'));
		must(linkFigure(db, D, V2, 'u1'));
		must(linkRoutine(db, D, RD, 'u1'));
		must(linkRoutine(db, D, R, 'u1'));
		must(linkExercise(db, D, draftDrill, 'u1'));
		must(linkExercise(db, D, shines, 'u1'));
		dVideo = addLessonVideo(
			db,
			{
				lessonId: D,
				file: 'draft-video-kappa.mp4',
				mime: 'video/mp4',
				sizeBytes: 5
			},
			'u1'
		).id;
		dSection = must(
			addSpot(
				db,
				{ lessonVideoId: dVideo },
				{ startMs: 0, endMs: 9, label: 'Draft section Sigma' },
				'u1'
			)
		).id;
		linkInSpace(db, T, dSection, { figureId: V2 });
		linkInSpace(db, T, dSection, { exerciseId: shines });

		// u4 added P, then left before Keep: the row went, the add stayed; they read nothing.
		db.insert(lessonAdds).values({ userId: 'u4', lessonId: P, addedAt: 1, seenAt: 1 }).run();
		db.delete(teamMembers)
			.where(and(eq(teamMembers.teamId, T.teamId), eq(teamMembers.userId, 'u4')))
			.run();
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
		recordings: db.select().from(recordings).all(),
		links: db.select().from(linksTable).all(),
		spotLinks: db.select().from(spotLinks).all(),
		spots: db.select().from(videoSpots).all(),
		sets: db.select().from(setRows).all()
	});

	/** The page's data holds nothing only the draft has: no title, name or file. */
	function holdsNothingOfTheDraft(data: unknown) {
		const json = JSON.stringify(data);
		for (const s of DRAFT_ONLY) expect(json).not.toContain(s);
	}

	type Pages = 'lesson' | 'figure' | 'routine' | 'exercise';
	const LOADS: Record<Pages, unknown> = {
		lesson: lessonPage.load,
		figure: figurePage.load,
		routine: routinePage.load,
		exercise: exercisePage.load
	};
	const open = (page: Pages, user: User, id: number) =>
		loadAt(LOADS[page], user, 'salsa', String(id));

	it('an outsider gets 404 on every page of the group, published or not', () => {
		const pages: [Pages, number][] = [
			['lesson', P],
			['lesson', D],
			['figure', V2],
			['figure', V3],
			['routine', R],
			['routine', C],
			['routine', RD],
			['exercise', shines],
			['exercise', draftDrill]
		];
		for (const [page, id] of pages) expect(() => open(page, U3, id)).toThrow(threw404);
	});

	it('a member opens P and what it holds, read-only, and nothing of the draft', () => {
		const pages: [Pages, number][] = [
			['lesson', P],
			['figure', V2],
			['routine', R],
			['routine', C],
			['exercise', shines]
		];
		for (const [page, id] of pages) {
			const data = open(page, U2, id) as { canEdit: boolean };
			expect(data.canEdit).toBe(false);
			holdsNothingOfTheDraft(data);
		}
		const drafts: [Pages, number][] = [
			['lesson', D],
			['figure', V3],
			['routine', RD],
			['exercise', draftDrill]
		];
		for (const [page, id] of drafts) expect(() => open(page, U2, id)).toThrow(threw404);
	});

	it("a member's pages are built from what they reach, not from the group's whole space", () => {
		const lesson = open('lesson', U2, P) as {
			linkableFigures: unknown[];
			linkableRoutines: unknown[];
			linkableExercises: unknown[];
			figureGroups: unknown[];
			draft: boolean;
			team: { name: string };
		};
		expect([
			lesson.linkableFigures,
			lesson.linkableRoutines,
			lesson.linkableExercises,
			lesson.figureGroups
		]).toEqual([[], [], [], []]);
		expect([lesson.draft, lesson.team.name]).toEqual([false, 'Salsa nadaljevalna']);

		const figure = open('figure', U2, V2) as {
			siblings: { id: number }[];
			leadsTo: { id: number }[];
			followsFrom: { id: number }[];
			routines: { id: number }[];
			taughtIn: { id: number }[];
			linkable: unknown[];
			moveTargets: unknown[];
			variation: { sections: { spot: { id: number } }[] };
		};
		expect(figure.siblings.map((s) => s.id)).toEqual([V2]);
		expect([...figure.leadsTo, ...figure.followsFrom].map((f) => f.id)).not.toContain(V3);
		expect(figure.routines.map((r) => r.id)).not.toContain(RD);
		expect(figure.taughtIn.map((l) => l.id)).toEqual([P]);
		// P's section and the recording's, never the draft video's.
		expect(figure.variation.sections.map((s) => s.spot.id)).toEqual([pSection, recSection]);
		expect([figure.linkable, figure.moveTargets]).toEqual([[], []]);

		const routine = open('routine', U2, R) as {
			taughtIn: { id: number }[];
			candidates: unknown[];
			labels: Record<string, string>;
		};
		expect(routine.taughtIn.map((l) => l.id)).toEqual([P]);
		expect(routine.candidates).toEqual([]);
		expect(Object.keys(routine.labels).map(Number)).toEqual([V2]);
		const child = open('routine', U2, C) as { embeddedIn: string[] };
		expect(child.embeddedIn).toEqual(['Published routine']);

		const drill = open('exercise', U2, shines) as {
			canLog: boolean;
			linkable: unknown[];
			practice: { content: { sections: { spot: { id: number } }[] } };
		};
		expect(drill.canLog).toBe(false);
		expect(drill.linkable).toEqual([]);
		expect(drill.practice.content.sections).toEqual([]);
	});

	it('the editor sees the whole group, drafts included, and may change it', () => {
		const draft = open('lesson', U1, D) as { canEdit: boolean; draft: boolean };
		expect([draft.canEdit, draft.draft]).toEqual([true, true]);
		const figure = open('figure', U1, V2) as { canEdit: boolean; siblings: { id: number }[] };
		expect(figure.canEdit).toBe(true);
		expect(figure.siblings.map((s) => s.id)).toEqual([V2, V3]);
		expect((open('routine', U1, RD) as { canEdit: boolean }).canEdit).toBe(true);
		expect((open('exercise', U1, draftDrill) as { canEdit: boolean }).canEdit).toBe(true);
	});

	it('a former member who had added P reads nothing of the group: P, the draft, what P holds', () => {
		const pages: [Pages, number][] = [
			['lesson', P],
			['lesson', D],
			['figure', V2],
			['routine', R],
			['routine', C],
			['exercise', shines]
		];
		for (const [page, id] of pages) expect(() => open(page, U4, id)).toThrow(threw404);
	});

	const LESSON_ACTIONS: [
		string,
		(ids: { v: number; r: number; e: number }) => Record<string, string>
	][] = [
		['update', () => ({ title: 'Hijacked', notes: '', lessonDay: '2026-10-01' })],
		['publish', () => ({})],
		['archive', () => ({})],
		[
			'newFigure',
			() => ({ figureName: 'X', name: 'Y', partner: 'partner', style: 'salsa', notes: '' })
		],
		[
			'newVariation',
			() => ({ groupId: String(tGroup), name: 'Y', partner: 'partner', style: 'salsa', notes: '' })
		],
		['newExercise', () => ({ name: 'X', everyDays: '3', notes: '' })],
		['newRoutine', () => ({ name: 'X', notes: '', everyDays: '3' })],
		['linkFigure', ({ v }) => ({ figureId: String(v) })],
		['unlinkFigure', ({ v }) => ({ figureId: String(v) })],
		['linkRoutine', ({ r }) => ({ routineId: String(r) })],
		['unlinkRoutine', ({ r }) => ({ routineId: String(r) })],
		['linkExercise', ({ e }) => ({ exerciseId: String(e) })],
		['unlinkExercise', ({ e }) => ({ exerciseId: String(e) })],
		['deleteVideo', () => ({ videoId: String(pVideo) })],
		['addLink', () => ({ urls: 'https://example.com/a' })],
		['deleteLink', () => ({ linkId: '1' })],
		['saveVideo', () => ({ linkId: '1' })],
		['retryVideo', () => ({ linkId: '1' })],
		['log', ({ e }) => ({ exerciseId: String(e), durationS: '60' })]
	];

	it.each(LESSON_ACTIONS)(
		'%s on a group lesson is a 404 for a member and an outsider, and changes nothing',
		async (action, fields) => {
			const before = snapshot();
			for (const [user, lessonId] of [
				[U2, P],
				[U2, D],
				[U3, P],
				[U4, P]
			] as const) {
				await refuses(
					lessonPage.actions[action as keyof typeof lessonPage.actions],
					post(user, 'salsa', fields({ v: V2, r: R, e: shines }), String(lessonId))
				);
			}
			expect(snapshot()).toEqual(before);
		}
	);

	it.each([
		['update', {}],
		['createVariation', { name: 'Mine now' }],
		['move', { target: 'new', figureName: 'Elsewhere' }],
		['archive', {}],
		['deleteRecording', { recordingId: '0' }],
		['linkSection', { spotId: '0' }],
		['unlinkSection', { linkId: '0' }],
		['addLink', { urls: 'https://example.com/a' }],
		['deleteLink', { linkId: '1' }],
		['saveVideo', { linkId: '1' }],
		['retryVideo', { linkId: '1' }]
	])('%s on a group figure is a 404 for a member, and changes nothing', async (action, fields) => {
		const before = snapshot();
		const body = {
			...fields,
			...(action === 'deleteRecording' ? { recordingId: String(rec) } : {}),
			...(action === 'linkSection' ? { spotId: String(pSection) } : {})
		};
		for (const id of [V2, V3]) {
			await refuses(
				figurePage.actions[action as keyof typeof figurePage.actions],
				post(U2, 'salsa', body, String(id))
			);
		}
		expect(snapshot()).toEqual(before);
	});

	it.each([
		['rename', { name: 'Hijacked', notes: '' }],
		['duplicate', {}],
		['archive', {}],
		['addOption', { stepId: '1', figureId: '1' }],
		['removeOption', { stepId: '1', figureId: '1' }],
		['note', { stepId: '1', note: 'x' }],
		['insert', { at: '0', figureId: '1' }],
		['reorder', { stepId: '1', index: '0' }],
		['deleteMany', { stepIds: '1' }],
		['restore', { snapshot: '[]' }],
		['restoreOption', { stepId: '1', figureId: '1' }],
		['duplicateMany', { stepIds: '1' }],
		['extract', { stepIds: '1', name: 'X' }]
	])('%s on a group routine is a 404 for a member, and changes nothing', async (action, fields) => {
		const before = snapshot();
		for (const id of [R, RD]) {
			await refuses(
				routinePage.actions[action as keyof typeof routinePage.actions],
				post(U2, 'salsa', fields, String(id))
			);
		}
		expect(snapshot()).toEqual(before);
	});

	it.each([
		['update', { name: 'Hijacked', notes: '' }],
		['archive', {}],
		['linkSection', { spotId: '1' }],
		['unlinkSection', { linkId: '1' }],
		['addLink', { urls: 'https://example.com/a' }],
		['deleteLink', { linkId: '1' }],
		['log', { exerciseId: '0', durationS: '60' }]
	])('%s on a group drill is a 404 for a member, and changes nothing', async (action, fields) => {
		const before = snapshot();
		for (const id of [shines, draftDrill]) {
			const body = action === 'log' ? { ...fields, exerciseId: String(id) } : fields;
			await refuses(
				exercisePage.actions[action as keyof typeof exercisePage.actions],
				post(U2, 'salsa', body, String(id))
			);
		}
		expect(snapshot()).toEqual(before);
	});

	it('the editor edits the draft, publishes it, and then a member opens it', async () => {
		await call(
			lessonPage.actions.update,
			post(
				U1,
				'salsa',
				{
					title: 'Draft lesson Kappa',
					notes: 'n',
					lessonDay: '2026-10-01',
					// What the form saw: a group's save needs it (the clash check).
					seen: JSON.stringify({
						title: 'Draft lesson Kappa',
						lessonDay: '2026-11-01',
						notes: null
					})
				},
				String(D)
			)
		);
		expect(db.select().from(lessons).where(eq(lessons.id, D)).get()!.notes).toBe('n');
		// A member's Publish is the stranger's 404; the editor's moves the draft.
		await refuses(lessonPage.actions.publish, post(U2, 'salsa', {}, String(D)));
		expect(await call(lessonPage.actions.publish, post(U1, 'salsa', {}, String(D)))).toMatchObject({
			ok: true
		});
		// Once only: there is nothing left to publish.
		expect(await call(lessonPage.actions.publish, post(U1, 'salsa', {}, String(D)))).toMatchObject({
			status: 400
		});
		const data = open('lesson', U2, D) as { canEdit: boolean; draft: boolean };
		expect([data.canEdit, data.draft]).toEqual([false, false]);
		expect(() => open('figure', U2, V3)).not.toThrow();
	});

	it("an editor's things made in a group lesson are the group's", async () => {
		await call(
			lessonPage.actions.newExercise,
			post(U1, 'salsa', { name: 'Group drill', everyDays: '3', notes: '' }, String(D))
		);
		const made = db.select().from(exercises).where(eq(exercises.name, 'Group drill')).get()!;
		expect([made.userId, made.teamId]).toEqual([null, T.teamId]);
		const routine = await redirectOf(
			lessonPage.actions.newRoutine,
			post(U1, 'salsa', { name: 'Group routine', notes: '', everyDays: '3' }, String(D))
		);
		const routineId = Number(routine.location.split('/').pop());
		expect(getRoutineRow(routineId)).toMatchObject({ userId: null, teamId: T.teamId });
		// No exercise of the group's own: each member's Add makes theirs.
		expect(db.select().from(exercises).where(eq(exercises.routineId, routineId)).all()).toEqual([]);
	});

	it("the Link popup's options are an editor's only", async () => {
		const get = (user: User, spot: number) =>
			(linksEndpoint.GET as unknown as (e: unknown) => Response)({
				params: { id: String(spot) },
				locals: { user }
			});
		await expect(async () => get(U2, pSection)).rejects.toMatchObject({ status: 404 });
		await expect(async () => get(U3, pSection)).rejects.toMatchObject({ status: 404 });
		expect(get(U1, pSection).status).toBe(200);
	});

	it("a member's spot list names only what they reach", async () => {
		const res = (spotsEndpoint.GET as unknown as (e: unknown) => Response)({
			url: new URL(`http://localhost/api/video-spots?recording=${rec}`),
			locals: { user: U2 }
		});
		const body = await res.json();
		expect(JSON.stringify(body)).not.toContain('Doble-only-in-draft');
		expect(JSON.stringify(body)).toContain('Enchufla · Basic');
	});

	it('the group page lists drafts to its editors and only published lessons to members', async () => {
		const forEditor = (await loadAt(groupPage.load, U1, 'salsa', String(T.teamId))) as {
			lessons: { id: number; publishedAt: number | null }[];
			canEdit: boolean;
		};
		expect(forEditor.lessons.map((l) => l.id)).toEqual([D, P]);
		expect(forEditor.canEdit).toBe(true);
		const forMember = (await loadAt(groupPage.load, U2, 'salsa', String(T.teamId))) as {
			lessons: { id: number }[];
			canEdit: boolean;
		};
		expect(forMember.lessons.map((l) => l.id)).toEqual([P]);
		expect(forMember.canEdit).toBe(false);
		holdsNothingOfTheDraft(forMember);
	});

	it("+ New lesson makes a group's draft, an editor's only", async () => {
		const fields = { title: 'Week 3', notes: '', lessonDay: '2026-10-01' };
		await refuses(groupPage.actions.createLesson, post(U2, 'salsa', fields, String(T.teamId)));
		const made = await redirectOf(
			groupPage.actions.createLesson,
			post(U1, 'salsa', fields, String(T.teamId))
		);
		const id = Number(made.location.split('/').pop());
		const row = db.select().from(lessons).where(eq(lessons.id, id)).get()!;
		expect([row.userId, row.teamId, row.publishedAt]).toEqual([null, T.teamId, null]);
		// No review exercise: a group's lesson is practised through each member's Add.
		expect(db.select().from(exercises).where(eq(exercises.lessonId, id)).all()).toEqual([]);
		// Not in the editor's own Lessons.
		expect(listLessons(db, U1_SALSA).map((l) => l.id)).not.toContain(id);
		// A refusal comes back with what was typed.
		expect(
			await call(
				groupPage.actions.createLesson,
				post(U1, 'salsa', { ...fields, title: '' }, String(T.teamId))
			)
		).toMatchObject({ status: 400, data: { action: 'create', field: 'title' } });
	});

	it('the share page lists the draft to its editor and not to a member', async () => {
		const share = async (user: User) =>
			(await (sharePage.load as unknown as Load)({
				params: { dance: 'salsa', id: '' },
				url: new URL('http://localhost/?key=0f8fad5b-d9cb-469f-a165-70867728950e'),
				locals: { user }
			})) as { groups: { name: string; lessons: { id: number }[] }[] };
		const mine = await share(U1);
		expect(mine.groups.map((g) => [g.name, g.lessons.map((l) => l.id)])).toEqual([
			['Salsa nadaljevalna', [D, P]]
		]);
		expect((await share(U2)).groups).toEqual([]);
	});
	it("a member's own entry for a group figure shows nothing of the draft", async () => {
		// V3 only the draft holds: no entry for it.
		await refuses(figurePage.actions.practise, post(U2, 'salsa', {}, String(V3)));
		// Reading V2 is not enough: practising it needs a lesson holding it added (R8).
		expect(
			await call(figurePage.actions.practise, post(U2, 'salsa', {}, String(V2)))
		).toMatchObject({
			status: 400,
			data: { message: 'Add a lesson with this figure to practise it.' }
		});
		for (const userId of ['u1', 'u2']) {
			db.insert(lessonAdds).values({ userId, lessonId: P, addedAt: 2, seenAt: 2 }).run();
		}
		expect(
			await call(figurePage.actions.practise, post(U2, 'salsa', {}, String(V2)))
		).toMatchObject({ action: 'practise', ok: true });
		const entry = db
			.select()
			.from(exercises)
			.where(eq(exercises.figureId, V2))
			.all()
			.find((e) => e.userId === 'u2')!;
		const page = open('exercise', U2, entry.id) as {
			practice: { content: { sections: { spot: { id: number } }[] } };
		};
		holdsNothingOfTheDraft(page);
		expect(page.practice.content.sections.map((s) => s.spot.id)).toEqual([pSection, recSection]);
		const res = (practiceEndpoint.GET as unknown as (e: unknown) => Response)({
			params: { dance: 'salsa', id: String(entry.id) },
			locals: { user: U2 }
		});
		holdsNothingOfTheDraft(await res.json());
		// The editor's own entry sees the whole group, the draft's section included.
		await call(figurePage.actions.practise, post(U1, 'salsa', {}, String(V2)));
		const editors = db
			.select()
			.from(exercises)
			.where(eq(exercises.figureId, V2))
			.all()
			.find((e) => e.userId === 'u1')!;
		expect(JSON.stringify(open('exercise', U1, editors.id))).toContain('Draft section Sigma');
	});

	it('publish on a personal lesson is a 404, as for a missing one', async () => {
		const own = createLesson(db, U1_SALSA, lessonInput('Mine')).lesson.id;
		await refuses(lessonPage.actions.publish, post(U1, 'salsa', {}, String(own)));
	});

	/* ── Add (groups Task 10): the sheet, Lessons, Today, Moves, the player ── */

	type AddRow = {
		id: number;
		add: { added: boolean; offer: { items: { kind: string; id: number }[] } | null } | null;
	};

	const addForm = (fields: Record<string, string | string[]>) => {
		const body = new URLSearchParams();
		for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) body.append(k, x);
		return body;
	};
	const postForm = (user: User, fields: Record<string, string | string[]>, id = '') => ({
		params: { dance: 'salsa', id },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: addForm(fields)
		}),
		locals: { user }
	});
	const groupRows = (user: User) =>
		(loadAt(groupPage.load, user, 'salsa', String(T.teamId)) as { lessons: AddRow[] }).lessons;

	it('Add on the group page puts P on a member’s Lessons, Today and Moves, and nobody else’s', async () => {
		// Before: P offers Add (to the editor too, after publishing); a draft offers nothing.
		const before = groupRows(U2);
		expect(before.map((l) => l.id)).toEqual([P]);
		expect(before[0].add?.added).toBe(false);
		expect(before[0].add?.offer?.items.map((i) => `${i.kind}:${i.id}`)).toEqual([
			`lesson:${P}`,
			`routine:${R}`,
			`drill:${shines}`,
			`figure:${V2}`
		]);
		const editor = groupRows(U1);
		expect(editor.find((l) => l.id === D)!.add).toBeNull();
		expect(editor.find((l) => l.id === P)!.add?.added).toBe(false);
		const lessonsOf = (user: User) =>
			(loadAt(lessonList.load, user, 'salsa') as { lessons: { id: number; team: unknown }[] })
				.lessons;
		expect(lessonsOf(U2).map((l) => l.id)).toEqual([]);

		// An outsider, a draft and another group's lesson id are the stranger's 404.
		await refuses(
			groupPage.actions.add,
			postForm(U3, { lessonId: String(P), lesson: 'on' }, String(T.teamId))
		);
		await refuses(
			groupPage.actions.add,
			postForm(U2, { lessonId: String(D), lesson: 'on' }, String(T.teamId))
		);
		expect(
			db
				.select()
				.from(lessonAdds)
				.all()
				.map((a) => a.userId)
		).toEqual(['u4']);

		expect(
			await call(
				groupPage.actions.add,
				postForm(
					U2,
					{ lessonId: String(P), lesson: 'on', routineIds: String(R), drillIds: String(shines) },
					String(T.teamId)
				)
			)
		).toMatchObject({ action: 'add', ok: true });
		expect(groupRows(U2)[0].add).toEqual({ added: true, offer: null });

		// Lessons: P, marked with the group; never the draft.
		expect(lessonsOf(U2)).toEqual([
			expect.objectContaining({ id: P, team: { id: T.teamId, name: 'Salsa nadaljevalna' } })
		]);
		expect(lessonsOf(U1).map((l) => l.id)).toEqual([]);

		// Today: the review, the routine and the drill, each under the group, P's day known.
		type TodayData = {
			plan: Record<string, { exercise: { name: string; team: unknown } }[]>;
			lessonDays: Record<number, string>;
		};
		const today = loadAt(todayPage.load, U2, 'salsa') as TodayData;
		const rows = Object.values(today.plan).flat();
		expect(rows.map((r) => r.exercise.name).sort()).toEqual(
			['Published routine', 'Review: Published lesson', 'Shines'].sort()
		);
		for (const r of rows)
			expect(r.exercise.team).toEqual({ id: T.teamId, name: 'Salsa nadaljevalna' });
		expect(today.lessonDays[P]).toBe('2026-11-01');
		expect(Object.values((loadAt(todayPage.load, U1, 'salsa') as TodayData).plan).flat()).toEqual(
			[]
		);

		// Moves: the group's figure only under the group, only the variation P reaches.
		type Moves = {
			figures: { name: string }[];
			groups: {
				team: { name: string };
				moves: { name: string; figures: { id: number; label: string }[] }[];
			}[];
			unrouted: number;
		};
		const moves = loadAt(figureList.load, U2, 'salsa') as Moves;
		expect(moves.figures).toEqual([]);
		expect(moves.groups).toEqual([
			{
				team: { id: T.teamId, name: 'Salsa nadaljevalna' },
				moves: [
					expect.objectContaining({
						name: 'Enchufla',
						figures: [expect.objectContaining({ id: V2 })]
					})
				]
			}
		]);
		expect(moves.unrouted).toBe(0);
		// The editor added nothing: no group section, whatever they can edit.
		expect((loadAt(figureList.load, U1, 'salsa') as Moves).groups).toEqual([]);
	});

	it('the player walks a group routine for a member who added it, and 404s an outsider', () => {
		addLesson(db, 'u2', P, { lesson: false, routineIds: [R], drillIds: [], figureIds: [] }, 5);
		const entry = entryFor(db, 'u2', { routineId: R })!;
		const player = (user: User, query: string) =>
			(playerPage.load as unknown as Load)({
				params: { dance: 'salsa', id: '' },
				url: new URL(`http://localhost/salsa/player?${query}`),
				locals: { user }
			}) as {
				routine: { id: number; shape: { slots: unknown[] }; figureIds: number[] } | null;
				callNames: { id: number; name: string }[];
				graph: { figures: { id: number }[] };
				exercise: { id: number } | null;
			};
		const data = player(U2, `routine=${R}&exercise=${entry.id}`);
		expect(data.routine).toMatchObject({ id: R, figureIds: [V2] });
		expect(data.routine!.shape.slots).toHaveLength(1);
		expect(data.callNames).toEqual([expect.objectContaining({ id: V2, name: 'Enchufla · Basic' })]);
		expect(data.graph.figures.map((f) => f.id)).toContain(V2);
		// The draft's variation is not on a member's graph, not even as an id.
		expect(data.graph.figures.map((f) => f.id)).not.toContain(V3);
		expect(player(U1, `routine=${R}`).graph.figures.map((f) => f.id)).toContain(V3);
		expect(data.exercise?.id).toBe(entry.id);
		holdsNothingOfTheDraft(data);
		expect(() => player(U3, `routine=${R}`)).toThrow(threw404);
		expect(() => player(U2, `routine=${RD}`)).toThrow(threw404);
	});

	it('an added lesson shows what came in since, with Add and Not now, and Remove takes it off', async () => {
		type LessonData = { add: AddRow['add'] };
		const page = (user: User) => open('lesson', user, P) as LessonData;
		expect(page(U2).add?.added).toBe(false);
		expect(open('lesson', U1, D)).toMatchObject({ add: null });

		await call(lessonPage.actions.add, postForm(U2, { lesson: 'on' }, String(P)));
		expect(page(U2).add).toEqual({ added: true, offer: null });
		// An editor links a drill after the Add: the clock is set by hand, as
		// everything here happens within one millisecond or two.
		const fresh = createCustomExercise(db, T, {
			name: 'Fresh drill',
			everyDays: 3,
			notes: null
		}).id;
		must(linkExercise(db, P, fresh, 'u1'));
		for (const t of [lessonExercises, lessonRoutines, lessonFigures, spotLinks]) {
			db.update(t).set({ createdAt: 500 }).run();
		}
		db.update(lessonExercises)
			.set({ createdAt: 2000 })
			.where(eq(lessonExercises.exerciseId, fresh))
			.run();
		db.update(lessonAdds).set({ seenAt: 1000 }).where(eq(lessonAdds.userId, 'u2')).run();
		expect(page(U2).add?.offer?.items.map((i) => i.id)).toEqual([fresh]);
		await refuses(lessonPage.actions.notNow, post(U3, 'salsa', {}, String(P)));
		await call(lessonPage.actions.notNow, post(U2, 'salsa', {}, String(P)));
		expect(page(U2).add).toEqual({ added: true, offer: null });

		await refuses(lessonPage.actions.remove, post(U3, 'salsa', {}, String(P)));
		const review = entryFor(db, 'u2', { lessonId: P })!;
		expect(review.archivedAt).toBeNull();
		expect(
			await redirectOf(lessonPage.actions.remove, post(U2, 'salsa', {}, String(P)))
		).toMatchObject({ location: '/salsa/lessons' });
		expect(entryFor(db, 'u2', { lessonId: P })!.archivedAt).not.toBeNull();
		expect(page(U2).add?.added).toBe(false);
		// A personal lesson has nothing to add or remove.
		const own = createLesson(db, U1_SALSA, lessonInput('Mine')).lesson.id;
		await refuses(lessonPage.actions.add, postForm(U1, { lesson: 'on' }, String(own)));
		await refuses(lessonPage.actions.remove, post(U1, 'salsa', {}, String(own)));
	});

	it('a group drill’s page offers Add: P’s sheet, then just the drill once P is added', async () => {
		type DrillData = {
			add: { lessonId: number; title: string; added: boolean; offer: unknown } | null;
			canLog: boolean;
		};
		const drill = () => open('exercise', U2, shines) as DrillData;
		expect(drill().add).toMatchObject({ lessonId: P, title: 'Published lesson', added: false });
		expect(drill().add!.offer).not.toBeNull();
		await refuses(exercisePage.actions.addDrill, post(U2, 'salsa', {}, String(shines)));

		addLesson(db, 'u2', P, { lesson: true, routineIds: [], drillIds: [], figureIds: [] }, 5);
		expect(drill().add).toMatchObject({ lessonId: P, added: true, offer: null });
		await refuses(exercisePage.actions.addDrill, post(U3, 'salsa', {}, String(shines)));
		await call(exercisePage.actions.addDrill, post(U2, 'salsa', {}, String(shines)));
		const entry = entryFor(db, 'u2', { drillId: shines })!;
		expect(entry.archivedAt).toBeNull();
		expect(drill()).toMatchObject({ add: null, canLog: true });
		// The entry's own page: settings are the person's, the content is the group's.
		expect(open('exercise', U2, entry.id)).toMatchObject({ canEdit: true, canEditContent: false });
	});

	// Catches: a member's figure, lesson or routine entry offering edits on the group's sections.
	// Catches: a person's own entry taking links or a section, which belong to the group's drill.
	it('an entry takes no link and no section of its own', async () => {
		addLesson(db, 'u2', P, { lesson: true, routineIds: [], drillIds: [shines], figureIds: [] }, 5);
		const entry = entryFor(db, 'u2', { drillId: shines })!;
		expect(entry).toMatchObject({ userId: 'u2', source: 'added' });
		const mine = createLesson(db, U2_SALSA, lessonInput('Mine')).lesson.id;
		const video = addLessonVideo(db, {
			lessonId: mine,
			file: '00000000-0000-4000-8000-0000000000e1.mp4',
			mime: 'video/mp4',
			sizeBytes: 100
		});
		const section = addSpot(
			db,
			{ lessonVideoId: video.id },
			{ startMs: 0, endMs: 1000, label: 'My bit' }
		)!.id;
		const before = db.select().from(linkRows).all();
		await refuses(
			exercisePage.actions.addLink,
			postForm(U2, { urls: 'https://example.com/a' }, String(entry.id))
		);
		await refuses(
			exercisePage.actions.linkSection,
			postForm(U2, { spotId: String(section) }, String(entry.id))
		);
		expect(db.select().from(linkRows).all()).toEqual(before);
		expect(sectionsFor(db, { exerciseId: entry.id })).toEqual([]);
	});

	it('every entry on a group’s thing shows its content read-only; one’s own stays editable', () => {
		addLesson(db, 'u2', P, { lesson: true, routineIds: [R], drillIds: [], figureIds: [V2] }, 5);
		for (const target of [{ figureId: V2 }, { lessonId: P }, { routineId: R }]) {
			const entry = entryFor(db, 'u2', target)!;
			expect(open('exercise', U2, entry.id)).toMatchObject({
				canEdit: true,
				canEditContent: false
			});
		}
		const mine = createFigure(db, U2_SALSA, { ...figureInput, figureName: 'Mine' })!.figure.id;
		const own = addFigureExercise(db, 'u2', mine)!;
		expect(open('exercise', U2, own.id)).toMatchObject({ canEditContent: true });
	});

	it('Practise on a group figure waits for a lesson the person added', async () => {
		expect(open('figure', U2, V2)).toMatchObject({ practisable: false });
		addLesson(db, 'u2', P, { lesson: true, routineIds: [], drillIds: [], figureIds: [] }, 5);
		expect(open('figure', U2, V2)).toMatchObject({ practisable: true });
		// The editor too: editing is not adding (R8).
		expect(open('figure', U1, V2)).toMatchObject({ practisable: false });
	});
});
