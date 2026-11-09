import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { openDb, type Db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { setIdSlot } from '$lib/server/db/ids';
import { getLessonRow } from '$lib/server/lessons';
import { lessonSeen } from '$lib/server/clash';
import { actionRunner } from '$lib/server/sync/test-replay';
import { PAGE_EPOCH } from '$lib/epoch';
import * as exercisePage from '../routes/[dance]/(today)/exercises/[id]/+page.server';
import * as lessonPage from '../routes/[dance]/lessons/[id]/+page.server';
import { installCapture } from './capture';
import { pull as serverPull } from '$lib/server/sync/pull';
import { makeWorld, type World } from '$lib/server/sync/test-world';
import { SCHEMA_TAG } from '$lib/sync/schema-tag';
import type { PullRequest } from '$lib/sync/wire';
import type { DeviceOut, WireRequest } from '$lib/offline/protocol';
import { migrateDevice, readMeta } from './migrate';
import { repoMigrations } from './test-migrations';
import {
	copyHasUser,
	createDevice,
	deviceHeaders,
	oneAtATime,
	type DeviceDeps,
	type DeviceRuntime,
	type Responder
} from './core';

let server: Db;
let world: World;
beforeAll(() => {
	server = openDb(':memory:');
	world = makeWorld(server);
	// The world's people predate the dance split; the hook needs one.
	server.run(sql`UPDATE users SET dance = 'salsa'`);
});

let device: Database.Database;
beforeEach(() => {
	device = new Database(':memory:');
	migrateDevice(device, repoMigrations());
});

const count = (table: string) =>
	(device.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n;

/** The server's pull for `userId` (u1), answered as the route does, with a theme cookie echoed. */
function answerAsServer(body: string, userId = 'u1'): Response {
	const out = serverPull(server, userId, JSON.parse(body) as PullRequest);
	if ('refused' in out) return Response.json(out, { status: 409 });
	return Response.json({ ...out, cookies: { theme: 'dark', group_salsa: 'a b' } });
}

const pending = () => new Promise<Response>(() => {});

function harness(over: Partial<DeviceDeps> = {}) {
	const posted: DeviceOut[] = [];
	/** Whose copy each `ready` was said over. */
	const readyFor: (string | null)[] = [];
	const bodies: PullRequest[] = [];
	const runtimes: DeviceRuntime[] = [];
	const seen: Request[] = [];
	const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
	const responder: Responder = async (req) => {
		seen.push(req);
		return new Response(`answered ${new URL(req.url).pathname}`, {
			status: 200,
			headers: { 'content-type': 'text/plain' }
		});
	};
	const startServer = vi.fn(async () => responder);
	const deps: DeviceDeps = {
		db: device,
		schema: SCHEMA_TAG,
		fetchPull: async (body) => answerAsServer(body),
		startServer,
		setRuntime: (r) => runtimes.push(r),
		post: (m) => {
			posted.push(m);
			if (m.type === 'state' && m.state === 'ready') readyFor.push(readMeta(device).userId);
		},
		online: () => true,
		userAgent: 'Phone/1.0',
		log,
		now: () => 0,
		epoch: PAGE_EPOCH,
		newId: () => crypto.randomUUID(),
		onRecorded: () => {},
		fetchPush: async () => {
			throw new Error('no push in this spec');
		},
		...over
	};
	const wrapped = deps.fetchPull;
	deps.fetchPull = (body) => {
		bodies.push(JSON.parse(body) as PullRequest);
		return wrapped(body);
	};
	const dev = createDevice(deps);
	const states = () => posted.filter((m) => m.type === 'state').map((m) => m.state);
	return { dev, posted, bodies, runtimes, seen, log, startServer, states, readyFor };
}

const get = (path: string): WireRequest => ({
	url: `https://salsa.test${path}`,
	method: 'GET',
	headers: [['accept', 'application/json']],
	body: null
});

describe('oneAtATime', () => {
	it('never overlaps, and queues exactly one more run however often it is asked', async () => {
		let active = 0;
		let runs = 0;
		let release: () => void = () => {};
		const task = oneAtATime(async () => {
			active++;
			runs++;
			expect(active).toBe(1);
			await new Promise<void>((r) => (release = r));
			active--;
		});
		const first = task();
		const second = task();
		const third = task();
		expect(second).toBe(third);
		release();
		await first;
		await Promise.resolve();
		release();
		await second;
		expect(runs).toBe(2);
		const later = task();
		release();
		await later;
		expect(runs).toBe(3);
	});
});

describe('deviceHeaders', () => {
	it("carries the page's headers, the copy's cookies and the browser's agent", () => {
		const h = deviceHeaders(
			[
				['accept', 'application/json'],
				['user-agent', 'stale']
			],
			{ theme: 'dark', group_salsa: 'a b;c' },
			'Phone/1.0'
		);
		expect(h.get('accept')).toBe('application/json');
		expect(h.get('cookie')).toBe('theme=dark; group_salsa=a%20b%3Bc');
		expect(h.get('user-agent')).toBe('Phone/1.0');
	});
	it('sends no cookie header when the copy has no cookies', () => {
		expect(deviceHeaders([], {}, 'x').has('cookie')).toBe(false);
	});
});

describe('copyHasUser', () => {
	it('needs a users row with a dance', () => {
		device
			.prepare(
				"INSERT INTO users (id, email, password_hash, created_at, dance) VALUES ('a', 'a@x', 'h', 1, 'salsa')"
			)
			.run();
		device
			.prepare(
				"INSERT INTO users (id, email, password_hash, created_at, dance) VALUES ('b', 'b@x', 'h', 1, NULL)"
			)
			.run();
		expect(copyHasUser(device, 'a')).toBe(true);
		expect(copyHasUser(device, 'b')).toBe(false);
		expect(copyHasUser(device, 'nobody')).toBe(false);
	});
});

describe('start', () => {
	it('with no copy, waits for the first pull, then serves it', async () => {
		const h = harness();
		await h.dev.start();
		expect(h.states()).toEqual(['starting', 'ready']);
		expect(h.posted.at(-1)).toMatchObject({ type: 'pulled' });
		expect(count('figures')).toBeGreaterThan(0);
		expect(h.runtimes).toEqual([
			{ userId: 'u1', cookies: { theme: 'dark', group_salsa: 'a b' }, slot: 1 }
		]);
		expect(h.startServer).toHaveBeenCalledTimes(1);
		expect(h.bodies).toEqual([
			{ cursor: 0, schema: SCHEMA_TAG, userId: null, device: expect.any(String) }
		]);
	});

	it('with no copy and offline, is empty and asks nothing', async () => {
		const h = harness({ online: () => false });
		await h.dev.start();
		expect(h.states()).toEqual(['starting', 'empty']);
		expect(h.bodies).toEqual([]);
		expect(h.startServer).not.toHaveBeenCalled();
	});

	it('with no copy and the network failing, is empty', async () => {
		const h = harness({ fetchPull: () => Promise.reject(new TypeError('Failed to fetch')) });
		await h.dev.start();
		expect(h.states()).toEqual(['starting', 'empty']);
	});

	it('with a copy, serves it without waiting for the pull', async () => {
		await harness().dev.start();
		const h = harness({ fetchPull: pending });
		await h.dev.start();
		expect(h.states()).toEqual(['starting', 'ready']);
		// The pull goes on behind, its answer never comes.
		await vi.waitFor(() => expect(h.bodies).toHaveLength(1));
		expect(h.bodies[0].digests).toBeDefined();
	});

	it('is failed when the server will not start', async () => {
		const h = harness({ startServer: () => Promise.reject(new Error('no wasm')) });
		await h.dev.start();
		expect(h.states().at(-1)).toBe('failed');
		expect(await h.dev.answer(get('/salsa/figures/__data.json'))).toMatchObject({
			fallback: true
		});
	});

	it('a later pull tries the server again after it would not start', async () => {
		let tries = 0;
		const h = harness({
			startServer: async () => {
				// Fails for the first pull's start and start()'s own, then works.
				if (tries++ < 2) throw new Error('no wasm');
				return async () => new Response('ok');
			}
		});
		await h.dev.start();
		expect(h.dev.state()).toBe('failed');
		await h.dev.pull();
		expect(tries).toBe(3);
		expect(h.dev.state()).toBe('ready');
	});

	it('keeps serving its copy when the start finds the session expired (offline phase 3)', async () => {
		await harness().dev.start();
		let started: ((r: Responder) => void) | null = null;
		const h = harness({
			fetchPull: async () => Response.json({}, { status: 401 }),
			startServer: () => new Promise<Responder>((r) => (started = r))
		});
		const starting = h.dev.start();
		await vi.waitFor(() => expect(started).not.toBeNull());
		(started as unknown as (r: Responder) => void)(async () => new Response('ok'));
		await starting;
		await h.dev.sync();
		expect(h.dev.state()).toBe('ready');
		expect(h.dev.summary().signedOut).toBe(true);
	});
});

describe('pull', () => {
	it('says when each pull asked the server, a queued one its own later time', async () => {
		let clock = 100;
		let release: () => void = () => {};
		let calls = 0;
		const h = harness({
			now: () => clock,
			fetchPull: async (body) => {
				calls += 1;
				// The second pull of the test (after start's) hangs until released.
				if (calls === 2) await new Promise<void>((r) => (release = r));
				return answerAsServer(body);
			}
		});
		await h.dev.start();
		clock = 200;
		const first = h.dev.pull();
		await vi.waitFor(() => expect(calls).toBe(2));
		// A write lands while the first pull is out; its page asks for another.
		clock = 300;
		const second = h.dev.pull();
		release();
		await Promise.all([first, second]);
		const pulled = h.posted.flatMap((m) => (m.type === 'pulled' ? [m.startedAt] : []));
		expect(pulled).toEqual([100, 200, 300]);
	});

	it('signed out (a 401): keeps the copy and the outbox, and says sign in', async () => {
		let status = 200;
		const h = harness({
			fetchPull: async (body) =>
				status === 200 ? answerAsServer(body) : Response.json({}, { status })
		});
		await h.dev.start();
		const figures = count('figures');
		status = 401;
		await h.dev.pull();
		expect(count('figures')).toBe(figures);
		expect(readMeta(device).userId).toBe('u1');
		expect(h.dev.summary().signedOut).toBe(true);
		// Signed in again: the next pull brings the copy back and serves it.
		status = 200;
		await h.dev.pull();
		expect(h.dev.state()).toBe('ready');
		expect(count('figures')).toBeGreaterThan(0);
		expect(h.startServer).toHaveBeenCalledTimes(1);
	});

	it('schema behind: keeps the copy and says so', async () => {
		let refuse = false;
		const h = harness({
			fetchPull: async (body) =>
				refuse
					? Response.json({ refused: 'schema', schema: 'newer' }, { status: 409 })
					: answerAsServer(body)
		});
		await h.dev.start();
		const before = count('figures');
		refuse = true;
		await h.dev.pull();
		expect(h.dev.state()).toBe('ready');
		expect(count('figures')).toBe(before);
		expect(h.log.warn).toHaveBeenCalledWith('[device] schema behind, waiting for the update');
	});

	it('a failed apply pulls once more at once, a full pull', async () => {
		let bad = 0;
		const h = harness({
			fetchPull: async (body) => {
				if (bad > 0) {
					bad--;
					// A row without its key column: applyPull refuses it.
					return Response.json({
						userId: 'u1',
						cursor: 1,
						schema: SCHEMA_TAG,
						full: [],
						changed: { figures: { cols: ['name'], rows: [['x']] } },
						cookies: {}
					});
				}
				return answerAsServer(body);
			}
		});
		await h.dev.start();
		expect(h.bodies).toHaveLength(1);

		bad = 1;
		await h.dev.pull();
		expect(h.bodies).toHaveLength(3);
		expect(h.bodies[1].digests).toBeDefined();
		expect(h.bodies[2].digests).toBeUndefined();
		expect(readMeta(device).full).toBe(false);
		expect(h.posted.at(-1)).toMatchObject({ type: 'pulled' });

		bad = 2;
		await h.dev.pull();
		expect(h.bodies).toHaveLength(5);
		expect(h.log.error).toHaveBeenCalledWith(
			'[device] pull: applying failed twice, waiting for the next pull'
		);
		expect(h.dev.state()).toBe('ready');
	});
});

describe("the page's person", () => {
	it('a signed-out page (null) keeps the copy and is answered nothing', async () => {
		const h = harness();
		await h.dev.start();
		expect(h.dev.state()).toBe('ready');
		const figures = count('figures');
		await h.dev.person(null);
		expect(h.dev.state()).toBe('empty');
		expect(count('figures')).toBe(figures);
		expect(readMeta(device).userId).toBe('u1');
		expect(await h.dev.answer(get('/salsa/figures/__data.json'))).toMatchObject({
			fallback: true
		});
	});

	it('signed out before the start: the copy stays, answers nothing, and nothing is pulled', async () => {
		await harness().dev.start();
		const figures = count('figures');
		const h = harness();
		await h.dev.person(null);
		await h.dev.start();
		expect(h.states()).toEqual(['starting', 'empty']);
		expect(count('figures')).toBe(figures);
		expect(h.bodies).toEqual([]);
	});

	it('another person, known before the start, never gets ready on the old copy', async () => {
		await harness().dev.start();
		expect(readMeta(device).userId).toBe('u1');
		const h = harness({ fetchPull: async (body) => answerAsServer(body, 'u4') });
		await h.dev.person('u4');
		await h.dev.start();
		expect(h.readyFor).toEqual(['u4']);
		expect(h.dev.state()).toBe('ready');
		expect(h.runtimes.at(-1)?.userId).toBe('u4');
		expect(device.prepare("SELECT count(*) AS n FROM users WHERE id = 'u1'").get()).toEqual({
			n: 0
		});
	});

	it('another person, said after the start, takes the copy out of service until theirs lands', async () => {
		let release: () => void = () => {};
		let who = 'u1';
		const h = harness({
			fetchPull: async (body) => {
				if (who === 'u4') await new Promise<void>((r) => (release = r));
				return answerAsServer(body, who);
			}
		});
		await h.dev.start();
		expect(h.readyFor).toEqual(['u1']);
		who = 'u4';
		const switching = h.dev.person('u4');
		await vi.waitFor(() => expect(h.bodies).toHaveLength(2));
		expect(h.dev.state()).not.toBe('ready');
		expect(count('figures')).toBe(0);
		expect(await h.dev.answer(get('/salsa/figures/__data.json'))).toMatchObject({
			fallback: true
		});
		release();
		await switching;
		expect(h.readyFor).toEqual(['u1', 'u4']);
		expect(h.dev.state()).toBe('ready');
	});

	it('another person and no network: the old copy is gone and the device is empty', async () => {
		await harness().dev.start();
		const h = harness({ fetchPull: () => Promise.reject(new TypeError('Failed to fetch')) });
		await h.dev.start();
		expect(h.dev.state()).toBe('ready');
		await h.dev.person('u4');
		expect(h.dev.state()).toBe('empty');
		expect(count('figures')).toBe(0);
	});

	it("never takes a pull for someone other than the page's person", async () => {
		const h = harness();
		await h.dev.person('u4');
		await h.dev.start();
		expect(h.bodies.length).toBeGreaterThan(0);
		expect(count('figures')).toBe(0);
		expect(h.dev.state()).toBe('empty');
		expect(h.readyFor).toEqual([]);
	});

	it('the same person keeps the copy', async () => {
		const h = harness();
		await h.dev.start();
		await h.dev.person('u1');
		expect(h.dev.state()).toBe('ready');
		expect(count('figures')).toBeGreaterThan(0);
	});

	it("falls back for a page whose person is not the copy's", async () => {
		const h = harness();
		await h.dev.start();
		expect(await h.dev.answer(get('/salsa/figures/__data.json'), 'u4')).toMatchObject({
			fallback: true
		});
		expect(await h.dev.answer(get('/salsa/figures/__data.json'), null)).toMatchObject({
			fallback: true
		});
		expect(h.seen).toEqual([]);
		// The copy's person, and a page that does not know yet (the offline shell), are answered.
		expect(await h.dev.answer(get('/salsa/figures/__data.json'), 'u1')).not.toHaveProperty(
			'fallback'
		);
		expect(await h.dev.answer(get('/salsa/figures/__data.json'))).not.toHaveProperty('fallback');
	});
});

describe('answer', () => {
	it("answers page data through the server, with the copy's cookies", async () => {
		const h = harness();
		await h.dev.start();
		const res = await h.dev.answer(get('/salsa/figures/__data.json'));
		if ('fallback' in res) throw new Error(res.reason);
		expect(res.status).toBe(200);
		expect(new TextDecoder().decode(res.body)).toBe('answered /salsa/figures/__data.json');
		expect(res.headers).toContainEqual(['content-type', 'text/plain']);
		const req = h.seen[0];
		expect(req.method).toBe('GET');
		expect(req.headers.get('cookie')).toBe('theme=dark; group_salsa=a%20b');
		expect(req.headers.get('user-agent')).toBe('Phone/1.0');
		expect(req.headers.get('accept')).toBe('application/json');
	});

	it('falls back on what only the network answers, and on writes', async () => {
		const h = harness();
		await h.dev.start();
		expect(await h.dev.answer(get('/admin/__data.json'))).toMatchObject({ fallback: true });
		expect(
			await h.dev.answer({ ...get('/salsa/figures/__data.json'), method: 'POST' })
		).toMatchObject({ fallback: true });
		expect(h.seen).toEqual([]);
	});

	it('falls back before it is ready', async () => {
		const h = harness({ fetchPull: pending });
		void h.dev.start();
		expect(await h.dev.answer(get('/salsa/figures/__data.json'))).toMatchObject({
			fallback: true
		});
	});

	it('falls back, never to sign-in, when the copy lacks its person', async () => {
		const h = harness();
		await h.dev.start();
		device.pragma('foreign_keys = OFF');
		device.prepare("DELETE FROM users WHERE id = 'u1'").run();
		expect(await h.dev.answer(get('/salsa/figures/__data.json'))).toMatchObject({
			fallback: true,
			reason: 'the copy has no user'
		});
		expect(h.seen).toEqual([]);
	});

	it('falls back when the server throws', async () => {
		const h = harness({
			startServer: async () => () => Promise.reject(new Error('boom'))
		});
		await h.dev.start();
		expect(await h.dev.answer(get('/salsa/figures/__data.json'))).toMatchObject({
			fallback: true,
			reason: 'Error: boom'
		});
	});
});

describe('writes on the device', () => {
	const S = 2 ** 32;
	const U1 = {
		id: 'u1',
		email: 'u1@x.si',
		firstName: 'Ana',
		lastName: null,
		timezone: 'UTC',
		isAdmin: false,
		level: 'all' as const,
		dance: 'salsa' as const,
		locale: 'en' as const
	};
	const ROUTES = [
		{ id: '/[dance]/(today)/exercises/[id]', module: exercisePage },
		{ id: '/[dance]/lessons/[id]', module: lessonPage }
	];
	let now = 1_800_000_000_000;
	let ids = 0;

	beforeEach(() => {
		installCapture(device);
		handle.db = drizzle(device, { schema });
		setIdSlot(5);
		now = 1_800_000_000_000;
		ids = 0;
	});
	afterEach(() => {
		setIdSlot(0);
		handle.db = undefined;
	});

	async function writer(over: Partial<DeviceDeps> = {}) {
		const recorded = vi.fn();
		const h = harness({
			fetchPull: async (body) => {
				const res = answerAsServer(body);
				const json = (await res.json()) as Record<string, unknown>;
				return Response.json({ ...json, slot: 5 });
			},
			startServer: async () => actionRunner(U1, ROUTES),
			epoch: PAGE_EPOCH,
			newId: () => `entry-${String(++ids).padStart(4, '0')}`,
			onRecorded: recorded,
			now: () => now,
			...over
		});
		await h.dev.start();
		expect(h.dev.state()).toBe('ready');
		return { ...h, recorded };
	}

	const form = (fields: Record<string, string>) =>
		new TextEncoder().encode(new URLSearchParams(fields).toString()).buffer as ArrayBuffer;
	const post = (path: string, fields: Record<string, string>, epoch = PAGE_EPOCH): WireRequest => ({
		url: `https://salsa.test${path}`,
		method: 'POST',
		headers: [
			['content-type', 'application/x-www-form-urlencoded'],
			['accept', 'application/json'],
			['x-sveltekit-action', 'true'],
			['x-page-epoch', String(epoch)]
		],
		body: form(fields)
	});
	const done = (ex: number, fields: Record<string, string> = {}) =>
		post(`/salsa/exercises/${ex}?/done`, {
			exerciseId: String(ex),
			durationS: '60',
			rating: '3',
			note: 'studio',
			...fields
		});
	const entries = () =>
		device.prepare('SELECT * FROM outbox ORDER BY seq').all() as {
			id: string;
			made_at: number;
			minted_json: string;
			label_json: string;
			cls: string;
		}[];
	const isFallback = (a: unknown) => !!(a as { fallback?: boolean }).fallback;

	it('answers a log from the device at once and records one entry with its id and made-at', async () => {
		const { dev, recorded } = await writer();
		const before = count('sets');
		const ans = await dev.answer(done(world.own.u1.exercise), 'u1');
		expect(isFallback(ans)).toBe(false);
		const res = ans as { status: number; headers: [string, string][] };
		expect(res.status).toBe(200);
		expect(res.headers.find(([k]) => k === 'x-salsa-outbox')?.[1]).toBe('1');
		expect(count('sets')).toBe(before + 1);
		const [e] = entries();
		const minted = JSON.parse(e.minted_json) as Record<string, number[]>;
		expect(minted.sets).toHaveLength(1);
		expect(Math.floor(minted.sets[0] / S)).toBe(5);
		expect(device.prepare('SELECT id FROM sets WHERE id = ?').get(minted.sets[0])).toBeTruthy();
		expect(e.made_at).toBe(now);
		expect(recorded).toHaveBeenCalledTimes(1);
	});

	it('online, a refusal on the device goes to the server instead (the copy may be behind)', async () => {
		const { dev } = await writer();
		const before = count('sets');
		const ans = await dev.answer(done(world.own.u1.exercise, { rating: '' }), 'u1');
		expect(ans).toMatchObject({ fallback: true });
		expect(entries()).toHaveLength(0);
		expect(count('sets')).toBe(before);
	});

	it('a write past its deadline (the service worker has given up) rolls back and falls back', async () => {
		const { dev } = await writer();
		const before = count('sets');
		const late = { ...done(world.own.u1.exercise), deadline: now - 1 };
		expect(await dev.answer(late, 'u1')).toMatchObject({ fallback: true });
		expect(entries()).toHaveLength(0);
		expect(count('sets')).toBe(before);
		const inTime = { ...done(world.own.u1.exercise), deadline: now + 5000 };
		expect(isFallback(await dev.answer(inTime, 'u1'))).toBe(false);
		expect(entries()).toHaveLength(1);
	});

	it('offline, records nothing and answers the refusal when the action refuses', async () => {
		let online = true;
		const { dev } = await writer({ online: () => online });
		online = false;
		const before = count('sets');
		const ans = (await dev.answer(done(world.own.u1.exercise, { rating: '' }), 'u1')) as {
			status: number;
			body: ArrayBuffer;
		};
		expect(ans.status).toBe(400);
		expect(JSON.parse(new TextDecoder().decode(ans.body)).type).toBe('failure');
		expect(entries()).toHaveLength(0);
		expect(count('sets')).toBe(before);
	});

	it('falls back and keeps nothing when the action throws', async () => {
		const ex = world.own.u1.exercise;
		const { dev } = await writer({
			startServer: async () => async () => {
				device
					.prepare(`INSERT INTO sets (id, exercise_id, done_at, rating) VALUES (?, ?, 1, 3)`)
					.run(5 * S + 99, ex);
				throw new Error('boom');
			}
		});
		const before = count('sets');
		expect(isFallback(await dev.answer(done(ex), 'u1'))).toBe(true);
		expect(count('sets')).toBe(before);
		expect(entries()).toHaveLength(0);
	});

	it("sends a group's row to the network while online, and records it offline", async () => {
		let online = true;
		const { dev } = await writer({ online: () => online });
		const id = world.group.published;
		const row = getLessonRow(handle.db as Db, id)!;
		const edit = post(`/salsa/lessons/${id}?/update`, {
			title: 'Edited on the phone',
			lessonDay: row.lessonDay,
			notes: row.notes ?? '',
			seen: JSON.stringify(lessonSeen(row))
		});
		expect(await dev.answer(edit, 'u1')).toMatchObject({ fallback: true, reason: 'group-online' });
		expect(getLessonRow(handle.db as Db, id)!.title).toBe(row.title);
		online = false;
		expect(isFallback(await dev.answer(edit, 'u1'))).toBe(false);
		expect(entries()).toHaveLength(1);
	});

	it('falls back for a network-only write, and before the device has a slot', async () => {
		const { dev } = await writer();
		expect(
			isFallback(await dev.answer(post(`/salsa/lessons/${world.own.u1.lesson}?/copyTo`, {}), 'u1'))
		).toBe(true);
		device.prepare("DELETE FROM device_meta WHERE key = 'slot'").run();
		const fresh = await writer({ fetchPull: async (body) => answerAsServer(body) });
		expect(isFallback(await fresh.dev.answer(done(world.own.u1.exercise), 'u1'))).toBe(true);
		expect(entries()).toHaveLength(0);
	});

	it('falls back for a page of another epoch', async () => {
		const { dev } = await writer();
		const old = { ...done(world.own.u1.exercise) };
		old.headers = old.headers.map(([k, v]) =>
			k === 'x-page-epoch' ? [k, String(PAGE_EPOCH - 1)] : [k, v]
		);
		expect(isFallback(await dev.answer(old, 'u1'))).toBe(true);
		expect(entries()).toHaveLength(0);
	});

	it('runs a multipart form action on the device', async () => {
		const { dev } = await writer();
		const fd = new FormData();
		const ex = world.own.u1.exercise;
		for (const [k, v] of Object.entries({
			exerciseId: String(ex),
			durationS: '60',
			rating: '3',
			note: 'm'
		})) {
			fd.set(k, v);
		}
		const req = new Request('https://salsa.test/x', { method: 'POST', body: fd });
		const wire: WireRequest = {
			url: `https://salsa.test/salsa/exercises/${ex}?/done`,
			method: 'POST',
			headers: [
				['content-type', req.headers.get('content-type')!],
				['accept', 'application/json'],
				['x-sveltekit-action', 'true'],
				['x-page-epoch', String(PAGE_EPOCH)]
			],
			body: await req.arrayBuffer()
		};
		const ans = await dev.answer(wire, 'u1');
		expect(isFallback(ans)).toBe(false);
		expect(entries()).toHaveLength(1);
	});

	it('runs writes one at a time, their captures apart', async () => {
		const { dev } = await writer();
		const ex = world.own.u1.exercise;
		const lesson = world.own.u1.lesson;
		const row = getLessonRow(handle.db as Db, lesson)!;
		const [a, b] = await Promise.all([
			dev.answer(done(ex), 'u1'),
			dev.answer(
				post(`/salsa/lessons/${lesson}?/update`, {
					title: 'T2',
					lessonDay: row.lessonDay,
					notes: ''
				}),
				'u1'
			)
		]);
		expect(isFallback(a) || isFallback(b)).toBe(false);
		const rows = (
			device.prepare('SELECT rows_json FROM outbox ORDER BY seq').all() as { rows_json: string }[]
		).map((r) => (JSON.parse(r.rows_json) as { tbl: string }[]).map((x) => x.tbl));
		expect(rows[0]).toContain('sets');
		expect(rows[0]).not.toContain('lessons');
		expect(rows[1]).toContain('lessons');
		expect(rows[1]).not.toContain('sets');
	});

	it("labels a log with its drill's name", async () => {
		const { dev } = await writer();
		const ex = world.own.u1.exercise;
		await dev.answer(done(ex), 'u1');
		const name = (
			device.prepare('SELECT name FROM exercises WHERE id = ?').get(ex) as { name: string }
		).name;
		expect(JSON.parse(entries()[0].label_json)).toEqual({ kind: 'log', thing: name });
	});

	it('online, a write that changed nothing on the device goes to the network', async () => {
		const { dev } = await writer({
			startServer: async () => async () =>
				Response.json({ type: 'success', status: 200, data: '[null]' })
		});
		expect(await dev.answer(done(world.own.u1.exercise), 'u1')).toMatchObject({
			fallback: true,
			reason: 'nothing on the device'
		});
	});

	describe('sync: push, then pull', () => {
		type Results = (ids: string[]) => Response | Promise<Response>;
		function pusher(
			answer: Results = (ids) =>
				Response.json({ slot: 5, results: ids.map((id) => ({ id, state: 'landed' })) })
		) {
			const pushes: string[][] = [];
			const fetchPush = async (body: string) => {
				const ids = (JSON.parse(body) as { entries: { id: string }[] }).entries.map((e) => e.id);
				pushes.push(ids);
				return answer(ids);
			};
			return { pushes, fetchPush };
		}
		const waiting = () =>
			device.prepare('SELECT id, state, held_by AS heldBy FROM outbox ORDER BY seq').all() as {
				id: string;
				state: string;
				heldBy: string | null;
			}[];
		const meta = (key: string) =>
			(
				device.prepare('SELECT value FROM device_meta WHERE key = ?').get(key) as
					{ value: string } | undefined
			)?.value;
		const lessonEdit = (title: string) => {
			const row = getLessonRow(handle.db as Db, world.own.u1.lesson)!;
			return post(`/salsa/lessons/${world.own.u1.lesson}?/update`, {
				title,
				lessonDay: row.lessonDay,
				notes: ''
			});
		};

		it('pushes waiting entries, then pulls', async () => {
			const { pushes, fetchPush } = pusher();
			const { dev, bodies } = await writer({ fetchPush });
			await dev.answer(done(world.own.u1.exercise), 'u1');
			const [e] = entries();
			const pullsBefore = bodies.length;
			expect(await dev.sync()).toBe('synced');
			expect(pushes).toEqual([[e.id]]);
			expect(bodies.length).toBe(pullsBefore + 1);
			expect(entries()).toHaveLength(0);
			expect(Number(meta('lastSyncedAt'))).toBe(now);
		});

		it('never pulls while an entry waits', async () => {
			const { fetchPush } = pusher((ids) =>
				Response.json({ slot: 5, results: ids.map((id) => ({ id, state: 'deferred' })) })
			);
			const { dev, bodies } = await writer({ fetchPush });
			await dev.answer(done(world.own.u1.exercise), 'u1');
			const pullsBefore = bodies.length;
			expect(await dev.sync()).toBe('waiting');
			expect(bodies.length).toBe(pullsBefore);
			expect(waiting().map((r) => r.state)).toEqual(['waiting']);
		});

		it('drops a pull answer when a write was recorded meanwhile', async () => {
			const ref: { dev?: Awaited<ReturnType<typeof writer>>['dev'] } = {};
			let writeDuringPull = false;
			const { pushes, fetchPush } = pusher((ids) =>
				Response.json({ slot: 5, results: ids.map((id) => ({ id, state: 'deferred' })) })
			);
			const h = await writer({
				fetchPush,
				fetchPull: async (body) => {
					if (writeDuringPull) {
						writeDuringPull = false;
						await ref.dev!.answer(done(world.own.u1.exercise), 'u1');
					}
					const res = answerAsServer(body);
					const json = (await res.json()) as Record<string, unknown>;
					return Response.json({ ...json, slot: 5 });
				}
			});
			ref.dev = h.dev;
			writeDuringPull = true;
			await h.dev.sync();
			const [e] = entries();
			const minted = (JSON.parse(e.minted_json) as { sets: number[] }).sets[0];
			expect(device.prepare('SELECT id FROM sets WHERE id = ?').get(minted)).toBeTruthy();
			expect(pushes).toEqual([[e.id]]);
		});

		it('keeps the copy and the outbox on a 401, and says sign in', async () => {
			const { fetchPush } = pusher(() => new Response('Sign in', { status: 401 }));
			const { dev } = await writer({ fetchPush });
			await dev.answer(done(world.own.u1.exercise), 'u1');
			const sets = count('sets');
			expect(await dev.sync()).toBe('signed-out');
			expect(dev.summary()).toMatchObject({ signedOut: true, waiting: 1 });
			expect(count('sets')).toBe(sets);
			const pull401 = await writer({ fetchPull: async () => new Response('x', { status: 401 }) });
			await pull401.dev.sync();
			expect(count('sets')).toBeGreaterThan(0);
			expect(meta('signedOut')).toBe('1');
		});

		it("names the copy's person on every push, and a 409 (another person signed in) keeps the entries", async () => {
			const users: string[] = [];
			const { dev } = await writer({
				fetchPush: async (body: string) => {
					users.push((JSON.parse(body) as { user: string }).user);
					return Response.json({ message: 'Not yours' }, { status: 409 });
				}
			});
			await dev.answer(done(world.own.u1.exercise), 'u1');
			expect(await dev.sync()).toBe('signed-out');
			expect(users).toEqual(['u1']);
			expect(dev.summary()).toMatchObject({ signedOut: true, waiting: 1 });
		});

		it('a signed-out page never wipes the copy', async () => {
			const { dev } = await writer();
			const sets = count('sets');
			await dev.person(null);
			expect(count('sets')).toBe(sets);
			expect(readMeta(device).userId).toBe('u1');
			expect(dev.state()).not.toBe('ready');
		});

		it("another person gets an empty copy; the first person's entries wait for them", async () => {
			let who = 'u1';
			const { dev } = await writer({
				fetchPush: async () => {
					throw new Error('offline');
				},
				fetchPull: async (body) => {
					const json = (await answerAsServer(body, who).json()) as Record<string, unknown>;
					return Response.json({ ...json, slot: 5 });
				}
			});
			who = 'u4';
			await dev.answer(done(world.own.u1.exercise), 'u1');
			await dev.person('u4');
			expect(readMeta(device).userId).toBe('u4');
			expect(
				(
					device.prepare("SELECT count(*) AS n FROM outbox WHERE user_id = 'u1'").get() as {
						n: number;
					}
				).n
			).toBe(1);
			expect(dev.summary().waiting).toBe(0);
		});

		it("forget wipes the copy and that person's entries", async () => {
			const { dev } = await writer({
				fetchPush: async () => {
					throw new Error('offline');
				}
			});
			await dev.answer(done(world.own.u1.exercise), 'u1');
			await dev.forget();
			expect(entries()).toHaveLength(0);
			expect(count('sets')).toBe(0);
			expect(dev.state()).toBe('empty');
		});

		it('a refused entry stays, and what depends on it is held and never sent', async () => {
			let first = true;
			const { pushes, fetchPush } = pusher((ids) => {
				if (!first)
					return Response.json({ slot: 5, results: ids.map((id) => ({ id, state: 'landed' })) });
				first = false;
				return Response.json({
					slot: 5,
					results: [
						{
							id: ids[0],
							state: 'refused',
							reason: 'gone',
							message: 'Gone',
							clash: null,
							gone: null
						},
						...ids.slice(1).map((id) => ({ id, state: 'held', heldBy: ids[0] }))
					]
				});
			});
			const { dev } = await writer({ fetchPush });
			await dev.answer(lessonEdit('One'), 'u1');
			await dev.answer(lessonEdit('Two'), 'u1');
			await dev.sync();
			await dev.sync();
			expect(pushes).toHaveLength(1);
			expect(waiting().map((r) => r.state)).toEqual(['refused', 'held']);
			expect(dev.summary()).toMatchObject({ refused: 1, held: 1, waiting: 0 });
		});

		it('a lost answer resends the same entry ids', async () => {
			let lose = true;
			const { pushes, fetchPush } = pusher((ids) => {
				if (lose) {
					lose = false;
					throw new Error('the answer was lost');
				}
				return Response.json({ slot: 5, results: ids.map((id) => ({ id, state: 'landed' })) });
			});
			const { dev } = await writer({ fetchPush });
			await dev.answer(done(world.own.u1.exercise), 'u1');
			expect(await dev.sync()).toBe('offline');
			expect(waiting().map((r) => r.state)).toEqual(['waiting']);
			await dev.sync();
			expect(pushes).toHaveLength(2);
			expect(pushes[1]).toEqual(pushes[0]);
		});

		it('retry resends; discard removes and pulls', async () => {
			let refuse = true;
			const { pushes, fetchPush } = pusher((ids) =>
				Response.json({
					slot: 5,
					results: ids.map((id) =>
						refuse
							? { id, state: 'refused', reason: 'refused', message: 'No', clash: null, gone: null }
							: { id, state: 'landed' }
					)
				})
			);
			const { dev, bodies } = await writer({ fetchPush });
			await dev.answer(done(world.own.u1.exercise), 'u1');
			await dev.sync();
			const [e] = entries();
			expect(await dev.retry(e.id)).toBe(1);
			await dev.sync();
			expect(pushes).toEqual([[e.id], [e.id]]);
			const before = bodies.length;
			expect(await dev.discard(e.id)).toBe(1);
			expect(entries()).toHaveLength(0);
			expect(bodies.length).toBeGreaterThan(before);
			refuse = false;
		});
	});
});
