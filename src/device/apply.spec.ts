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
import { makeWorld } from '$lib/server/sync/test-world';
import { SCHEMA_TAG } from '$lib/sync/schema-tag';
import { SYNCED } from '$lib/sync/tables';
import type { PullResponse } from '$lib/sync/wire';
import { migrateDevice, readMeta } from './migrate';
import { applyPull, deviceDigests, pullRequestOf, wipeCopy } from './apply';
import { repoMigrations } from './test-migrations';

let server: Db;
let device: Database.Database;

beforeEach(() => {
	server = openDb(':memory:');
	makeWorld(server);
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
		expect(readMeta(device)).toEqual(metaBefore);
		expect(device.pragma('foreign_keys', { simple: true })).toBe(1);
		expect(device.inTransaction).toBe(false);
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

describe('pullRequestOf', () => {
	it('asks for everything after a migration and for changes after a pull', async () => {
		const first = await pullRequestOf(device, SCHEMA_TAG);
		expect(first).toEqual({ cursor: 0, schema: SCHEMA_TAG });
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
