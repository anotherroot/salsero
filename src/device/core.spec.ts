import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => undefined };
});

import { openDb, type Db } from '$lib/server/db';
import { pull as serverPull } from '$lib/server/sync/pull';
import { makeWorld } from '$lib/server/sync/test-world';
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
beforeAll(() => {
	server = openDb(':memory:');
	makeWorld(server);
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

/** The server's pull for u1, answered as the route does, with a theme cookie echoed. */
function answerAsServer(body: string): Response {
	const out = serverPull(server, 'u1', JSON.parse(body) as PullRequest);
	if ('refused' in out) return Response.json(out, { status: 409 });
	return Response.json({ ...out, cookies: { theme: 'dark', group_salsa: 'a b' } });
}

const pending = () => new Promise<Response>(() => {});

function harness(over: Partial<DeviceDeps> = {}) {
	const posted: DeviceOut[] = [];
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
		post: (m) => posted.push(m),
		online: () => true,
		userAgent: 'Phone/1.0',
		log,
		...over
	};
	const wrapped = deps.fetchPull;
	deps.fetchPull = (body) => {
		bodies.push(JSON.parse(body) as PullRequest);
		return wrapped(body);
	};
	const dev = createDevice(deps);
	const states = () => posted.filter((m) => m.type === 'state').map((m) => m.state);
	return { dev, posted, bodies, runtimes, seen, log, startServer, states };
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
		expect(h.runtimes).toEqual([{ userId: 'u1', cookies: { theme: 'dark', group_salsa: 'a b' } }]);
		expect(h.startServer).toHaveBeenCalledTimes(1);
		expect(h.bodies).toEqual([{ cursor: 0, schema: SCHEMA_TAG }]);
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
});

describe('pull', () => {
	it('signed out: wipes the copy and is empty', async () => {
		let status = 200;
		const h = harness({
			fetchPull: async (body) =>
				status === 200 ? answerAsServer(body) : Response.json({}, { status })
		});
		await h.dev.start();
		status = 401;
		await h.dev.pull();
		expect(h.dev.state()).toBe('empty');
		expect(count('figures')).toBe(0);
		expect(readMeta(device).userId).toBeNull();
		expect(await h.dev.answer(get('/salsa/figures/__data.json'))).toMatchObject({
			fallback: true
		});
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
