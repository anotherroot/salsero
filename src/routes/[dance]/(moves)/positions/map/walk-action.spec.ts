/**
 * The map's `routine` action (spec 2026-11-08-map-walk, "Walking a routine"): a
 * walk's figures, in order and with repeats, become a routine's slots.
 *
 * It reaches the database through `getDb()`, mocked as in `dance-wall.spec.ts`:
 * each test gets its own `openDb(':memory:')`, never `$DATA_DIR`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { routines, users } from '$lib/server/db/schema';
import { createFigure } from '$lib/server/figures';
import { routineSlots } from '$lib/server/routines';
import { createLesson, linkFigure, publishLesson } from '$lib/server/lessons';
import { addLesson } from '$lib/server/entries';
import { createTeam, joinTeam } from '$lib/server/teams';
import { groupCookie } from '$lib/teams/mode';
import type { Space } from '$lib/server/scope';
import { T1_SALSA, U1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { runInLocale } from '$lib/server/i18n-request';
import { actions } from './+page.server';

let db: Db;

const jar = (value?: string) =>
	({
		get: (n: string) => (n === groupCookie('salsa') ? value : undefined),
		set: () => {},
		delete: () => {}
	}) as unknown as Cookies;

function post(user: string, fields: [string, string][], cookies: Cookies = jar()) {
	const body = new URLSearchParams();
	for (const [k, v] of fields) body.append(k, v);
	return {
		params: { dance: 'salsa' },
		request: new Request('http://localhost/salsa/positions/map?/routine', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body
		}),
		locals: {
			user: { id: user, email: `${user}@x.si`, timezone: 'Europe/Ljubljana', dance: 'salsa' }
		},
		cookies
	};
}
const run = (event: ReturnType<typeof post>) =>
	(actions.routine as unknown as (e: unknown) => Promise<unknown>)(event);

let n = 0;
const figure = (space: Space) =>
	createFigure(db, space, {
		figureName: `Move ${++n}`,
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	} as never)!.figure.id;

const ids = (...xs: number[]): [string, string][] => xs.map((x) => ['figureIds', String(x)]);
const routineId = (location: string) => Number(location.split('/').at(-1));
/** The redirect the action throws: where it went. */
async function madeAt(event: ReturnType<typeof post>): Promise<string> {
	try {
		await run(event);
	} catch (e) {
		const r = e as { status?: number; location?: string };
		if (r.status === 303 && r.location) return r.location;
		throw e;
	}
	throw new Error('no redirect');
}
const slotFigures = (id: number) => routineSlots(db, id).map((s) => s.figureIds);

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	n = 0;
	for (const id of ['u1', 'u2'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Tuesdays', 1);
	joinTeam(db, 'u2', 1, 2);
});

describe('the map’s routine action', () => {
	it('makes one slot per walked figure, in order, repeats kept', async () => {
		const a = figure(U2_SALSA);
		const b = figure(U2_SALSA);
		const at = await madeAt(post('u2', [['name', 'Walk from Cerrada'], ...ids(a, b, a)]));
		expect(at).toMatch(/^\/salsa\/routines\/\d+$/);
		const r = db
			.select()
			.from(routines)
			.where(eq(routines.id, routineId(at)))
			.get()!;
		expect(r).toMatchObject({ name: 'Walk from Cerrada', userId: 'u2', teamId: null });
		expect(slotFigures(r.id)).toEqual([[a], [b], [a]]);
	});

	it('refuses an empty name on the field, keeping what was typed', async () => {
		const a = figure(U2_SALSA);
		const res = await run(post('u2', [['name', '   '], ...ids(a)]));
		expect(res).toMatchObject({ status: 400, data: { field: 'name', name: '   ' } });
		expect((res as { data: { message: string } }).data.message).toMatch(/name/i);
		expect(db.select().from(routines).all()).toEqual([]);
	});

	it('refuses a walk with no figures', async () => {
		const res = await run(post('u2', [['name', 'Empty']]));
		expect(res).toMatchObject({ status: 400, data: { message: expect.any(String) } });
		expect((res as { data: { field?: string } }).data.field).toBeUndefined();
		expect(db.select().from(routines).all()).toEqual([]);
	});

	it('takes a group figure the person may use', async () => {
		const own = figure(U2_SALSA);
		const club = figure(T1_SALSA);
		const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'W1', notes: null })
			.lesson.id;
		linkFigure(db, L, club, 'u1');
		publishLesson(db, T1_SALSA, L, 1);
		addLesson(db, 'u2', L, { lesson: false, routineIds: [], drillIds: [], figureIds: [] }, 2);
		const at = await madeAt(post('u2', [['name', 'Mixed'], ...ids(own, club)]));
		expect(slotFigures(routineId(at))).toEqual([[own], [club]]);
	});

	it("answers another person's figure with a 404 and makes nothing", async () => {
		const mine = figure(U2_SALSA);
		const theirs = figure(U1_SALSA);
		await expect(run(post('u2', [['name', 'Theft'], ...ids(mine, theirs)]))).rejects.toMatchObject({
			status: 404,
			body: { message: 'Figure not found' }
		});
		expect(db.select().from(routines).all()).toEqual([]);
	});

	it('makes the group’s routine in group mode', async () => {
		const club = figure(T1_SALSA);
		const at = await madeAt(post('u1', [['name', 'Club walk'], ...ids(club, club)], jar('1')));
		const r = db
			.select()
			.from(routines)
			.where(eq(routines.id, routineId(at)))
			.get()!;
		expect(r).toMatchObject({ teamId: 1, userId: null });
		expect(slotFigures(r.id)).toEqual([[club], [club]]);
	});
});

describe('the map’s routine action in Slovenian', () => {
	/** What the action refuses with, run as the hook runs a request: inside `runInLocale`. */
	const said = (event: ReturnType<typeof post>) =>
		runInLocale('sl', async () => {
			try {
				const res = (await run(event)) as { data?: { message?: string } };
				return res.data?.message;
			} catch (e) {
				return (e as { body?: { message?: string } }).body?.message;
			}
		});

	it('refuses in the person’s language: no name, no figures, a figure out of reach', async () => {
		const mine = figure(U2_SALSA);
		const theirs = figure(U1_SALSA);
		expect(await said(post('u2', [['name', ''], ...ids(mine)]))).toBe(
			'Kombinaciji dajte ime (do 200 znakov).'
		);
		expect(await said(post('u2', [['name', 'Prazno']]))).toBe(
			'Najprej dodajte vsaj eno različico.'
		);
		expect(await said(post('u2', [['name', 'Kraja'], ...ids(theirs)]))).toBe(
			'Različice ni mogoče najti'
		);
	});
});
