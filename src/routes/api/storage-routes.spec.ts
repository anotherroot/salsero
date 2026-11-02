/**
 * Storage limits on the upload routes. `$DATA_DIR` and the database are
 * mocked, never set through `process.env` (see CLAUDE.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
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
import { appFlags, countTakes, songs, users } from '$lib/server/db/schema';
import { U1_SALSA } from '$lib/server/test-walls';
import { addRecording, createFigure } from '$lib/server/figures';
import { createLesson } from '$lib/server/lessons';
import { createSongFromUpload } from '$lib/server/songs';
import { backfillSongSizes, usedBytes } from '$lib/server/storage';
import { uploadsDir } from '$lib/server/files';
import { PUT as putChunk } from './lessons/[id]/videos/[uploadId]/+server';
import { POST as postRecording } from './figures/[id]/recordings/+server';
import { POST as postSong } from './songs/+server';
import { POST as postTake } from './count-takes/+server';

const MB = 1024 * 1024;
const U1 = { id: 'u1', email: 'u1@example.com', timezone: 'Europe/Ljubljana', isAdmin: false };

let db: Db;
let figureId: number;
let lessonId: number;

const run = async (handler: unknown, event: Record<string, unknown>) =>
	(handler as (e: unknown) => Promise<Response>)(event);
async function status(p: Promise<Response>): Promise<number> {
	try {
		return (await p).status;
	} catch (e) {
		return (e as { status: number }).status;
	}
}

beforeEach(() => {
	return mkdtemp(join(tmpdir(), 'salsa-storage-')).then((dir) => {
		envMock.DATA_DIR = dir;
		db = openDb(':memory:');
		handle.db = db;
		db.insert(users)
			.values({ id: 'u1', email: 'u1@example.com', passwordHash: 'x', storageLimitBytes: 10 * MB })
			.run();
		figureId = createFigure(db, U1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		lessonId = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'L', notes: null })
			.lesson.id;
	});
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

const fill = (bytes: number) =>
	addRecording(db, {
		figureId,
		file: `fill-${bytes}.mp4`,
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: bytes,
		note: null
	});

describe('a lesson video declares its total in the first chunk', () => {
	const chunk = (start: number, len: number, total: number) =>
		run(putChunk, {
			params: { id: String(lessonId), uploadId: '11111111-1111-4111-8111-111111111111' },
			locals: { user: U1 },
			request: new Request('http://localhost/', {
				method: 'PUT',
				headers: {
					'content-type': 'video/mp4',
					'content-range': `bytes ${start}-${start + len - 1}/${total}`
				},
				body: new Uint8Array(len)
			})
		});

	it('is refused with 413 and leaves no partial file when the total does not fit', async () => {
		const res = await chunk(0, 1000, 11 * MB);
		expect(res.status).toBe(413);
		expect(((await res.json()) as { message: string }).message ?? '').toMatch(/^Not enough room/);
		expect(await readdir(uploadsDir())).toEqual([]);
	});

	it('goes ahead when the total fits', async () => {
		expect((await chunk(0, 1000, 5 * MB)).status).toBe(204);
		expect(await readdir(uploadsDir())).toHaveLength(1);
	});
});

describe('the other uploads', () => {
	it('a recording is refused by its content-length', async () => {
		fill(9 * MB);
		const res = postRecording as unknown;
		const req = (len: number) =>
			run(res, {
				params: { id: String(figureId) },
				locals: { user: U1 },
				request: new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'video/mp4', 'content-length': String(len) },
					body: new Uint8Array(10)
				})
			});
		expect(await status(req(2 * MB))).toBe(413);
	});

	it('a song upload counts its size, and is refused when over', async () => {
		const post = (n: number) =>
			run(postSong, {
				url: new URL('http://localhost/api/songs?dance=salsa'),
				locals: { user: U1 },
				request: new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'audio/mpeg', 'x-filename': 's.mp3' },
					body: new Uint8Array(n)
				})
			});
		expect(await status(post(100))).toBe(201);
		expect(usedBytes(db, 'u1')).toBe(100);
		fill(10 * MB);
		expect(await status(post(100))).toBe(413);
		expect(await readdir(join(envMock.DATA_DIR, 'audio'))).toHaveLength(1);
	});

	it('a take replacing one in its slot counts only the growth', async () => {
		const headers = {
			'x-pattern': 'on1',
			'x-bpm': '90',
			'x-phrase': 'a',
			'x-sample-rate': '44100',
			'x-length': '1',
			'x-pre-roll': '0',
			'x-duration': '1.2'
		};
		const { TEMPO_LADDER, PHRASE_PATTERNS } = await import('$lib/labels');
		headers['x-pattern'] = PHRASE_PATTERNS[0];
		headers['x-bpm'] = String(TEMPO_LADDER[0]);
		const post = (n: number) =>
			run(postTake, {
				locals: { user: U1 },
				request: new Request('http://localhost/', {
					method: 'POST',
					headers: { ...headers, 'content-type': 'audio/wav' },
					body: new Uint8Array(n)
				})
			});
		fill(10 * MB - 1000);
		expect(await status(post(900))).toBe(201);
		// Same slot, 1000 bytes: net growth 100, room left 100.
		expect(await status(post(1000))).toBe(201);
		expect(db.select().from(countTakes).all()).toHaveLength(1);
		// Same slot again, 1200: net growth 200 over 1000 used, room 100 - refused.
		expect(await status(post(1200))).toBe(413);
	});
});

describe('backfillSongSizes', () => {
	it('fills sizes for existing audio once, and never again', async () => {
		const { audioDir } = await import('$lib/server/files');
		await writeFile(join(audioDir(), 'old.mp3'), new Uint8Array(1234));
		createSongFromUpload(db, U1_SALSA, {
			file: 'old.mp3',
			mime: 'audio/mpeg',
			title: 't',
			style: 'son'
		});
		createSongFromUpload(db, U1_SALSA, {
			file: 'gone.mp3',
			mime: 'audio/mpeg',
			title: 'g',
			style: 'son'
		});
		await backfillSongSizes(db, 1);
		expect(usedBytes(db, 'u1')).toBe(1234);
		expect(
			db
				.select()
				.from(appFlags)
				.all()
				.map((f) => f.key)
		).toContain('song-sizes');
		db.update(songs).set({ sizeBytes: null }).run();
		await backfillSongSizes(db, 2);
		expect(usedBytes(db, 'u1')).toBe(0);
	});
});
