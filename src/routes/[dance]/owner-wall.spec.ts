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
		expect(addFigureExercise(db, into.id)!.userId).toBe('u1');
		const moved = moveVariation(db, into.id, { newFigure: 'Elsewhere' });
		expect(moved.ok).toBe(true);
		const groups = db.select().from(figureGroups).all();
		expect(groups.every((g) => g.userId === 'u1')).toBe(true);
	});

	it("a variation cannot be moved into another person's figure", () => {
		const theirs = createFigure(db, U2_SALSA, { ...figureInput, figureName: 'Theirs' })!;
		expect(moveVariation(db, theirs.figure.id, { groupId })).toEqual({ ok: false, reason: 'gone' });
		expect(getFigure(db, theirs.figure.id)!.figure.groupId).toBe(theirs.group.id);
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
