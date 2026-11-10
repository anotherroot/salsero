/**
 * The layouts drawn on the device (device first) read what only the server
 * knows from the last pull's extras, never from tables the copy does not hold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});
const readers = vi.hoisted(() => ({
	pendingCount: vi.fn(() => 0),
	currentRelease: vi.fn(() => null)
}));
vi.mock('$lib/server/ai-queue/store', async (orig) => ({
	...(await orig<typeof import('$lib/server/ai-queue/store')>()),
	pendingCount: readers.pendingCount
}));
vi.mock('$lib/server/releases', async (orig) => ({
	...(await orig<typeof import('$lib/server/releases')>()),
	currentRelease: readers.currentRelease
}));

import { openDb, type Db } from '$lib/server/db';
import { makeClass } from '$lib/server/test-class';
import type { ServerExtras } from '$lib/sync/wire';
import type { SongImportRow } from '$lib/types';
import { load as rootLoad } from './+layout.server';
import { load as danceLoad } from './[dance]/+layout.server';
import { load as songsLoad } from './[dance]/songs/+layout.server';

let db: Db;
const g = globalThis as { __salsaDevice?: unknown };

const extras = (over: Partial<ServerExtras> = {}): ServerExtras => ({
	musicToPick: true,
	aiPending: 3,
	aiConnected: true,
	release: null,
	imports: { own: [], teams: {} },
	...over
});
const onDevice = (x: ServerExtras | null) =>
	(g.__salsaDevice = { userId: 'u2', cookies: {}, slot: null, extras: x });

const locals = (agent: unknown = null) =>
	({
		user: { id: 'u2', timezone: 'Europe/Ljubljana', dance: 'salsa', level: 'all' },
		appAgent: agent,
		locale: 'en'
	}) as unknown as App.Locals;
const call = (fn: unknown, url: string, route: string, agent?: unknown) =>
	(fn as (e: unknown) => Record<string, unknown>)({
		params: { dance: 'salsa' },
		locals: locals(agent),
		url: new URL(url),
		route: { id: route },
		cookies: { get: () => undefined },
		depends: () => {}
	});

const row = (id: number): SongImportRow => ({ id }) as unknown as SongImportRow;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	makeClass(db);
	db.run(sql`UPDATE users SET dance = 'salsa'`);
	readers.pendingCount.mockClear();
	readers.currentRelease.mockClear();
});
afterEach(() => delete g.__salsaDevice);

describe('the dance layout on the device', () => {
	it('reads the dots from the extras', () => {
		onDevice(extras());
		const out = call(danceLoad, 'http://x/salsa', '/[dance]');
		expect(out).toMatchObject({ musicToPick: true, aiPending: 3, aiConnected: true });
		expect(readers.pendingCount).not.toHaveBeenCalled();
	});

	it('an old copy with no extras draws no dots', () => {
		onDevice(null);
		expect(call(danceLoad, 'http://x/salsa', '/[dance]')).toMatchObject({
			musicToPick: false,
			aiPending: 0,
			aiConnected: false
		});
	});

	it('the server reads its own tables', () => {
		call(danceLoad, 'http://x/salsa', '/[dance]');
		expect(readers.pendingCount).toHaveBeenCalled();
	});
});

describe('the root layout on the device', () => {
	const agent = { versionCode: 5, channel: 'web', dance: 'salsa' };
	it('reads the release from the extras: below the minimum, an update is required', () => {
		onDevice(
			extras({
				release: {
					versionCode: 9,
					versionName: '1.8',
					minVersionCode: 7,
					sha256: 'x',
					size: 1,
					commit: 'c'
				}
			})
		);
		const out = call(rootLoad, 'http://x/salsa', '/[dance]', agent);
		expect((out.appUpdate as { state: string }).state).toBe('required');
		expect(readers.currentRelease).not.toHaveBeenCalled();
	});

	it('an old copy with no extras knows of no release', () => {
		onDevice(null);
		const out = call(rootLoad, 'http://x/salsa', '/[dance]', agent);
		expect((out.appUpdate as { state: string }).state).toBe('none');
	});
});

describe('the songs layout on the device', () => {
	it('lists the own view from the extras', () => {
		onDevice(extras({ imports: { own: [row(7)], teams: { '1': [row(8)] } } }));
		const out = call(songsLoad, 'http://x/salsa/songs', '/[dance]/songs');
		expect((out.imports as SongImportRow[]).map((r) => r.id)).toEqual([7]);
	});

	it("lists a group's view from the extras", () => {
		onDevice(extras({ imports: { own: [row(7)], teams: { '1': [row(8)] } } }));
		const out = call(songsLoad, 'http://x/salsa/songs?in=1', '/[dance]/songs');
		expect((out.imports as SongImportRow[]).map((r) => r.id)).toEqual([8]);
	});

	it('an old copy with no extras lists none', () => {
		onDevice(null);
		const out = call(songsLoad, 'http://x/salsa/songs', '/[dance]/songs');
		expect(out.imports).toEqual([]);
	});
});
