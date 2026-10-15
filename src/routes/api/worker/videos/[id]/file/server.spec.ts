/**
 * A saved video's upload, end to end on a temp `$DATA_DIR` and an in-memory db.
 * Both are mocked, never set through `process.env` — see CLAUDE.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
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
import { createFigure, getFigure } from '$lib/server/figures';
import { createLesson, getLesson } from '$lib/server/lessons';
import { addLinks, deleteLink, listLinks } from '$lib/server/links';
import { claimVideoJob, requestVideoDownload } from '$lib/server/video-downloads';
import { PUT } from './+server';

const YT = 'https://youtu.be/dQw4w9WgXcQ';
let db: Db;
let figureId: number;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-saved-'));
	db = openDb(':memory:');
	handle.db = db;
	figureId = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

function queue(owner: { figureId: number } | { lessonId: number }) {
	const link = addLinks(db, owner, [YT], null)![0];
	requestVideoDownload(db, owner, link.id);
	return { linkId: link.id, jobId: claimVideoJob(db, Date.now())!.id };
}

function put(jobId: number, start: number, n: number, total: number) {
	const request = new Request('http://localhost/', {
		method: 'PUT',
		headers: {
			'content-type': 'video/mp4',
			'content-range': `bytes ${start}-${start + n - 1}/${total}`
		},
		body: new Uint8Array(n).fill(7)
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- only the fields PUT reads
	return PUT({ params: { id: String(jobId) }, request } as any);
}

const uploads = () => readdir(join(envMock.DATA_DIR, 'uploads')).catch(() => []);

describe('a saved video arriving in chunks', () => {
	it('resumes, refuses a wrong offset, and becomes a recording on the last chunk', async () => {
		const { jobId } = queue({ figureId });
		const first = await put(jobId, 0, 4, 10);
		expect(first.status).toBe(204);
		expect(first.headers.get('x-received-bytes')).toBe('4');

		const wrong = await put(jobId, 6, 4, 10);
		expect(wrong.status).toBe(409);
		expect(wrong.headers.get('x-received-bytes')).toBe('4');

		const last = await put(jobId, 4, 6, 10);
		expect(last.status).toBe(201);
		const [rec] = getFigure(db, figureId)!.recordings;
		expect(rec).toMatchObject({ kind: 'video', mime: 'video/mp4', sizeBytes: 10, sourceUrl: YT });
		expect(existsSync(join(envMock.DATA_DIR, 'recordings', rec.file))).toBe(true);
		expect(listLinks(db, { figureId })).toEqual([]);
		expect(await uploads()).toEqual([]);
	});

	it('answers 410 when the last 201 was lost and the chunk comes again', async () => {
		const { jobId } = queue({ figureId });
		expect((await put(jobId, 0, 10, 10)).status).toBe(201);
		expect((await put(jobId, 0, 10, 10)).status).toBe(410);
		expect(getFigure(db, figureId)!.recordings).toHaveLength(1);
	});

	it('answers 410 and drops the partial when the link was removed mid-upload', async () => {
		const { linkId, jobId } = queue({ figureId });
		expect((await put(jobId, 0, 4, 10)).status).toBe(204);
		deleteLink(db, { figureId }, linkId);
		expect((await put(jobId, 4, 6, 10)).status).toBe(410);
		expect(await uploads()).toEqual([]);
		expect(getFigure(db, figureId)!.recordings).toEqual([]);
	});

	it('puts a lesson’s video among the lesson videos', async () => {
		const lessonId = createLesson(db, 'salsa', {
			lessonDay: '2026-10-14',
			title: 'Class',
			notes: null
		}).lesson.id;
		const { jobId } = queue({ lessonId });
		expect((await put(jobId, 0, 10, 10)).status).toBe(201);
		const [video] = getLesson(db, lessonId)!.videos;
		expect(video).toMatchObject({ sourceUrl: YT, sizeBytes: 10 });
		expect(existsSync(join(envMock.DATA_DIR, 'lesson-videos', video.file))).toBe(true);
	});
});
