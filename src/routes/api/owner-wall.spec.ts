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

/** Async, so a handler that throws synchronously (a 404) still arrives as a rejection. */
const run = async (handler: unknown, event: Record<string, unknown>) =>
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

import { createLesson, addLessonVideo, getLesson } from '$lib/server/lessons';
import { addSpot } from '$lib/server/spots';
import { addLinks } from '$lib/server/links';
import { completeVideoJob, claimVideoJob, requestVideoDownload } from '$lib/server/video-downloads';
import {
	lessonVideos,
	spotLinks,
	videoSpots,
	exercises as exercisesTable
} from '$lib/server/db/schema';
import { GET as listSpotsApi, POST as addSpotApi } from './video-spots/+server';
import { PATCH as patchSpot, DELETE as deleteSpotApi } from './video-spots/[id]/+server';
import { GET as linkOptionsApi, POST as linkApi } from './video-spots/[id]/links/+server';
import { DELETE as unlinkApi } from './video-spots/[id]/links/[linkId]/+server';
import { PUT as putChunk } from './lessons/[id]/videos/[uploadId]/+server';
import { GET as getLessonVideo } from '../lesson-videos/[file]/+server';
import { U2_SALSA } from '$lib/server/test-walls';

const LESSON_FILE = '00000000-0000-4000-8000-0000000000c1.mp4';

describe('lessons, videos, spots and links stand behind their owner on the flat routes', () => {
	let lessonId: number;
	let lessonVideoId: number;
	let sectionId: number;
	let recSectionId: number;
	let recordingId: number;

	beforeEach(async () => {
		await mkdir(join(envMock.DATA_DIR, 'lesson-videos'), { recursive: true });
		await writeFile(join(envMock.DATA_DIR, 'lesson-videos', LESSON_FILE), Buffer.alloc(10, 1));
		lessonId = createLesson(db, U1_SALSA, {
			lessonDay: '2026-10-14',
			title: 'Wednesday',
			notes: null
		}).lesson.id;
		lessonVideoId = addLessonVideo(db, {
			lessonId,
			file: LESSON_FILE,
			mime: 'video/mp4',
			sizeBytes: 10
		}).id;
		sectionId = addSpot(db, { lessonVideoId }, { startMs: 0, endMs: 1000, label: 'Intro' })!.id;
		recordingId = db.select().from(recordings).all()[0].id;
		recSectionId = addSpot(db, { recordingId }, { startMs: 0, endMs: 500, label: 'Turn' })!.id;
	});

	const json = (body: unknown) =>
		new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		});
	const spotsOf = () => db.select().from(videoSpots).all();
	const linksOf = () => db.select().from(spotLinks).all();

	it("another person's lesson video file is a 404; the owner's is served", async () => {
		const get = (user: typeof U1) =>
			run(getLessonVideo, {
				params: { file: LESSON_FILE },
				locals: { user },
				request: new Request('http://localhost/')
			});
		expect(await status(get(U2))).toBe(404);
		expect(await status(get(U1))).toBe(200);
	});

	it("a chunk for another person's lesson is a 404 and adds no video", async () => {
		const bytes = new Uint8Array(4).fill(7);
		const put = (user: typeof U1) =>
			run(putChunk, {
				params: { id: String(lessonId), uploadId: '0f8fad5b-d9cb-469f-a165-70867728950e' },
				locals: { user },
				request: new Request('http://localhost/', {
					method: 'PUT',
					headers: {
						'content-type': 'video/mp4',
						'content-range': 'bytes 0-3/4',
						'x-filename': 'a.mp4'
					},
					body: new Blob([bytes])
				})
			});
		expect(await status(put(U2))).toBe(404);
		expect(getLesson(db, lessonId, 'u1')!.videos).toHaveLength(1);
		expect(await status(put(U1))).toBe(201);
		expect(getLesson(db, lessonId, 'u1')!.videos).toHaveLength(2);
	});

	it("another person's video has no spots to list or add to", async () => {
		const list = (user: typeof U1, q: string) =>
			run(listSpotsApi, {
				url: new URL(`http://localhost/api/video-spots?${q}`),
				locals: { user }
			});
		expect(await status(list(U2, `lessonVideo=${lessonVideoId}`))).toBe(404);
		expect(await status(list(U2, `recording=${recordingId}`))).toBe(404);
		expect(await status(list(U1, `lessonVideo=${lessonVideoId}`))).toBe(200);

		const add = (user: typeof U1, body: Record<string, unknown>) =>
			run(addSpotApi, { request: json({ startMs: 5, endMs: null, ...body }), locals: { user } });
		expect(await status(add(U2, { lessonVideoId }))).toBe(404);
		expect(await status(add(U2, { recordingId }))).toBe(404);
		expect(spotsOf()).toHaveLength(2);
	});

	it("another person's spot cannot be changed or deleted", async () => {
		const patch = (user: typeof U1) =>
			run(patchSpot, {
				params: { id: String(sectionId) },
				locals: { user },
				request: new Request('http://localhost/', {
					method: 'PATCH',
					body: JSON.stringify({ label: 'Mine now' })
				})
			});
		expect(await status(patch(U2))).toBe(404);
		expect(
			await status(
				run(deleteSpotApi, { params: { id: String(recSectionId) }, locals: { user: U2 } })
			)
		).toBe(404);
		expect(
			spotsOf()
				.map((s) => s.label)
				.sort()
		).toEqual(['Intro', 'Turn']);
		expect(await status(patch(U1))).toBe(200);
	});

	it("another person's section has no Link popup and cannot be linked", async () => {
		const own = createFigure(db, U2_SALSA, { ...figureInputU2 })!.figure.id;
		const options = (user: typeof U1) =>
			run(linkOptionsApi, { params: { id: String(sectionId) }, locals: { user } });
		expect(await status(options(U2))).toBe(404);

		const link = (user: typeof U1, body: unknown) =>
			run(linkApi, { params: { id: String(sectionId) }, locals: { user }, request: json(body) });
		// u2 linking u1's section to u2's own figure, or creating something on it.
		expect(await status(link(U2, { target: { figureId: own } }))).toBe(404);
		expect(
			await status(link(U2, { create: { kind: 'drill', name: 'Sneaky', everyDays: 3 } }))
		).toBe(404);
		expect(linksOf()).toHaveLength(0);
		expect(
			db
				.select()
				.from(exercisesTable)
				.all()
				.some((e) => e.name === 'Sneaky')
		).toBe(false);
	});

	it("the owner's section refuses a target outside its wall", async () => {
		const theirs = createFigure(db, U2_SALSA, { ...figureInputU2 })!.figure.id;
		const theirDrill = createCustomExercise(db, U2_SALSA, {
			name: 'Their drill',
			everyDays: 3,
			notes: null
		}).id;
		const link = (body: unknown) =>
			run(linkApi, {
				params: { id: String(sectionId) },
				locals: { user: U1 },
				request: json(body)
			});
		expect(await status(link({ target: { figureId: theirs } }))).toBe(400);
		expect(await status(link({ target: { exerciseId: theirDrill } }))).toBe(400);
		expect(linksOf()).toHaveLength(0);
		// The owner's own figure links.
		expect(await status(link({ target: { figureId } }))).toBe(200);
		expect(linksOf()).toHaveLength(1);
	});

	it('create-and-link makes rows owned by the section owner', async () => {
		const create = (c: unknown) =>
			run(linkApi, {
				params: { id: String(sectionId) },
				locals: { user: U1 },
				request: json({ create: c })
			});
		expect(await status(create({ kind: 'drill', name: 'Shines', everyDays: 3 }))).toBe(200);
		expect(
			await status(
				create({
					kind: 'figure',
					figureName: 'Setenta',
					name: 'Basic',
					partner: 'partner',
					style: 'salsa'
				})
			)
		).toBe(200);
		const drill = db
			.select()
			.from(exercisesTable)
			.all()
			.find((e) => e.name === 'Shines')!;
		expect([drill.userId, drill.dance]).toEqual(['u1', 'salsa']);
		const made = db
			.select()
			.from(figureGroups)
			.all()
			.find((g) => g.name === 'Setenta')!;
		expect(made.userId).toBe('u1');
	});

	it("another person's section link cannot be unlinked", async () => {
		db.insert(spotLinks).values({ spotId: sectionId, figureId }).run();
		const linkId = linksOf()[0].id;
		const unlink = (user: typeof U1) =>
			run(unlinkApi, {
				params: { id: String(sectionId), linkId: String(linkId) },
				url: new URL('http://localhost/?alsoLesson=1'),
				locals: { user }
			});
		expect(await status(unlink(U2))).toBe(404);
		expect(linksOf()).toHaveLength(1);
		expect(await status(unlink(U1))).toBe(200);
		expect(linksOf()).toHaveLength(0);
	});

	it("a saved YouTube video lands on the link's owner's lesson and figure", async () => {
		const [lessonLink] = addLinks(db, { lessonId }, ['https://youtu.be/dQw4w9WgXcQ'], null)!;
		const [figureLink] = addLinks(db, { figureId }, ['https://youtu.be/aaaaaaaaaaa'], null)!;
		expect(requestVideoDownload(db, { lessonId }, lessonLink.id)).toBe('ok');
		expect(requestVideoDownload(db, { figureId }, figureLink.id)).toBe('ok');
		// u2 cannot queue u1's link from a page of their own.
		const theirs = createFigure(db, U2_SALSA, { ...figureInputU2 })!.figure.id;
		expect(requestVideoDownload(db, { figureId: theirs }, figureLink.id)).toBe('not-found');

		const first = claimVideoJob(db, 1)!;
		const second = claimVideoJob(db, 2)!;
		const a = completeVideoJob(db, first.id, { file: 'a.mp4', mime: 'video/mp4', sizeBytes: 5 })!;
		const b = completeVideoJob(db, second.id, { file: 'b.mp4', mime: 'video/mp4', sizeBytes: 5 })!;
		const landed = [a, b];
		const video = landed.find((o) => 'lessonVideoId' in o) as { lessonVideoId: number };
		const rec = landed.find((o) => 'recordingId' in o) as { recordingId: number };
		const lv = db
			.select()
			.from(lessonVideos)
			.all()
			.find((v) => v.id === video.lessonVideoId)!;
		expect(getLesson(db, lv.lessonId, 'u1')!.lesson.userId).toBe('u1');
		const r = db
			.select()
			.from(recordings)
			.all()
			.find((x) => x.id === rec.recordingId)!;
		expect(r.figureId).toBe(figureId);
	});
});

const figureInputU2 = {
	figureName: 'Theirs',
	name: 'Basic',
	partner: 'partner' as const,
	style: 'salsa',
	notes: null
};

import { figureGroups } from '$lib/server/db/schema';
