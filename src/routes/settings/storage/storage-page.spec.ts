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

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { lessonVideos, recordings, songs, exercises, users } from '$lib/server/db/schema';
import { addLessonVideo, createLesson } from '$lib/server/lessons';
import { addSpot } from '$lib/server/spots';
import { linkSpot } from '$lib/server/spot-links';
import { lessonVideosDir } from '$lib/server/files';
import { mkdir } from 'node:fs/promises';
import { U1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { addRecording, createFigure } from '$lib/server/figures';
import { createSongFromUpload, getSong } from '$lib/server/songs';
import { audioDir, recordingsDir } from '$lib/server/files';
import { runInLocale } from '$lib/server/i18n-request';
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
	const s = createSongFromUpload(db, wall, {
		file,
		mime: 'audio/mpeg',
		title: 'T',
		style: 'son',
		sizeBytes: 10
	});
	db.update(songs).set({ status: 'ready' }).where(eq(songs.id, s.id)).run();
	return s;
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
		const lesson = createLesson(db, U1_SALSA, {
			lessonDay: '2026-11-01',
			title: 'L',
			notes: null
		}).lesson;
		const vid = addLessonVideo(db, {
			lessonId: lesson.id,
			file: 'v.mp4',
			mime: 'video/mp4',
			sizeBytes: 5
		});
		expect((await run(actions.deleteVideo, post({ id: String(vid.id) }, u2))).status).toBe(404);
		expect(db.select().from(lessonVideos).all()).toHaveLength(1);
		expect(db.select().from(recordings).all()).toHaveLength(1);
		expect(db.select().from(songs).all()).toHaveLength(1);
	});
});

async function file(dir: string, name: string) {
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, name), 'x');
}
function figureWithRecording(fileName: string) {
	const f = createFigure(db, U1_SALSA, {
		figureName: 'E',
		name: 'B',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!;
	const rec = addRecording(db, {
		figureId: f.figure.id,
		file: fileName,
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: 5,
		note: null
	});
	return { figureId: f.figure.id, rec };
}

describe('deleting through the page', () => {
	it('removes a recording and its file', async () => {
		const { rec } = figureWithRecording('r.mp4');
		await file(recordingsDir(), 'r.mp4');
		expect(await run(actions.deleteRecording, post({ id: String(rec.id) }))).toMatchObject({
			ok: true
		});
		expect(db.select().from(recordings).all()).toHaveLength(0);
		expect(await exists(join(recordingsDir(), 'r.mp4'))).toBe(false);
	});

	it('removes a lesson video and its file', async () => {
		const lesson = createLesson(db, U1_SALSA, {
			lessonDay: '2026-11-01',
			title: 'L',
			notes: null
		}).lesson;
		const vid = addLessonVideo(db, {
			lessonId: lesson.id,
			file: 'v.mp4',
			mime: 'video/mp4',
			sizeBytes: 5
		});
		await file(lessonVideosDir(), 'v.mp4');
		expect(await run(actions.deleteVideo, post({ id: String(vid.id) }))).toMatchObject({
			ok: true
		});
		expect(db.select().from(lessonVideos).all()).toHaveLength(0);
		expect(await exists(join(lessonVideosDir(), 'v.mp4'))).toBe(false);
	});

	it('refuses a recording with a linked section: 409, row and file kept', async () => {
		const { rec, figureId } = figureWithRecording('r.mp4');
		await file(recordingsDir(), 'r.mp4');
		const spot = addSpot(db, { recordingId: rec.id } as never, {
			startMs: 1000,
			endMs: 2000,
			label: 'S'
		})!;
		linkSpot(db, 'u1', spot.id, { figureId });
		const res = await run(actions.deleteRecording, post({ id: String(rec.id) }));
		expect(res.status).toBe(409);
		expect(res.data?.message).toBeTruthy();
		expect(db.select().from(recordings).all()).toHaveLength(1);
		expect(await exists(join(recordingsDir(), 'r.mp4'))).toBe(true);
	});

	it('refuses a lesson video with a linked section: 409, row and file kept', async () => {
		const { figureId } = figureWithRecording('r.mp4');
		const lesson = createLesson(db, U1_SALSA, {
			lessonDay: '2026-11-01',
			title: 'L',
			notes: null
		}).lesson;
		const vid = addLessonVideo(db, {
			lessonId: lesson.id,
			file: 'v.mp4',
			mime: 'video/mp4',
			sizeBytes: 5
		});
		await file(lessonVideosDir(), 'v.mp4');
		const spot = addSpot(db, { lessonVideoId: vid.id } as never, {
			startMs: 1000,
			endMs: 2000,
			label: 'S'
		})!;
		linkSpot(db, 'u1', spot.id, { figureId });
		const res = await run(actions.deleteVideo, post({ id: String(vid.id) }));
		expect(res.status).toBe(409);
		expect(db.select().from(lessonVideos).all()).toHaveLength(1);
		expect(await exists(join(lessonVideosDir(), 'v.mp4'))).toBe(true);
	});

	it('refuses a song a live exercise uses: 409 "Used by", file kept', async () => {
		const s = song(U1_SALSA, 'a.mp3');
		db.insert(exercises)
			.values({
				name: 'Warm up',
				source: 'custom',
				everyDays: 3,
				practiceMode: 'song',
				songId: s.id,
				userId: 'u1'
			} as never)
			.run();
		await file(audioDir(), 'a.mp3');
		const res = await run(actions.deleteSong, post({ id: String(s.id) }));
		expect(res.status).toBe(409);
		expect(res.data?.message).toMatch(/^Used by: Warm up/);
		expect(getSong(db, s.id)).not.toBeNull();
		expect(await exists(join(audioDir(), 'a.mp3'))).toBe(true);
	});

	it('refuses a song the worker is still on', async () => {
		const s = song(U1_SALSA, 'a.mp3');
		db.update(songs).set({ status: 'waiting_analysis' }).run();
		const res = await run(actions.deleteSong, post({ id: String(s.id) }));
		expect(res.status).toBe(409);
		expect(getSong(db, s.id)).not.toBeNull();
	});
});

describe('the storage page in Slovenian', () => {
	const sl = (fn: unknown, fields: Record<string, string>) =>
		runInLocale('sl', () => run(fn, post(fields)));

	it('refuses a song in use or still being prepared, and a gone row, in vikanje', async () => {
		const s = song(U1_SALSA, 'a.mp3');
		db.insert(exercises)
			.values({
				name: 'Warm up',
				source: 'custom',
				everyDays: 3,
				practiceMode: 'song',
				songId: s.id,
				userId: 'u1'
			} as never)
			.run();
		expect((await sl(actions.deleteSong, { id: String(s.id) })).data?.message).toBe(
			'V uporabi: Warm up. Najprej jo odstranite tam.'
		);
		const t = song(U1_SALSA, 'b.mp3');
		db.update(songs).set({ status: 'waiting_analysis' }).where(eq(songs.id, t.id)).run();
		expect((await sl(actions.deleteSong, { id: String(t.id) })).data?.message).toBe(
			'Ta skladba se še pripravlja. Poskusite znova čez nekaj minut.'
		);
		expect((await sl(actions.deleteRecording, { id: '999' })).data?.message).toBe('Tega ni več.');
	});

	it('loads the rows in the reader’s language', async () => {
		song(U1_SALSA, 'a.mp3');
		const data = (await runInLocale('sl', () => run(load, { locals: { user: U1 } }))) as {
			items: { context: string }[];
		};
		expect(data.items[0].context).toBe('Skladba');
	});
});
