import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { storageRequests, users } from './db/schema';
import { addRecording, archiveVariation, createFigure } from './figures';
import { addLessonVideo, createLesson } from './lessons';
import { createSongFromUpload } from './songs';
import { putCountTake } from './countTakes';
import { U1_SALSA, U2_SALSA } from './test-walls';
import {
	askForMore,
	listStorageItems,
	openRequest,
	roomFor,
	storageOf,
	usedBytes
} from './storage';

const MB = 1024 * 1024;
let db: Db;

function user(id: string, limit: number | null) {
	db.insert(users)
		.values({ id, email: `${id}@example.com`, passwordHash: 'x', storageLimitBytes: limit })
		.run();
}

function recording(wall: typeof U1_SALSA, name: string, bytes: number) {
	const f = createFigure(db, wall, {
		figureName: name,
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!;
	addRecording(db, {
		figureId: f.figure.id,
		file: `${name}.mp4`,
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: bytes,
		note: null
	});
	return f.figure.id;
}

function take(userId: string, bpm: number, bytes: number, file: string) {
	putCountTake(db, userId, {
		pattern: 'salsa-on1' as never,
		bpm,
		phrase: 'a',
		file,
		sampleRate: 44100,
		preRollS: 0,
		lengthS: 1,
		durationS: 1,
		sizeBytes: bytes
	});
}

beforeEach(() => {
	db = openDb(':memory:');
	user('u1', 1024 * MB);
	user('u2', null);
});

describe('usedBytes', () => {
	it('sums recordings, lesson videos, songs and count takes for one person only', () => {
		recording(U1_SALSA, 'A', 1 * MB);
		const lesson = createLesson(db, U1_SALSA, {
			title: 'L',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		addLessonVideo(db, {
			lessonId: lesson.id,
			file: 'v.mp4',
			mime: 'video/mp4',
			sizeBytes: 2 * MB
		});
		createSongFromUpload(db, U1_SALSA, {
			file: 's.mp3',
			mime: 'audio/mpeg',
			title: 't',
			style: 'son',
			sizeBytes: 4 * MB
		});
		take('u1', 100, 8 * MB, 't.wav');
		recording(U2_SALSA, 'B', 100 * MB);
		expect(usedBytes(db, 'u1')).toBe(15 * MB);
		expect(usedBytes(db, 'u2')).toBe(100 * MB);
	});

	it('counts a recording whose figure is archived', () => {
		const id = recording(U1_SALSA, 'A', 3 * MB);
		archiveVariation(db, id, 1);
		expect(usedBytes(db, 'u1')).toBe(3 * MB);
	});

	it('counts a song with no recorded size as zero', () => {
		createSongFromUpload(db, U1_SALSA, {
			file: 's.mp3',
			mime: 'audio/mpeg',
			title: 't',
			style: 'son'
		});
		expect(usedBytes(db, 'u1')).toBe(0);
	});
});

describe('roomFor', () => {
	it('is always ok with no limit', () => {
		recording(U2_SALSA, 'B', 5000 * MB);
		expect(roomFor(db, 'u2', 10 ** 12)).toEqual({ ok: true });
		expect(storageOf(db, 'u2')).toEqual({ usedBytes: 5000 * MB, limitBytes: null });
	});

	it('refuses an upload that crosses the limit, with the message', () => {
		recording(U1_SALSA, 'A', 900 * MB);
		const r = roomFor(db, 'u1', 200 * MB);
		expect(r).toEqual({
			ok: false,
			usedBytes: 900 * MB,
			limitBytes: 1024 * MB,
			message:
				'Not enough room: you use 900 MB of 1.0 GB. Free some space or ask for more in Settings.'
		});
		expect(roomFor(db, 'u1', 100 * MB)).toEqual({ ok: true });
	});

	it('refuses even a zero-byte ask when already over', () => {
		recording(U1_SALSA, 'A', 1100 * MB);
		expect(roomFor(db, 'u1', 0).ok).toBe(false);
	});
});

describe('listStorageItems', () => {
	it('lists the person’s files biggest first, attributed, with archived marked', () => {
		const figId = recording(U1_SALSA, 'Enchufla', 3 * MB);
		recording(U2_SALSA, 'Other', 99 * MB);
		archiveVariation(db, figId, 1);
		const lesson = createLesson(db, U1_SALSA, {
			title: '15 salsa cubana moves',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		addLessonVideo(db, {
			lessonId: lesson.id,
			file: 'v.mp4',
			mime: 'video/mp4',
			sizeBytes: 9 * MB
		});
		createSongFromUpload(db, U1_SALSA, {
			file: 's.mp3',
			mime: 'audio/mpeg',
			title: 'Song A',
			style: 'son',
			sizeBytes: 5 * MB
		});
		take('u1', 100, 1 * MB, 't.wav');
		take('u1', 110, 1 * MB, 't2.wav');
		const items = listStorageItems(db, 'u1');
		expect(items.map((i) => [i.kind, i.sizeBytes])).toEqual([
			['lessonVideo', 9 * MB],
			['song', 5 * MB],
			['recording', 3 * MB],
			['voice', 2 * MB]
		]);
		expect(items[0]).toMatchObject({
			title: 'Lesson video',
			context: 'Lesson · 15 salsa cubana moves'
		});
		expect(items[2]).toMatchObject({ context: 'Enchufla · Basic', archived: true });
		expect(items[3]).toMatchObject({ id: null, href: '/voice', archived: false });
		expect(items[0].href).toBe(`/salsa/lessons/${lesson.id}`);
	});

	it('has no voice row without takes', () => {
		expect(listStorageItems(db, 'u1')).toEqual([]);
	});
});

describe('askForMore', () => {
	it('opens one request per person; a second ask says so', () => {
		expect(askForMore(db, 'u1', ' more please ', 1000)).toBe('asked');
		expect(openRequest(db, 'u1')).toEqual({ createdAt: 1000, note: 'more please' });
		expect(askForMore(db, 'u1', null, 2000)).toBe('already-open');
		expect(openRequest(db, 'u2')).toBeNull();
		expect(askForMore(db, 'u2', '  ', 3000)).toBe('asked');
		expect(openRequest(db, 'u2')).toEqual({ createdAt: 3000, note: null });
	});

	it('a resolved request does not block a new one', () => {
		askForMore(db, 'u1', null, 1000);
		db.update(storageRequests).set({ resolvedAt: 1500, outcome: 'declined' }).run();
		expect(openRequest(db, 'u1')).toBeNull();
		expect(askForMore(db, 'u1', null, 2000)).toBe('asked');
	});
});
