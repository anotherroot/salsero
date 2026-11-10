import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { deviceSlots, recordings, users } from './db/schema';
import { createFigure } from './figures';
import { createLesson } from './lessons';
import { createTeam } from './teams';
import { usedBytes } from './storage';
import { T1_SALSA, U1_SALSA } from './test-walls';
import type { Space } from './scope';
import { addPhoneLessonVideo, addPhoneRecording, readPhoneVideo } from './phone-videos';

const FILE = '0a1b2c3d-0000-4000-8000-000000000001.mp4';
let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([{ id: 'u1', email: 'u1@x.si', passwordHash: 'x', dance: 'salsa' }])
		.run();
	createTeam(db, 'u1', 'salsa', 'G', 1);
	db.insert(deviceSlots).values({ slot: 3, deviceKey: 'k3', userId: 'u1', createdAt: 1 }).run();
});

const figure = (space: Space = U1_SALSA) =>
	createFigure(db, space, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;

describe('readPhoneVideo: what a phone-only add sends', () => {
	it('takes a uuid file, a mime and a size', () => {
		expect(readPhoneVideo({ file: FILE, mime: 'video/mp4', sizeBytes: 5, slot: 3 })).toEqual({
			file: FILE,
			mime: 'video/mp4',
			sizeBytes: 5,
			kind: 'video',
			note: null,
			slot: 3
		});
	});

	it.each([
		[{ file: 'x.mp4', mime: 'video/mp4', sizeBytes: 5 }, 'badFile'],
		[{ file: FILE, mime: 'video/mp4', sizeBytes: 0 }, 'badSize'],
		[{ file: FILE, mime: 'video/mp4', sizeBytes: 2 * 1024 ** 3 }, 'tooBig'],
		[{ file: FILE, mime: 'text/plain', sizeBytes: 5 }, 'notVideo'],
		[null, 'badFile']
	])('refuses %j (%s)', (body, why) => {
		expect(readPhoneVideo(body)).toEqual({ refused: why });
	});
});

describe('a phone-only recording on the person’s own figure (offline phase 4c)', () => {
	it('is made with no server copy, its original’s size, counted nowhere', () => {
		const id = figure();
		const rec = addPhoneRecording(db, 'u1', id, {
			file: FILE,
			mime: 'video/mp4',
			sizeBytes: 500,
			kind: 'video',
			note: null,
			slot: 3
		});
		expect(rec).toMatchObject({ serverCopy: false, sizeBytes: 500, originBytes: 500 });
		// Made on the server (slot 0 ids): the device's own claim names the holder.
		expect(rec && 'id' in rec ? rec.originSlot : null).toBe(3);
		expect(usedBytes(db, 'u1')).toBe(0);
	});

	it('a slot that is no device’s: no holder named', () => {
		const rec = addPhoneRecording(db, 'u1', figure(), {
			file: FILE,
			mime: 'video/mp4',
			sizeBytes: 5,
			kind: 'video',
			note: null,
			slot: 99
		});
		expect(rec && 'id' in rec ? rec.originSlot : 'x').toBeNull();
	});

	it("a group's figure: refused, a group's videos always upload", () => {
		expect(
			addPhoneRecording(db, 'u1', figure(T1_SALSA), {
				file: FILE,
				mime: 'video/mp4',
				sizeBytes: 5,
				kind: 'video',
				note: null
			})
		).toBeNull();
		expect(db.select().from(recordings).where(eq(recordings.file, FILE)).all()).toEqual([]);
	});
});

describe('a phone-only video on the person’s own lesson', () => {
	it('is made with no server copy', () => {
		const lesson = createLesson(db, U1_SALSA, {
			title: 'L',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		const v = addPhoneLessonVideo(db, 'u1', lesson.id, {
			file: FILE,
			mime: 'video/mp4',
			sizeBytes: 700,
			kind: 'video',
			note: null,
			slot: 3
		});
		expect(v).toMatchObject({ serverCopy: false, originBytes: 700, originSlot: 3 });
	});

	it("a group's lesson: refused", () => {
		const lesson = createLesson(db, T1_SALSA, {
			title: 'L',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		expect(
			addPhoneLessonVideo(db, 'u1', lesson.id, {
				file: FILE,
				mime: 'video/mp4',
				sizeBytes: 5,
				kind: 'video',
				note: null
			})
		).toBeNull();
	});
});
