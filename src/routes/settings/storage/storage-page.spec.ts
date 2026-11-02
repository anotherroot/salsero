/** The storage page: listing and the Delete actions. Files live in a temp dir; `$env` and the db are mocked. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const envMock = vi.hoisted(() => ({ DATA_DIR: '' }));
vi.mock('$env/dynamic/private', () => ({ env: envMock }));
const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { U1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { addRecording, createFigure } from '$lib/server/figures';
import { createSongFromUpload, getSong } from '$lib/server/songs';
import { audioDir, recordingsDir } from '$lib/server/files';
import { actions, load } from './+page.server';

const U1 = { id: 'u1', email: 'u1@example.com', timezone: 'Europe/Ljubljana', isAdmin: false };
let db: Db;

const post = (fields: Record<string, string>, user = U1) => ({
	request: new Request('http://localhost/', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	}),
	locals: { user }
});
const run = async (fn: unknown, event: unknown) =>
	(await (fn as (e: unknown) => Promise<unknown>)(event)) as Record<string, unknown> & {
		status?: number;
		data?: { message?: string };
	};
const exists = (p: string) =>
	access(p).then(
		() => true,
		() => false
	);

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-storage-page-'));
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['u1', 'u2'])
		db.insert(users)
			.values({ id, email: `${id}@x.com`, passwordHash: 'x' })
			.run();
});
afterEach(() => rm(envMock.DATA_DIR, { recursive: true, force: true }));

function song(wall: typeof U1_SALSA, file: string) {
	return createSongFromUpload(db, wall, {
		file,
		mime: 'audio/mpeg',
		title: 'T',
		style: 'son',
		sizeBytes: 10
	});
}

describe('the storage page', () => {
	it('loads the signed-in person’s items', async () => {
		song(U1_SALSA, 'a.mp3');
		song(U2_SALSA, 'b.mp3');
		const data = (await run(load, { locals: { user: U1 } })) as { items: unknown[] };
		expect(data.items).toHaveLength(1);
	});

	it('deleteSong removes the row and its file', async () => {
		const s = song(U1_SALSA, 'a.mp3');
		await writeFile(join(audioDir(), 'a.mp3'), 'x').catch(async () => {
			const { mkdir } = await import('node:fs/promises');
			await mkdir(audioDir(), { recursive: true });
			await writeFile(join(audioDir(), 'a.mp3'), 'x');
		});
		const res = await run(actions.deleteSong, post({ id: String(s.id) }));
		expect(res).toMatchObject({ ok: true });
		expect(getSong(db, s.id)).toBeNull();
		expect(await exists(join(audioDir(), 'a.mp3'))).toBe(false);
	});

	it('another person’s song, recording or video is a 404 and stays', async () => {
		const s = song(U1_SALSA, 'a.mp3');
		const u2 = { ...U1, id: 'u2' };
		expect((await run(actions.deleteSong, post({ id: String(s.id) }, u2))).status).toBe(404);
		expect(getSong(db, s.id)).not.toBeNull();

		const f = createFigure(db, U1_SALSA, {
			figureName: 'E',
			name: 'B',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;
		const rec = addRecording(db, {
			figureId: f.figure.id,
			file: 'r.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 5,
			note: null
		});
		expect((await run(actions.deleteRecording, post({ id: String(rec.id) }, u2))).status).toBe(404);
		expect((await run(actions.deleteVideo, post({ id: '1' }, u2))).status).toBe(404);
		const own = await run(actions.deleteRecording, post({ id: String(rec.id) }));
		expect(own).toMatchObject({ ok: true });
		void recordingsDir;
	});
});
