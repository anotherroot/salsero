import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => undefined };
});

import { openDb, type Db } from '$lib/server/db';
import { pull as rawPull, serverDigest } from '$lib/server/sync/pull';
import { syncScope } from '$lib/server/sync/scope';
import { addFigureSlot, moveSlotTo } from '$lib/server/routines';
import { makeWorld, type World } from '$lib/server/sync/test-world';
import { SCHEMA_TAG } from '$lib/sync/schema-tag';
import { SYNCED } from '$lib/sync/tables';
import type { PullResponse } from '$lib/sync/wire';
import { migrateDevice, readMeta } from './migrate';
import { applyPull, deviceDigests, ensureDeviceKey, pullRequestOf, wipeCopy } from './apply';
import { repoMigrations } from './test-migrations';

let server: Db;
let world: World;
let device: Database.Database;

beforeEach(() => {
	server = openDb(':memory:');
	world = makeWorld(server);
	device = new Database(':memory:');
	migrateDevice(device, repoMigrations());
	device.pragma('foreign_keys = ON');
});

function pull(userId: string): PullResponse {
	const out = rawPull(server, userId, { cursor: 0, schema: SCHEMA_TAG });
	if ('refused' in out) throw new Error('refused');
	return out;
}

const count = (table: string) =>
	(device.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n;
const counts = () => Object.fromEntries(Object.keys(SYNCED).map((t) => [t, count(t)]));

describe('applyPull', () => {
	it("holds exactly the person's scope after a full pull", () => {
		applyPull(device, pull('u1'));
		const scope = syncScope(server, 'u1');
		for (const [table, rows] of scope) expect(count(table), table).toBe(rows.size);
		expect(count('figures')).toBeGreaterThan(0);
		expect(device.pragma('foreign_keys', { simple: true })).toBe(1);
		expect(count('change_log')).toBe(0);
		expect(readMeta(device)).toMatchObject({ userId: 'u1', full: false, schema: SCHEMA_TAG });
	});

	it("digests agree with the server's after a pull", async () => {
		applyPull(device, pull('u1'));
		const mine = await deviceDigests(device);
		for (const [table, rows] of syncScope(server, 'u1')) {
			expect(mine[table], table).toBe(serverDigest(rows.keys()));
		}
	});

	it('replacing a parent table keeps its children', () => {
		applyPull(device, pull('u1'));
		const before = counts();
		expect(before.recordings).toBeGreaterThan(0);
		const res = pull('u1');
		applyPull(device, { ...res, full: ['figures'], changed: { figures: res.changed.figures } });
		expect(counts()).toEqual(before);
	});

	it("an upsert keeps the row's children", () => {
		const res = pull('u1');
		applyPull(device, res);
		const before = counts();
		const f = res.changed.figures;
		applyPull(device, {
			...res,
			full: [],
			changed: { figures: { cols: f.cols, rows: [f.rows[0]] } }
		});
		expect(counts()).toEqual(before);
	});

	it('an upsert changes the row it names', () => {
		const res = pull('u1');
		applyPull(device, res);
		const f = res.changed.figures;
		const nameAt = f.cols.indexOf('name');
		const row = [...f.rows[0]];
		row[nameAt] = 'Renamed on the server';
		applyPull(device, { ...res, full: [], changed: { figures: { cols: f.cols, rows: [row] } } });
		const idAt = f.cols.indexOf('id');
		expect(device.prepare('SELECT name FROM figures WHERE id = ?').get(row[idAt])).toEqual({
			name: 'Renamed on the server'
		});
	});

	it("wipes before applying another person's pull", () => {
		applyPull(device, pull('u1'));
		const u1Only = (server.all(sql`SELECT id FROM users WHERE id = 'u1'`) as { id: string }[])
			.length;
		expect(u1Only).toBe(1);
		applyPull(device, pull('u4'));
		expect(device.prepare("SELECT count(*) AS n FROM users WHERE id = 'u1'").get()).toEqual({
			n: 0
		});
		for (const [table, rows] of syncScope(server, 'u4'))
			expect(count(table), table).toBe(rows.size);
		expect(readMeta(device).userId).toBe('u4');
	});

	it("another person's pull, asked with the copy's request, leaves exactly their scope", async () => {
		// Luka (u2) and Maja (u3) share group 1: users, teams and team_members hold the same keys for both.
		applyPull(device, pull('u2'));
		// The device asks as it always does: its cursor and digests are u2's.
		const req = await pullRequestOf(device, SCHEMA_TAG);
		expect(req.userId).toBe('u2');
		const res = rawPull(server, 'u3', req);
		if ('refused' in res) throw new Error('refused');
		applyPull(device, res);
		const scope = syncScope(server, 'u3');
		for (const [table, rows] of scope) expect(count(table), table).toBe(rows.size);
		expect(await deviceDigests(device)).toEqual(
			Object.fromEntries([...scope].map(([t, rows]) => [t, serverDigest(rows.keys())]))
		);
		expect(device.prepare("SELECT id FROM users WHERE id = 'u3'").get()).toEqual({ id: 'u3' });
		expect(readMeta(device).userId).toBe('u3');
	});

	it('leaves the copy as it was when a row fails', () => {
		applyPull(device, pull('u1'));
		const before = counts();
		const metaBefore = readMeta(device);
		const res = pull('u1');
		const f = res.changed.figures;
		expect(() =>
			applyPull(device, {
				...res,
				cursor: 999,
				full: ['figures', 'recordings'],
				changed: { figures: { cols: f.cols, rows: [f.rows[0], f.rows[1].slice(1)] } }
			})
		).toThrow();
		expect(counts()).toEqual(before);
		expect(device.pragma('foreign_keys', { simple: true })).toBe(1);
		expect(device.inTransaction).toBe(false);
		// The next pull asks for everything: a failed one must not be sent again as it was.
		expect(readMeta(device)).toEqual({ ...metaBefore, full: true });
	});

	it('a swap of two slots that conflicts as upserts is healed by a full pull', async () => {
		const own = world.own.u1;
		const second = addFigureSlot(server, own.routine, own.figure)!;
		expect(second).toBeTruthy();
		applyPull(device, pull('u1'));
		expect(readMeta(device).full).toBe(false);
		expect(moveSlotTo(server, own.routine, second, 0)).toBe(true);

		const incremental = rawPull(server, 'u1', await pullRequestOf(device, SCHEMA_TAG));
		if ('refused' in incremental) throw new Error('refused');
		expect(incremental.full).not.toContain('routine_steps');
		expect(incremental.changed.routine_steps.rows.length).toBeGreaterThan(1);

		const before = counts();
		const slots = () =>
			device
				.prepare('SELECT id, position FROM routine_steps WHERE routine_id = ? ORDER BY id')
				.all(own.routine);
		const slotsBefore = slots();
		expect(() => applyPull(device, incremental)).toThrow(/UNIQUE/);
		expect(counts()).toEqual(before);
		expect(slots()).toEqual(slotsBefore);
		expect(readMeta(device).full).toBe(true);
		expect('digests' in (await pullRequestOf(device, SCHEMA_TAG))).toBe(false);

		applyPull(device, pull('u1'));
		const serverSlots = server.all(
			sql`SELECT id, position FROM routine_steps WHERE routine_id = ${own.routine} ORDER BY id`
		);
		expect(slots()).toEqual(serverSlots);
		expect(slots()).not.toEqual(slotsBefore);
		expect(readMeta(device).full).toBe(false);
	});

	it('takes rows that point at rows the device never gets', () => {
		const res = pull('u1');
		const f = res.changed.figures;
		const parentAt = f.cols.indexOf('group_id');
		const rows = f.rows.map((r) => r.map((v, i) => (i === parentAt ? 987654321 : v)));
		applyPull(device, { ...res, changed: { ...res.changed, figures: { cols: f.cols, rows } } });
		expect(count('figures')).toBe(f.rows.length);
		expect(device.pragma('foreign_keys', { simple: true })).toBe(1);
	});

	it('ignores a table it does not sync, and a column it does not have', () => {
		const res = pull('u1');
		const u = res.changed.users;
		applyPull(device, {
			...res,
			full: [...res.full, 'sessions'],
			changed: {
				...res.changed,
				sessions: { cols: ['id'], rows: [['x']] },
				users: { cols: [...u.cols, 'nope'], rows: u.rows.map((r) => [...r, 1]) }
			}
		});
		expect(count('users')).toBe(u.rows.length);
		expect(
			device.prepare("SELECT name FROM sqlite_master WHERE name = 'sessions'").get()
		).toBeDefined();
		expect(device.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 });
	});
});

describe('wipeCopy', () => {
	it('empties the synced tables and the meta, and keeps the schema', () => {
		applyPull(device, pull('u1'));
		wipeCopy(device);
		for (const n of Object.values(counts())) expect(n).toBe(0);
		expect(readMeta(device)).toMatchObject({ userId: null, cursor: 0, full: true });
		expect(device.prepare('SELECT count(*) AS n FROM device_migrations').get()).not.toEqual({
			n: 0
		});
		expect(device.pragma('foreign_keys', { simple: true })).toBe(1);
	});
});

describe('the device key and slot', () => {
	it('keeps the device key and slot through a wipe', () => {
		const key = ensureDeviceKey(device, () => 'dev-key-0001');
		expect(ensureDeviceKey(device, () => 'another-key-02')).toBe(key);
		applyPull(device, { ...pull('u1'), slot: 3 });
		expect(readMeta(device)).toMatchObject({ deviceKey: key, slot: 3 });
		wipeCopy(device);
		expect(readMeta(device)).toMatchObject({ deviceKey: key, slot: 3, userId: null });
	});

	it('sends its device key with every pull request', async () => {
		expect((await pullRequestOf(device, SCHEMA_TAG)).device).toBeUndefined();
		const key = ensureDeviceKey(device, () => 'dev-key-0001');
		expect((await pullRequestOf(device, SCHEMA_TAG)).device).toBe(key);
		applyPull(device, pull('u1'));
		expect((await pullRequestOf(device, SCHEMA_TAG)).device).toBe(key);
	});
});

describe('pullRequestOf', () => {
	it('asks for everything after a migration and for changes after a pull', async () => {
		const first = await pullRequestOf(device, SCHEMA_TAG);
		expect(first).toEqual({ cursor: 0, schema: SCHEMA_TAG, userId: null });
		expect('digests' in first).toBe(false);
		const res = pull('u1');
		applyPull(device, res);
		const next = await pullRequestOf(device, SCHEMA_TAG);
		expect(next.cursor).toBe(res.cursor);
		expect(next.digests).toEqual(await deviceDigests(device));
		expect(Object.keys(next.digests!).sort()).toEqual(Object.keys(SYNCED).sort());
	});

	it('a pull made from it brings nothing new when nothing changed', async () => {
		applyPull(device, pull('u1'));
		const again = rawPull(server, 'u1', await pullRequestOf(device, SCHEMA_TAG));
		if ('refused' in again) throw new Error('refused');
		expect(again.full).toEqual([]);
		expect(again.changed).toEqual({});
	});
});
