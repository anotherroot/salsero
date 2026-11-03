/** The worker's song audio is charged to the song's owner and held to the disk floor. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const envMock = vi.hoisted(() => ({ DATA_DIR: '' }));
vi.mock('$env/dynamic/private', () => ({ env: envMock }));
const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});
const disk = vi.hoisted(() => ({ free: 100 * 1024 ** 3 }));
vi.mock('$lib/server/storage', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/storage')>('$lib/server/storage');
	return { ...actual, freeDisk: async () => disk.free };
});

import { openDb, type Db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { songs, users } from '$lib/server/db/schema';
import { createSongFromUrl } from '$lib/server/songs';
import { PUT } from './+server';

const MB = 1024 * 1024;
let db: Db;
let songId: number;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-worker-audio-'));
	await mkdir(join(envMock.DATA_DIR, 'audio'), { recursive: true });
	disk.free = 100 * 1024 ** 3;
	db = openDb(':memory:');
	handle.db = db;
	db.insert(users)
		.values({ id: 'u1', email: 'u1@example.com', passwordHash: 'x', storageLimitBytes: 10 * MB })
		.run();
	songId = createSongFromUrl(
		db,
		{ userId: 'u1', dance: 'salsa' },
		{ url: 'https://youtu.be/x', title: 'S', style: 'salsa' }
	).id;
});
afterEach(() => rm(envMock.DATA_DIR, { recursive: true, force: true }));

function put(bytes: number) {
	return PUT({
		params: { id: String(songId) },
		request: new Request('http://localhost/x', {
			method: 'PUT',
			headers: { 'content-type': 'audio/mp4' },
			body: new Uint8Array(bytes)
		})
	} as never);
}

describe('PUT /api/worker/songs/[id]/audio', () => {
	it('stores audio that fits', async () => {
		expect((await put(1000)).status).toBe(204);
	});

	it('refuses with 413 under the disk floor and leaves no file', async () => {
		disk.free = 2 * 1024 ** 3 - 500;
		await expect(put(1000)).rejects.toMatchObject({ status: 413 });
		expect(await readdir(join(envMock.DATA_DIR, 'audio'))).toEqual([]);
	});

	it("refuses with 413 over the song owner's limit", async () => {
		await expect(put(11 * MB)).rejects.toMatchObject({ status: 413 });
		expect(await readdir(join(envMock.DATA_DIR, 'audio'))).toEqual([]);
	});
});

describe('an owner-less song', () => {
	it('answers 409 and fails its job once, so the worker stops', async () => {
		db.update(songs).set({ userId: null }).where(eq(songs.id, songId)).run();
		await expect(put(1000)).rejects.toMatchObject({ status: 409 });
		const row = db.select().from(songs).where(eq(songs.id, songId)).get()!;
		expect(row.status).toBe('failed');
		expect(row.error).toBe('Song has no owner');
	});
});
