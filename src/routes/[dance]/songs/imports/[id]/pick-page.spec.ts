/** The pick list page: its load and its two actions. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { songs, users } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { createImport, getImport, storeImportItems } from '$lib/server/song-imports';
import { T1_SALSA, U1_SALSA } from '$lib/server/test-walls';
import type { Space } from '$lib/server/scope';
import * as pickPage from './+page.server';

let db: Db;
const cookies = { get: () => undefined, set: () => {}, delete: () => {} } as unknown as Cookies;
const ev = (id: number, as = 'u1', fields: Record<string, string> = {}) => ({
	params: { dance: 'salsa', id: String(id) },
	locals: { user: { id: as, timezone: 'Europe/Ljubljana', dance: 'salsa', role: 'user' } },
	cookies,
	request: new Request('http://localhost/', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	})
});
async function call(fn: unknown, e: unknown): Promise<unknown> {
	try {
		return await (fn as (e: unknown) => unknown)(e);
	} catch (thrown) {
		return thrown;
	}
}
const ITEMS = [0, 1].map((n) => ({
	title: `Song ${n}`,
	artist: 'A',
	durationS: 200,
	url: `https://youtu.be/v${n}`
}));
function ready(space: Space = U1_SALSA) {
	const id = createImport(db, space, {
		url: 'https://www.youtube.com/playlist?list=PL1',
		kind: 'youtube-playlist'
	}).id;
	storeImportItems(db, id, { name: 'Clase', items: ITEMS, truncated: false });
	return id;
}

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	createTeam(db, 'u1', 'salsa', 'Class', 1);
	joinTeam(db, 'u2', 1, 2);
});

describe('the pick list page', () => {
	it('loads the items, each with whether it is already added', async () => {
		const id = ready();
		const data = (await call(pickPage.load, ev(id))) as {
			imp: { name: string };
			items: { i: number; already: boolean }[];
		};
		expect(data.imp.name).toBe('Clase');
		expect(data.items.map((i) => [i.i, i.already])).toEqual([
			[0, false],
			[1, false]
		]);
	});

	it("is a 404 to a member of the list's group", async () => {
		const id = ready(T1_SALSA);
		expect(await call(pickPage.load, ev(id, 'u2'))).toMatchObject({ status: 404 });
	});

	it('adds the picks and goes back to Music; an added list sends there too', async () => {
		const id = ready();
		const picks = JSON.stringify([
			{ i: 0, title: 'Uno', artist: 'A', style: 'salsa' },
			{ i: 1, title: 'Dos', artist: '', style: 'son' }
		]);
		expect(
			await call(pickPage.actions.add, ev(id, 'u1', { picks, styleForAll: 'salsa' }))
		).toMatchObject({ status: 303, location: '/salsa/songs' });
		expect(
			db
				.select()
				.from(songs)
				.all()
				.map((s) => s.title)
		).toEqual(['Uno', 'Dos']);
		expect(await call(pickPage.load, ev(id))).toMatchObject({
			status: 303,
			location: '/salsa/songs'
		});
	});

	it('refuses malformed picks and the storage limit, adding nothing', async () => {
		const id = ready();
		expect(
			await call(pickPage.actions.add, ev(id, 'u1', { picks: 'nope', styleForAll: 'salsa' }))
		).toMatchObject({ status: 400 });
		db.insert(users)
			.values({ id: 'u1', email: 'u1@x.si', passwordHash: 'x', storageLimitBytes: 0 })
			.run();
		const picks = JSON.stringify([{ i: 0, title: 'Uno', artist: null, style: 'salsa' }]);
		expect(
			await call(pickPage.actions.add, ev(id, 'u1', { picks, styleForAll: 'salsa' }))
		).toMatchObject({ status: 413 });
		expect(db.select().from(songs).all()).toEqual([]);
	});

	it('dismisses and goes back to Music', async () => {
		const id = ready();
		expect(await call(pickPage.actions.dismiss, ev(id))).toMatchObject({
			status: 303,
			location: '/salsa/songs'
		});
		expect(getImport(db, id)?.dismissedAt).not.toBeNull();
	});
});
