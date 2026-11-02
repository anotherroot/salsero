/**
 * The owner wall on the flat routes — the ones with no dance in the URL, so
 * the person is the only wall there is. Each area task appends its section.
 * Both `$DATA_DIR` and the database are mocked, never set through
 * `process.env` (see CLAUDE.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
import { U1_SALSA } from '$lib/server/test-walls';
import { addRecording, createFigure } from '$lib/server/figures';
import { recordings } from '$lib/server/db/schema';
import { POST as uploadRecording } from './figures/[id]/recordings/+server';
import { GET as getRecording } from '../recordings/[file]/+server';

const U1 = { id: 'u1', email: 'u1@example.com', timezone: 'Europe/Ljubljana', isAdmin: true };
const U2 = { id: 'u2', email: 'u2@example.com', timezone: 'Europe/Ljubljana', isAdmin: false };
const FILE = '00000000-0000-4000-8000-000000000001.mp4';

let db: Db;
let figureId: number;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-owner-'));
	await mkdir(join(envMock.DATA_DIR, 'recordings'), { recursive: true });
	await writeFile(join(envMock.DATA_DIR, 'recordings', FILE), Buffer.alloc(10, 1));
	db = openDb(':memory:');
	handle.db = db;
	figureId = createFigure(db, U1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	addRecording(db, {
		figureId,
		file: FILE,
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: 10,
		note: null
	});
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

const run = (handler: unknown, event: Record<string, unknown>) =>
	(handler as (e: unknown) => Promise<Response>)(event);

async function status(promise: Promise<Response>): Promise<number> {
	try {
		return (await promise).status;
	} catch (thrown) {
		return (thrown as { status: number }).status;
	}
}

const upload = (user: typeof U1) =>
	run(uploadRecording, {
		params: { id: String(figureId) },
		locals: { user },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'video/mp4', 'x-filename': 'a.mp4' },
			body: new Uint8Array(5).fill(3)
		})
	});

const fetchFile = (user: typeof U1 | null) =>
	run(getRecording, {
		params: { file: FILE },
		locals: { user },
		request: new Request('http://localhost/')
	});

describe("recordings stand behind the figure's owner", () => {
	it("an upload to another person's figure is a 404 and writes nothing", async () => {
		expect(await status(upload(U2))).toBe(404);
		expect(db.select().from(recordings).all()).toHaveLength(1);
	});

	it('the owner can upload, and the row is theirs through the figure', async () => {
		expect(await status(upload(U1))).toBe(201);
		expect(db.select().from(recordings).all()).toHaveLength(2);
	});

	it("another person's recording file is a 404; the owner's is served", async () => {
		expect(await status(fetchFile(U2))).toBe(404);
		expect(await status(fetchFile(U1))).toBe(200);
	});
});

import { createCustomExercise } from '$lib/server/exercises';
import { GET as deviceToday } from './device/today/+server';

describe('the device reminder lists only the token owner’s exercises', () => {
	it('is per person', async () => {
		createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 1, notes: null });
		const body = async (user: typeof U1) =>
			(await run(deviceToday, { locals: { user } })).json() as Promise<{
				salsa: { due: string[] };
			}>;
		expect((await body(U1)).salsa.due).toEqual(['Clave']);
		expect((await body(U2)).salsa.due).toEqual([]);
	});
});

import { createSongFromUpload } from '$lib/server/songs';
import { putCountTake } from '$lib/server/countTakes';
import { songs, countTakes } from '$lib/server/db/schema';
import { GET as getAudio } from '../audio/[file]/+server';
import { GET as getCount } from '../count/[file]/+server';
import { POST as uploadSong } from './songs/+server';
import { POST as uploadTake } from './count-takes/+server';

const SONG_FILE = '00000000-0000-4000-8000-0000000000a1.m4a';
const TAKE_FILE = '00000000-0000-4000-8000-0000000000b1.wav';

describe('songs and count takes stand behind their owner on the flat routes', () => {
	beforeEach(async () => {
		await mkdir(join(envMock.DATA_DIR, 'audio'), { recursive: true });
		await mkdir(join(envMock.DATA_DIR, 'count'), { recursive: true });
		await writeFile(join(envMock.DATA_DIR, 'audio', SONG_FILE), Buffer.alloc(10, 1));
		await writeFile(join(envMock.DATA_DIR, 'count', TAKE_FILE), Buffer.alloc(10, 1));
		createSongFromUpload(db, U1_SALSA, {
			file: SONG_FILE,
			mime: 'audio/mp4',
			title: 'S',
			style: 'salsa'
		});
		putCountTake(db, 'u1', {
			pattern: 'salsa',
			bpm: 120,
			phrase: 'a',
			file: TAKE_FILE,
			sampleRate: 44100,
			preRollS: 0.1,
			lengthS: 1,
			durationS: 1.5,
			sizeBytes: 10
		});
	});

	const get = async (handler: unknown, file: string, user: typeof U1) =>
		run(handler, { params: { file }, locals: { user }, request: new Request('http://localhost/') });

	it("another person's song audio is a 404; the owner's is served", async () => {
		expect(await status(get(getAudio, SONG_FILE, U2))).toBe(404);
		expect(await status(get(getAudio, SONG_FILE, U1))).toBe(200);
	});

	it("another person's count take is a 404; the owner's is served", async () => {
		expect(await status(get(getCount, TAKE_FILE, U2))).toBe(404);
		expect(await status(get(getCount, TAKE_FILE, U1))).toBe(200);
	});

	it('a song upload carries the signed-in person and the dance', async () => {
		const res = await run(uploadSong, {
			locals: { user: U2 },
			url: new URL('http://localhost/api/songs?dance=salsa'),
			request: new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'audio/mp4', 'x-filename': 'b.m4a' },
				body: new Uint8Array(5).fill(3)
			})
		});
		expect(res.status).toBe(201);
		const { id } = (await res.json()) as { id: number };
		const row = db
			.select()
			.from(songs)
			.all()
			.find((s) => s.id === id)!;
		expect([row.userId, row.dance]).toEqual(['u2', 'salsa']);
	});

	it("a take upload is the signed-in person's own slot and replaces nobody else's", async () => {
		const res = await run(uploadTake, {
			locals: { user: U2 },
			request: new Request('http://localhost/', {
				method: 'POST',
				headers: {
					'x-pattern': 'salsa',
					'x-bpm': '120',
					'x-phrase': 'a',
					'x-sample-rate': '44100',
					'x-length': '1',
					'x-pre-roll': '0.1',
					'x-duration': '1.5'
				},
				body: new Uint8Array(5).fill(3)
			})
		});
		expect(res.status).toBe(201);
		const rows = db.select().from(countTakes).all();
		expect(rows.map((t) => t.userId).sort()).toEqual(['u1', 'u2']);
		expect(rows.find((t) => t.userId === 'u1')!.file).toBe(TAKE_FILE);
	});
});
