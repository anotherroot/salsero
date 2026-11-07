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
// The disk is what the test says: these specs are about owners and limits, and one
// test lowers it to check the floor.
const disk = vi.hoisted(() => ({ free: 100 * 1024 ** 3 }));
vi.mock('$lib/server/storage', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/storage')>('$lib/server/storage');
	return { ...actual, freeDisk: async () => disk.free };
});

import { openDb, type Db } from '$lib/server/db';
import { U1_SALSA } from '$lib/server/test-walls';
import { addRecording, createFigure } from '$lib/server/figures';
import { recordings } from '$lib/server/db/schema';
import { POST as uploadRecording } from './figures/[id]/recordings/+server';
import { GET as getRecording } from '../recordings/[file]/+server';

const U1 = {
	id: 'u1',
	email: 'u1@example.com',
	timezone: 'Europe/Ljubljana',
	isAdmin: true,
	dance: 'salsa' as const
};
const U2 = { ...U1, id: 'u2', email: 'u2@example.com', isAdmin: false };
/** A bachata account: since the dance split, an account of the other dance. */
const U3 = { ...U1, id: 'u3', email: 'u1@example.com', isAdmin: false, dance: 'bachata' as const };
const FILE = '00000000-0000-4000-8000-000000000001.mp4';

let db: Db;
let figureId: number;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-owner-'));
	disk.free = 100 * 1024 ** 3;
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

const upload = (user: typeof U1 | typeof U3) =>
	run(uploadRecording, {
		params: { id: String(figureId) },
		locals: { user },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'video/mp4', 'x-filename': 'a.mp4' },
			body: new Uint8Array(5).fill(3)
		})
	});

const fetchFile = (user: typeof U1 | typeof U3 | null) =>
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

	// Pins: an account of the other dance, same email, gets the stranger's 404.
	it("a bachata account gets a 404 for a salsa account's recording", async () => {
		expect(await status(fetchFile(U3))).toBe(404);
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

	// Catches: a flat route taking its dance from the request, so a salsa account
	// makes a bachata song (the dance split).
	it("a song upload into another dance than the account's is a 404 and writes nothing", async () => {
		const before = db.select().from(songs).all().length;
		const res = run(uploadSong, {
			locals: { user: U2 },
			url: new URL('http://localhost/api/songs?dance=bachata'),
			request: new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'audio/mp4', 'x-filename': 'b.m4a' },
				body: new Uint8Array(5).fill(3)
			})
		});
		expect(await status(res)).toBe(404);
		expect(db.select().from(songs).all()).toHaveLength(before);
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
		const a = completeVideoJob(
			db,
			first.id,
			{ file: 'a.mp4', mime: 'video/mp4', sizeBytes: 5 },
			disk.free
		)!;
		const b = completeVideoJob(
			db,
			second.id,
			{ file: 'b.mp4', mime: 'video/mp4', sizeBytes: 5 },
			disk.free
		)!;
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

import { eq } from 'drizzle-orm';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { lessons as lessonsTable, videoDownloads } from '$lib/server/db/schema';
import { saveVideoFrom } from '$lib/server/link-form';
import { T1_SALSA } from '$lib/server/test-walls';
import { PUT as putSavedVideo } from './worker/videos/[id]/file/+server';

/**
 * A group's things on the flat routes: u1 owns T1, u3 edits it, u2 is a member
 * and u4 an outsider. P is published, D a draft; each has a video. The group's
 * room is three people's, 600 MB; the editor has no limit of their own, so a
 * refusal can only be the group's.
 */
describe("a group's videos, uploads and room on the flat routes", () => {
	const U3 = { ...U2, id: 'u3', email: 'u3@example.com' };
	const U4 = { ...U2, id: 'u4', email: 'u4@example.com' };
	const P_FILE = '00000000-0000-4000-8000-0000000000d1.mp4';
	const D_FILE = '00000000-0000-4000-8000-0000000000d2.mp4';
	const TEAM_FULL = 'Not enough room: the group uses 600 MB of 600 MB. The owner can ask for more.';
	let P: number;
	let D: number;
	let pVideo: number;
	let dVideo: number;
	let teamFigure: number;

	beforeEach(async () => {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		if (!made.ok || made.teamId !== T1_SALSA.teamId) throw new Error('team 1 expected');
		joinTeam(db, 'u2', 1, 2);
		joinTeam(db, 'u3', 1, 2);
		setRole(db, 1, 'u3', 'editor');
		await mkdir(join(envMock.DATA_DIR, 'lesson-videos'), { recursive: true });
		for (const f of [P_FILE, D_FILE]) {
			await writeFile(join(envMock.DATA_DIR, 'lesson-videos', f), Buffer.alloc(10, 1));
		}
		const lesson = (title: string) =>
			createLesson(db, T1_SALSA, { lessonDay: '2026-11-02', title, notes: null }).lesson.id;
		P = lesson('Published');
		D = lesson('Draft');
		db.update(lessonsTable).set({ publishedAt: 1 }).where(eq(lessonsTable.id, P)).run();
		pVideo = addLessonVideo(
			db,
			{ lessonId: P, file: P_FILE, mime: 'video/mp4', sizeBytes: 10 },
			'u1'
		).id;
		dVideo = addLessonVideo(
			db,
			{ lessonId: D, file: D_FILE, mime: 'video/mp4', sizeBytes: 10 },
			'u1'
		).id;
		teamFigure = createFigure(db, T1_SALSA, {
			figureName: 'Group figure',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
	});

	/** Fill the group's 600 MB to the byte, with a row and no file. */
	function fillTeam() {
		addRecording(
			db,
			{
				figureId: teamFigure,
				file: 'filler.mp4',
				mime: 'video/mp4',
				kind: 'video',
				sizeBytes: 600 * 1024 * 1024 - 20,
				note: null
			},
			'u1'
		);
	}

	const getVideo = (user: typeof U1, file: string) =>
		run(getLessonVideo, {
			params: { file },
			locals: { user },
			request: new Request('http://localhost/')
		});

	const chunk = (user: typeof U1, lessonId: number) =>
		run(putChunk, {
			params: { id: String(lessonId), uploadId: '1f8fad5b-d9cb-469f-a165-70867728950e' },
			locals: { user },
			request: new Request('http://localhost/', {
				method: 'PUT',
				headers: {
					'content-type': 'video/mp4',
					'content-range': 'bytes 0-3/4',
					'x-filename': 'a.mp4'
				},
				body: new Blob([new Uint8Array(4).fill(7)])
			})
		});

	const recordingUpload = (user: typeof U1) =>
		run(uploadRecording, {
			params: { id: String(teamFigure) },
			locals: { user },
			request: new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'video/mp4', 'x-filename': 'a.mp4' },
				body: new Uint8Array(5).fill(3)
			})
		});

	const videosOf = (lessonId: number) =>
		db
			.select()
			.from(lessonVideos)
			.all()
			.filter((v) => v.lessonId === lessonId);

	it("a member gets P's video file, D's is a 404, and an outsider gets neither", async () => {
		expect(await status(getVideo(U2, P_FILE))).toBe(200);
		expect(await status(getVideo(U2, D_FILE))).toBe(404);
		expect(await status(getVideo(U3, D_FILE))).toBe(200);
		expect(await status(getVideo(U4, P_FILE))).toBe(404);
	});

	it("a member lists P's sections but not D's, and changes neither", async () => {
		const list = (user: typeof U1, id: number) =>
			run(listSpotsApi, {
				url: new URL(`http://localhost/api/video-spots?lessonVideo=${id}`),
				locals: { user }
			});
		expect(await status(list(U2, pVideo))).toBe(200);
		expect(await status(list(U2, dVideo))).toBe(404);
		expect(await status(list(U4, pVideo))).toBe(404);

		const add = (user: typeof U1) =>
			run(addSpotApi, {
				request: new Request('http://localhost/', {
					method: 'POST',
					body: JSON.stringify({ lessonVideoId: pVideo, startMs: 5, endMs: 50, label: null })
				}),
				locals: { user }
			});
		expect(await status(add(U2))).toBe(404);
		expect(await status(add(U3))).toBe(201);
		const spotId = db.select().from(videoSpots).all()[0].id;
		const patch = (user: typeof U1) =>
			run(patchSpot, {
				params: { id: String(spotId) },
				locals: { user },
				request: new Request('http://localhost/', {
					method: 'PATCH',
					body: JSON.stringify({ label: 'Mine now', seen: { label: null } })
				})
			});
		expect(await status(patch(U2))).toBe(404);
		expect(await status(patch(U3))).toBe(200);
		// The Link popup lists the group's drafts' things too: editors only (risk 20).
		const options = (user: typeof U1) =>
			run(linkOptionsApi, { params: { id: String(spotId) }, locals: { user } });
		expect(await status(options(U2))).toBe(404);
		expect(await status(options(U3))).toBe(200);

		// Linking a group's section, and making something on it, is the group's editors'.
		const link = (user: typeof U1, body: unknown) =>
			run(linkApi, {
				params: { id: String(spotId) },
				locals: { user },
				request: new Request('http://localhost/', {
					method: 'POST',
					body: JSON.stringify(body)
				})
			});
		expect(await status(link(U2, { target: { figureId: teamFigure } }))).toBe(404);
		expect(await status(link(U3, { target: { figureId: teamFigure } }))).toBe(200);
		expect(
			await status(link(U3, { create: { kind: 'drill', name: 'Group drill', everyDays: 3 } }))
		).toBe(200);
		const made = db
			.select()
			.from(exercisesTable)
			.all()
			.find((e) => e.name === 'Group drill')!;
		expect([made.userId, made.teamId]).toEqual([null, 1]);
		expect(db.select().from(spotLinks).all()).toHaveLength(2);
	});

	it("an editor's chunk into a full group lesson is refused by the group's room", async () => {
		fillTeam();
		const res = await chunk(U3, D);
		expect(res.status).toBe(413);
		expect(((await res.json()) as { message: string }).message).toBe(TEAM_FULL);
		expect(videosOf(D)).toHaveLength(1);
	});

	it("an editor's upload lands in the group lesson and counts against the group", async () => {
		expect(await status(chunk(U3, D))).toBe(201);
		expect(videosOf(D)).toHaveLength(2);
		expect(usedBytes(db, 'u3')).toBe(0);
	});

	it("a member's or an outsider's upload into a group lesson or figure is a 404", async () => {
		for (const user of [U2, U4]) {
			expect(await status(chunk(user, P))).toBe(404);
			expect(await status(recordingUpload(user))).toBe(404);
		}
		expect(videosOf(P)).toHaveLength(1);
		expect(db.select().from(recordings).all()).toHaveLength(1);
	});

	it("a recording into a full group figure is refused by the group's room", async () => {
		fillTeam();
		const before = db.select().from(recordings).all().length;
		expect(await status(recordingUpload(U3))).toBe(413);
		expect(db.select().from(recordings).all()).toHaveLength(before);
	});

	it('the disk floor refuses an upload whatever the limits say', async () => {
		// Two bytes above the floor: the 4-byte video would cross it.
		disk.free = 2 * 1024 ** 3 + 2;
		expect(await status(chunk(U3, D))).toBe(413);
		expect(videosOf(D)).toHaveLength(1);
		// Already under it: a recording, a song and a take, the person's own, are refused too.
		disk.free = 2 * 1024 ** 3 - 1;
		expect(await status(recordingUpload(U3))).toBe(413);
		const song = await status(
			run(uploadSong, {
				locals: { user: U3 },
				url: new URL('http://localhost/api/songs?dance=salsa'),
				request: new Request('http://localhost/', {
					method: 'POST',
					headers: { 'content-type': 'audio/mp4', 'x-filename': 'b.m4a' },
					body: new Uint8Array(5).fill(3)
				})
			})
		);
		expect(song).toBe(413);
		expect(db.select().from(songs).all()).toHaveLength(0);
	});

	it('a YouTube save into a full group lesson is refused when asked and when it lands', async () => {
		const [link] = addLinks(db, { lessonId: D }, ['https://youtu.be/dQw4w9WgXcQ'], null, 'u1')!;
		expect(requestVideoDownload(db, { lessonId: D }, link.id)).toBe('ok');
		fillTeam();

		const form = new Request('http://localhost/', {
			method: 'POST',
			body: new URLSearchParams({ linkId: String(link.id) })
		});
		expect(await saveVideoFrom(form, db, { lessonId: D }, disk.free)).toMatchObject({
			status: 413,
			data: { message: TEAM_FULL }
		});

		const job = claimVideoJob(db, Date.now())!;
		const res = await (putSavedVideo as unknown as (e: unknown) => Promise<Response>)({
			params: { id: String(job.id) },
			request: new Request('http://localhost/', {
				method: 'PUT',
				headers: { 'content-type': 'video/mp4', 'content-range': 'bytes 0-3/4' },
				body: new Uint8Array(4).fill(7)
			})
		});
		expect(res.status).toBe(413);
		const failed = db.select().from(videoDownloads).where(eq(videoDownloads.id, job.id)).get()!;
		expect([failed.status, failed.error]).toEqual(['failed', TEAM_FULL]);
		expect(videosOf(D)).toHaveLength(1);
		expect(await readdir(join(envMock.DATA_DIR, 'lesson-videos'))).toHaveLength(2);
	});
});

import { readdir } from 'node:fs/promises';
import { usedBytes } from '$lib/server/storage';
import { lessonComments, users } from '$lib/server/db/schema';
import { publishLesson } from '$lib/server/lessons';
import { postComment } from '$lib/server/comments';
import { GET as getComments, POST as postCommentApi } from './lessons/[id]/comments/+server';
import { DELETE as deleteCommentApi } from './comments/[id]/+server';
import { POST as heartApi } from './comments/[id]/heart/+server';
import { POST as restoreApi } from './comments/[id]/restore/+server';

describe("comments stand behind the lesson's group", () => {
	let lessonId: number;
	let commentId: number;

	beforeEach(() => {
		for (const id of ['u1', 'u2']) {
			db.insert(users)
				.values({ id, email: `${id}@example.com`, passwordHash: 'x' })
				.onConflictDoNothing()
				.run();
		}
		// u1 owns a group; u2 is not in it.
		createTeam(db, 'u1', 'salsa', 'Class', 1);
		lessonId = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'C', notes: null })
			.lesson.id;
		publishLesson(db, T1_SALSA, lessonId, 5);
		commentId = (postComment(db, 'u1', lessonId, 'hello', null, 10) as { id: number }).id;
	});

	const call = (handler: unknown, id: number, user: typeof U1, body?: unknown) =>
		run(handler, {
			params: { id: String(id) },
			locals: { user },
			request: new Request('http://localhost/', {
				method: 'POST',
				body: body === undefined ? undefined : JSON.stringify(body)
			})
		});

	it("reading another group's lesson comments is a 404; the owner reads them", async () => {
		expect(await status(call(getComments, lessonId, U2))).toBe(404);
		expect(await status(call(getComments, lessonId, U1))).toBe(200);
	});

	it('posting is a 404 and writes nothing for a stranger', async () => {
		expect(await status(call(postCommentApi, lessonId, U2, { body: 'hi' }))).toBe(404);
		expect(await status(call(postCommentApi, 9999, U1, { body: 'hi' }))).toBe(404);
		expect(await status(call(postCommentApi, lessonId, U1, { body: ' ' }))).toBe(400);
		expect(await status(call(postCommentApi, lessonId, U1, { body: 'hi' }))).toBe(201);
	});

	it('hearting, deleting and restoring are a 404 for a stranger and change nothing', async () => {
		// u2's own comment, deleted by the owner: only the wall keeps u2 from delete/restore
		// (as an author u2 could delete it, and restore it were u2 inside the group).
		const theirs = { id: 'u2' };
		db.update(lessonComments)
			.set({ authorId: theirs.id })
			.where(eq(lessonComments.id, commentId))
			.run();
		expect(await status(call(heartApi, commentId, U2))).toBe(404);
		expect(await status(call(deleteCommentApi, commentId, U2))).toBe(404);
		expect(db.select().from(lessonComments).get()!.deletedAt).toBeNull();
		db.update(lessonComments).set({ deletedAt: 20, deletedBy: 'u2' }).run();
		expect(await status(call(restoreApi, commentId, U2))).toBe(404);
		expect(db.select().from(lessonComments).get()!.deletedAt).toBe(20);
		db.update(lessonComments).set({ deletedAt: null, deletedBy: null }).run();
		expect(await status(call(heartApi, 9999, U1))).toBe(404);
		expect(await status(call(heartApi, commentId, U1))).toBe(200);
		expect(await status(call(deleteCommentApi, commentId, U1))).toBe(200);
		expect(await status(call(restoreApi, commentId, U1))).toBe(200);
	});
});
