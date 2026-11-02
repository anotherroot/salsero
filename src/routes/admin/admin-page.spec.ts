import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { storageRequests, users } from '$lib/server/db/schema';
import { askForMore, storageOf } from '$lib/server/storage';
import { actions, load } from './+page.server';

const GB = 1024 ** 3;
let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	db.insert(users)
		.values({ id: 'admin', email: 'a@example.com', passwordHash: 'x', isAdmin: true })
		.run();
	db.insert(users)
		.values({ id: 'p', email: 'p@example.com', passwordHash: 'x', storageLimitBytes: GB })
		.run();
});

type Ev = (e: unknown) => Promise<unknown>;
function ev(isAdmin: boolean, fields: Record<string, string> = {}) {
	return {
		locals: { user: { id: isAdmin ? 'admin' : 'p', email: 'x', timezone: 'UTC', isAdmin } },
		request: new Request('http://localhost/admin', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		url: new URL('http://localhost/admin'),
		parent: async () => ({ lastDance: 'salsa' })
	};
}
const act = (name: 'grant' | 'decline' | 'setLimit', e: unknown) =>
	(actions[name] as unknown as Ev)(e);

describe('admin page', () => {
	it('load and every action are a 404 for a non-admin', async () => {
		await expect((load as unknown as Ev)(ev(false))).rejects.toMatchObject({ status: 404 });
		for (const name of ['grant', 'decline', 'setLimit'] as const) {
			await expect(act(name, ev(false, { id: '1', preset: '2' }))).rejects.toMatchObject({
				status: 404
			});
		}
		expect(storageOf(db, 'p').limitBytes).toBe(GB);
	});

	it('load lists requests and people with calendar days', async () => {
		askForMore(db, 'p', 'please', Date.UTC(2026, 10, 2, 12));
		const d = (await (load as unknown as Ev)(ev(true))) as {
			requests: { day: string; email: string }[];
			people: { email: string }[];
		};
		expect(d.requests).toMatchObject([{ email: 'p@example.com', day: '2026-11-02' }]);
		expect(d.people.map((p) => p.email)).toContain('a@example.com');
	});

	it('grant sets the limit from a preset or a typed GB and closes the request', async () => {
		askForMore(db, 'p', null, 1);
		const id = String(db.select().from(storageRequests).all()[0].id);
		expect(await act('grant', ev(true, { id, preset: '5' }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBe(5 * GB);
		expect(await act('grant', ev(true, { id, gb: '8' }))).toMatchObject({ status: 404 });
		askForMore(db, 'p', null, 2);
		const id2 = String(db.select().from(storageRequests).all()[1].id);
		expect(await act('grant', ev(true, { id: id2, gb: '7.5' }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBe(7.5 * GB);
	});

	it('grant refuses a bad number with a 400 and keeps the request open', async () => {
		askForMore(db, 'p', null, 1);
		const id = String(db.select().from(storageRequests).all()[0].id);
		for (const gb of ['', '0', '-2', 'abc']) {
			expect(await act('grant', ev(true, { id, gb }))).toMatchObject({ status: 400 });
		}
		expect(storageOf(db, 'p').limitBytes).toBe(GB);
	});

	it('decline closes without changing the limit', async () => {
		askForMore(db, 'p', null, 1);
		const id = String(db.select().from(storageRequests).all()[0].id);
		expect(await act('decline', ev(true, { id }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBe(GB);
		expect(db.select().from(storageRequests).all()[0].outcome).toBe('declined');
	});

	it('setLimit takes a preset, a number, or none, and refuses the rest', async () => {
		expect(await act('setLimit', ev(true, { userId: 'p', preset: '10' }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBe(10 * GB);
		expect(await act('setLimit', ev(true, { userId: 'p', none: '1' }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBeNull();
		expect(await act('setLimit', ev(true, { userId: 'p', gb: '0' }))).toMatchObject({
			status: 400
		});
		expect(await act('setLimit', ev(true, { userId: 'ghost', gb: '2' }))).toMatchObject({
			status: 404
		});
	});
});

describe('admin page: preset or typed', () => {
	it('a pressed preset wins over a typed number; Enter (gb alone) uses the number', async () => {
		askForMore(db, 'p', null, 1);
		const id = String(db.select().from(storageRequests).all()[0].id);
		expect(await act('setLimit', ev(true, { userId: 'p', preset: '2', gb: '8' }))).toEqual({
			ok: true
		});
		expect(storageOf(db, 'p').limitBytes).toBe(2 * GB);
		expect(await act('grant', ev(true, { id, gb: '8' }))).toEqual({ ok: true });
		expect(storageOf(db, 'p').limitBytes).toBe(8 * GB);
	});
});
