/**
 * Upload later, Remove server copy and the chunked new recording (offline
 * phase 4c), end to end on a temp `$DATA_DIR` and an in-memory db, both mocked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, stat, writeFile, mkdir } from 'node:fs/promises';
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
import { deviceSlots, recordings, users } from '$lib/server/db/schema';
import { addRecording, createFigure } from '$lib/server/figures';
import { createLesson } from '$lib/server/lessons';
import { addPhoneLessonVideo, addPhoneRecording } from '$lib/server/phone-videos';
import { usedBytes } from '$lib/server/storage';
import { U1_SALSA } from '$lib/server/test-walls';
import { PUT as recFile } from './+server';
import { PUT as videoFile } from '../../../../lesson-videos/[id]/file/[uploadId]/+server';
import { DELETE as recCopy } from '../../server-copy/+server';
import { PUT as newRec } from '../../../../figures/[id]/recordings/[uploadId]/+server';
import { POST as oldRec } from '../../../../figures/[id]/recordings/+server';

const UPLOAD = '0f8fad5b-d9cb-469f-a165-70867728950e';
const FILE = '0a1b2c3d-0000-4000-8000-000000000001.mp4';
const USER = { id: 'u1' };
let db: Db;
let figureId: number;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-4c-'));
	db = openDb(':memory:');
	handle.db = db;
	db.insert(users)
		.values({
			id: 'u1',
			email: 'u1@x.si',
			passwordHash: 'x',
			dance: 'salsa',
			storageLimitBytes: 1000
		})
		.run();
	db.insert(deviceSlots).values({ slot: 3, deviceKey: 'k3', userId: 'u1', createdAt: 1 }).run();
	figureId = createFigure(db, U1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

const phoneRec = () =>
	addPhoneRecording(db, 'u1', figureId, {
		file: FILE,
		mime: 'video/mp4',
		sizeBytes: 900,
		kind: 'video',
		note: null,
		slot: 3
	})!.id;
const recRow = (id: number) => db.select().from(recordings).where(eq(recordings.id, id)).get()!;

type Handler = (e: unknown) => Promise<Response>;
function chunk(h: unknown, params: object, start: number, bytes: number, total: number) {
	const request = new Request('http://localhost/', {
		method: 'PUT',
		headers: {
			'content-type': 'video/mp4',
			'content-range': `bytes ${start}-${start + bytes - 1}/${total}`
		},
		body: new Blob([new Uint8Array(bytes).fill(7)])
	});
	return (h as Handler)({ params, request, locals: { user: USER } });
}
async function del(id: number, slot: number) {
	const request = new Request('http://localhost/', {
		method: 'DELETE',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ slot })
	});
	try {
		return (
			await (recCopy as Handler)({ params: { id: String(id) }, request, locals: { user: USER } })
		).status;
	} catch (e) {
		return (e as { status: number }).status;
	}
}

describe('Upload later: a phone-only recording gets its server copy', () => {
	it('the last chunk attaches it: server copy, its size counted, the original’s kept', async () => {
		const id = phoneRec();
		const p = { id: String(id), uploadId: UPLOAD };
		expect((await chunk(recFile, p, 0, 40, 80)).status).toBe(204);
		const res = await chunk(recFile, p, 40, 40, 80);
		expect(res.status).toBe(201);
		expect(recRow(id)).toMatchObject({ serverCopy: true, sizeBytes: 80, originBytes: 900 });
		expect((await stat(join(envMock.DATA_DIR, 'recordings', FILE))).size).toBe(80);
		expect(usedBytes(db, 'u1')).toBe(80);
	});

	it('cut off: the row stays phone-only, nothing counted', async () => {
		const id = phoneRec();
		await chunk(recFile, { id: String(id), uploadId: UPLOAD }, 0, 40, 80);
		expect(recRow(id)).toMatchObject({ serverCopy: false, sizeBytes: 900 });
		expect(usedBytes(db, 'u1')).toBe(0);
	});

	it('no room: refused, the row unchanged', async () => {
		const id = phoneRec();
		const res = await chunk(recFile, { id: String(id), uploadId: UPLOAD }, 0, 10, 5000);
		expect(res.status).toBe(413);
		expect(recRow(id).serverCopy).toBe(false);
	});

	it('over 1 GiB: refused before writing', async () => {
		db.update(users).set({ storageLimitBytes: null }).run();
		const id = phoneRec();
		const res = await chunk(recFile, { id: String(id), uploadId: UPLOAD }, 0, 10, 2 * 1024 ** 3);
		expect(res.status).toBe(413);
	});

	it('a recording already on the server: 404', async () => {
		const id = addRecording(db, {
			figureId,
			file: 'x.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 5,
			note: null
		}).id;
		const res = await chunk(recFile, { id: String(id), uploadId: UPLOAD }, 0, 10, 10).catch(
			(e: { status: number }) => ({ status: e.status })
		);
		expect(res.status).toBe(404);
	});

	it('a lesson video too', async () => {
		const lesson = createLesson(db, U1_SALSA, {
			title: 'L',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		const v = addPhoneLessonVideo(db, 'u1', lesson.id, {
			file: FILE,
			mime: 'video/mp4',
			sizeBytes: 900,
			kind: 'video',
			note: null
		})!;
		const res = await chunk(videoFile, { id: String(v.id), uploadId: UPLOAD }, 0, 30, 30);
		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ serverCopy: true, sizeBytes: 30 });
	});
});

describe('Remove server copy', () => {
	async function uploaded() {
		const id = phoneRec();
		await chunk(recFile, { id: String(id), uploadId: UPLOAD }, 0, 50, 50);
		return id;
	}

	it('from the holder: the file goes, the row is phone-only again', async () => {
		const id = await uploaded();
		expect(await del(id, 3)).toBe(200);
		expect(recRow(id)).toMatchObject({ serverCopy: false, sizeBytes: 900 });
		await expect(stat(join(envMock.DATA_DIR, 'recordings', FILE))).rejects.toThrow();
	});

	it('from another device: 403, nothing changes', async () => {
		db.insert(deviceSlots).values({ slot: 4, deviceKey: 'k4', userId: 'u1', createdAt: 1 }).run();
		const id = await uploaded();
		expect(await del(id, 4)).toBe(403);
		expect(recRow(id).serverCopy).toBe(true);
	});

	it('a slot that is not this person’s: 400', async () => {
		const id = await uploaded();
		expect(await del(id, 77)).toBe(400);
	});

	it('no server copy: 409', async () => {
		expect(await del(phoneRec(), 3)).toBe(409);
	});
});

describe('a new recording, chunked (and the old single POST still works)', () => {
	it('the last chunk makes the row, with a server copy', async () => {
		const p = { id: String(figureId), uploadId: UPLOAD };
		expect((await chunk(newRec, p, 0, 20, 40)).status).toBe(204);
		const res = await chunk(newRec, p, 20, 20, 40);
		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({
			figureId,
			serverCopy: true,
			sizeBytes: 40,
			kind: 'video'
		});
	});

	it('the single POST', async () => {
		await mkdir(join(envMock.DATA_DIR, 'recordings'), { recursive: true });
		await writeFile(join(envMock.DATA_DIR, 'x'), '');
		const request = new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'video/mp4', 'content-length': '12' },
			body: new Blob([new Uint8Array(12)])
		});
		const res = await (oldRec as Handler)({
			params: { id: String(figureId) },
			request,
			locals: { user: { id: 'u1', email: 'u1@x.si', timezone: 'UTC', isAdmin: false } }
		});
		expect(res.status).toBe(201);
	});
});
