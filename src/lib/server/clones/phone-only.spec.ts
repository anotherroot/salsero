/**
 * A phone-only video (offline phase 4c) has no file on the server: every copy
 * leaves it behind, never a row whose file exists nowhere.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { deviceSlots, lessonVideos, recordings, users } from '../db/schema';
import { createTeam, joinTeam } from '../teams';
import { setRole } from '../membership';
import { addRecording, createFigure } from '../figures';
import { addLessonVideo, createLesson } from '../lessons';
import { NO_FILES, T2_SALSA, U1_SALSA } from '../test-walls';
import { cloneInto } from './clone';
import { copyOffer, copyTo } from './copy-to';
import { leftBehind } from './phone-only';
import { moveOffer } from './move';

const T = 1_790_000_000_000;
const NOW = T + 1000;
const ROOMY = 1024 ** 4;
let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	db.insert(users)
		.values([
			{ id: 'u1', email: 'u1@x.si', passwordHash: 'x' },
			{ id: 'u3', email: 'u3@x.si', passwordHash: 'x' }
		])
		.run();
	createTeam(db, 'u3', 'salsa', 'Salsa Tuesdays', T);
	createTeam(db, 'u3', 'salsa', 'Rueda club', T);
	joinTeam(db, 'u1', 2, T);
	setRole(db, 2, 'u1', 'editor', T);
});

/** The person's own figure with one uploaded recording and one only on a phone (slot 3). */
function figureWithTwo(): number {
	const id = createFigure(db, U1_SALSA, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	for (const [file, phone] of [
		['up.mp4', false],
		['phone.mp4', true]
	] as const) {
		const r = addRecording(db, {
			figureId: id,
			file,
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 9,
			note: null
		});
		if (phone)
			db.update(recordings)
				.set({ serverCopy: false, originSlot: 3, originBytes: 9 })
				.where(eq(recordings.id, r.id))
				.run();
	}
	return id;
}
const recsOf = (figureId: number) =>
	db.select().from(recordings).where(eq(recordings.figureId, figureId)).all();

describe('copies leave a phone-only video behind (offline phase 4c)', () => {
	it('a clone of the figure (into a group) takes only the uploaded recording', async () => {
		const id = figureWithTwo();
		const res = await cloneInto(
			db,
			{ kind: 'figure', id, into: T2_SALSA, recordings: true },
			NO_FILES,
			NOW,
			ROOMY
		);
		expect(res.ok).toBe(true);
		const copy = res.ok ? res.id : -1;
		expect(recsOf(copy).map((r) => r.file)).toEqual(['copy-up.mp4']);
	});

	it('Copy to a group leaves it behind', async () => {
		const id = figureWithTwo();
		const res = await copyTo(db, 'u1', 'figure', id, T2_SALSA, {}, NO_FILES, NOW, ROOMY);
		expect(res.ok).toBe(true);
		const copy = res.ok ? res.id : -1;
		expect(recsOf(copy).every((r) => r.serverCopy)).toBe(true);
		expect(recsOf(copy)).toHaveLength(1);
	});

	it('a lesson copy leaves its phone-only video behind', async () => {
		const lesson = createLesson(db, U1_SALSA, {
			title: 'L',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		const v = addLessonVideo(db, {
			lessonId: lesson.id,
			file: 'pv.mp4',
			mime: 'video/mp4',
			sizeBytes: 5
		});
		db.update(lessonVideos).set({ serverCopy: false }).where(eq(lessonVideos.id, v.id)).run();
		addLessonVideo(db, { lessonId: lesson.id, file: 'uv.mp4', mime: 'video/mp4', sizeBytes: 5 });
		const res = await cloneInto(
			db,
			{ kind: 'lesson', id: lesson.id, into: T2_SALSA, recordings: true },
			NO_FILES,
			NOW,
			ROOMY
		);
		const copy = res.ok ? res.id : -1;
		expect(
			db
				.select()
				.from(lessonVideos)
				.where(eq(lessonVideos.lessonId, copy))
				.all()
				.map((r) => r.file)
		).toEqual(['copy-uv.mp4']);
	});

	it('leftBehind counts them, with the device holding them', () => {
		const id = figureWithTwo();
		expect(leftBehind(db, 'figure', id)).toEqual({ count: 1, slot: 3 });
		const lesson = createLesson(db, U1_SALSA, {
			title: 'L',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		expect(leftBehind(db, 'lesson', lesson.id)).toEqual({ count: 0, slot: null });
	});
});

describe('the Copy to offer says what stays behind', () => {
	it('names how many and the device holding them', () => {
		db.insert(deviceSlots)
			.values({
				slot: 3,
				deviceKey: 'k3',
				userId: 'u1',
				createdAt: 1,
				label: '{"kind":"android","model":"Pixel 8"}'
			})
			.run();
		const id = figureWithTwo();
		expect(copyOffer(db, 'u1', 'figure', id)?.stayBehind).toEqual({
			count: 1,
			label: { kind: 'android', model: 'Pixel 8' }
		});
	});

	it('none: null', () => {
		const lesson = createLesson(db, U1_SALSA, {
			title: 'L',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		expect(copyOffer(db, 'u1', 'lesson', lesson.id)?.stayBehind ?? null).toBeNull();
	});
});

describe('the Move to offer says what stays behind too', () => {
	it("a lesson's phone-only videos, and the device holding them", () => {
		db.insert(deviceSlots)
			.values({
				slot: 3,
				deviceKey: 'k3',
				userId: 'u1',
				createdAt: 1,
				label: '{"kind":"iphone","model":null}'
			})
			.run();
		const lesson = createLesson(db, U1_SALSA, {
			title: 'L',
			lessonDay: '2026-11-01',
			notes: null
		}).lesson;
		const v = addLessonVideo(db, {
			lessonId: lesson.id,
			file: 'pv.mp4',
			mime: 'video/mp4',
			sizeBytes: 5
		});
		db.update(lessonVideos)
			.set({ serverCopy: false, originSlot: 3 })
			.where(eq(lessonVideos.id, v.id))
			.run();
		expect(moveOffer(db, U1_SALSA, lesson.id)?.stayBehind).toEqual({
			count: 1,
			label: { kind: 'iphone', model: null }
		});
	});
});
