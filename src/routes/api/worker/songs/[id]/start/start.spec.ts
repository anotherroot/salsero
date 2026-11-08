/** The worker's one-off pass: which ready songs still need their music start, and taking it back. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { archiveSong, createSongFromUpload, getSong, storeAnalysis } from '$lib/server/songs';
import { U1_SALSA } from '$lib/server/test-walls';
import { POST } from './+server';
import { GET } from '../../../starts/+server';

let db: Db;
let id: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	id = createSongFromUpload(db, U1_SALSA, {
		file: 's.mp3',
		mime: 'audio/mpeg',
		title: 'S',
		style: 'salsa'
	}).id;
	storeAnalysis(db, id, { beats: [0.5, 1], downbeats: [], durationS: 200 });
});

const post = (body: unknown, song = id) =>
	POST({
		params: { id: String(song) },
		request: new Request('http://localhost/x', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as never);

describe('the music start from the worker', () => {
	it('lists the songs still to measure, then takes the start back', async () => {
		expect(await (await GET({} as never)).json()).toEqual([{ id }]);
		expect((await post({ startS: 18.2 })).status).toBe(204);
		expect(getSong(db, id)!.startFoundS).toBe(18.2);
		expect(await (await GET({} as never)).json()).toEqual([]);
	});

	it('refuses a time outside the song, and an archived or missing song', async () => {
		expect((await post({ startS: 'x' })).status).toBe(400);
		expect((await post({ startS: 300 })).status).toBe(400);
		await expect(post({ startS: 1 }, 999)).rejects.toMatchObject({ status: 404 });
		archiveSong(db, id, 1);
		await expect(post({ startS: 1 })).rejects.toMatchObject({ status: 404 });
	});
});
