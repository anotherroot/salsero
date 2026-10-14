/**
 * The chunk endpoint, end to end on a temp `$DATA_DIR` and an in-memory db.
 * Both are mocked, never set through `process.env` — see CLAUDE.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
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
import { createLesson, getLesson } from '$lib/server/lessons';
import { PUT } from './+server';

const UPLOAD = '0f8fad5b-d9cb-469f-a165-70867728950e';
let db: Db;
let lessonId: number;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-chunks-'));
	db = openDb(':memory:');
	handle.db = db;
	lessonId = createLesson(db, 'salsa', {
		lessonDay: '2026-10-14',
		title: 'Wednesday class',
		notes: null
	}).lesson.id;
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

function put(start: number, bytes: Uint8Array, total: number) {
	const request = new Request('http://localhost/', {
		method: 'PUT',
		headers: {
			'content-type': 'video/mp4',
			'content-range': `bytes ${start}-${start + bytes.length - 1}/${total}`,
			'x-filename': 'class.mp4'
		},
		body: bytes,
		// @ts-expect-error -- Node's fetch needs this for a streamed body
		duplex: 'half'
	});
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- only the fields PUT reads
	return PUT({ params: { id: String(lessonId), uploadId: UPLOAD }, request } as any);
}

describe('a finished upload asked about again', () => {
	it('answers with the same row, not a second video', async () => {
		const bytes = new Uint8Array(10).fill(7);
		const first = await put(0, bytes, 10);
		expect(first.status).toBe(201);
		const row = await first.json();

		// The 201 was lost on the way; the client starts over from the top.
		const again = await put(0, bytes.slice(0, 4), 10);
		expect(again.status).toBe(201);
		expect((await again.json()).id).toBe(row.id);
		expect(getLesson(db, lessonId)!.videos).toHaveLength(1);
	});
});
