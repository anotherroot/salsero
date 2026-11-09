import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { createSession, SESSION_COOKIE } from '$lib/server/auth';
import { createDeviceToken } from '$lib/server/devices';
import { makeWorld, WORLD_T } from '$lib/server/sync/test-world';
import { POST } from './+server';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	makeWorld(db);
});

function call(opts: { cookies?: Record<string, string>; body?: unknown; user?: boolean }) {
	const jar = opts.cookies ?? {};
	const request = new Request('http://x/api/sync/push', {
		method: 'POST',
		body: typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body ?? {})
	});
	const cookies = { get: (n: string) => jar[n] };
	const locals = { user: opts.user ? { id: 'u1' } : null };
	const fetch = async () => new Response('{}', { status: 500 });
	return (POST as unknown as (e: unknown) => Promise<Response>)({
		request,
		cookies,
		locals,
		fetch,
		url: new URL('http://x/api/sync/push')
	});
}

describe('POST /api/sync/push', () => {
	it('refuses no session, a device token and a malformed body', async () => {
		const body = { device: 'dev-test-1', user: 'u1', entries: [] };
		expect((await call({ body })).status).toBe(401);
		createDeviceToken(db, 'u1', 'phone', WORLD_T);
		expect((await call({ body, user: true })).status).toBe(401);
		db.run(sql`UPDATE users SET dance = 'salsa' WHERE id = 'u1'`);
		const cookies = { [SESSION_COOKIE]: createSession('u1', db).id };
		expect((await call({ cookies, body: 'not json' })).status).toBe(400);
		expect((await call({ cookies, body: { device: 'x', entries: [] } })).status).toBe(400);
		expect(
			(await call({ cookies, body: { device: 'dev-test-1', entries: [{ id: 'short' }] } })).status
		).toBe(400);
		const ok = await call({ cookies, body });
		expect(ok.status).toBe(200);
		expect(await ok.json()).toEqual({ slot: 1, results: [] });
		expect((await call({ cookies, body: { device: 'dev-test-1', entries: [] } })).status).toBe(400);
	});

	it("refuses another person's changes under this session: they wait for their own person", async () => {
		db.run(sql`UPDATE users SET dance = 'salsa' WHERE id = 'u1'`);
		const cookies = { [SESSION_COOKIE]: createSession('u1', db).id };
		const res = await call({ cookies, body: { device: 'dev-test-1', user: 'u2', entries: [] } });
		expect(res.status).toBe(409);
	});
});
