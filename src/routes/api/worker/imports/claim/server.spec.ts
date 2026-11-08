/** The worker's import queue: claim, the items, a failure. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { U1_SALSA } from '$lib/server/test-walls';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { createImport, dismissImport, getImport, MAX_IMPORT_ITEMS } from '$lib/server/song-imports';
import { POST as claim } from './+server';
import { POST as items } from '../[id]/items/+server';
import { POST as fail } from '../[id]/fail/+server';

const LIST = 'https://www.youtube.com/playlist?list=PL1';
const T = 1_800_000_000_000;
let db: Db;
let id: number;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	id = createImport(db, U1_SALSA, { url: LIST, kind: 'youtube-playlist' }, T).id;
});

const post = (body: unknown, raw = false) =>
	({
		params: { id: String(id) },
		request: new Request('http://localhost/x', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: raw ? (body as string) : JSON.stringify(body)
		})
	}) as never;
const song = (n: number) => ({
	title: `Song ${n}`,
	artist: null,
	durationS: 200,
	url: `https://www.youtube.com/watch?v=v${n}`
});

describe('the import queue', () => {
	it('hands out the import, then nothing', async () => {
		const first = await claim({} as never);
		expect(first.status).toBe(200);
		expect(await first.json()).toEqual({ id, url: LIST });
		expect((await claim({} as never)).status).toBe(204);
	});

	it('stores the items: 204 and the import is ready', async () => {
		const res = await items(post({ name: 'Clase', items: [song(1)], truncated: false }));
		expect(res.status).toBe(204);
		expect(getImport(db, id)?.status).toBe('ready');
	});

	it('answers 410 for a list dismissed meanwhile, 400 for too many', async () => {
		const many = Array.from({ length: MAX_IMPORT_ITEMS + 1 }, (_, n) => song(n));
		await expect(items(post({ name: 'x', items: many, truncated: false }))).rejects.toMatchObject({
			status: 400
		});
		dismissImport(db, id, T);
		await expect(
			items(post({ name: 'x', items: [song(1)], truncated: false }))
		).rejects.toMatchObject({ status: 410 });
	});

	it('fails it for good, and reads a broken body as an unknown error', async () => {
		expect((await fail(post('not json', true))).status).toBe(204);
		expect(getImport(db, id)).toMatchObject({ status: 'reading', error: 'Unknown worker error' });
		await fail(post({ error: 'This playlist is private', permanent: true }));
		expect(getImport(db, id)).toMatchObject({
			status: 'failed',
			error: 'This playlist is private'
		});
	});
});
