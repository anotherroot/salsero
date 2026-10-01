import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { videoSpots } from './db/schema';
import { addRecording, createFigure, deleteRecording } from './figures';
import { addLessonVideo, createLesson, deleteLessonVideo } from './lessons';
import {
	addSpot,
	deleteSpot,
	listSpots,
	ownerExists,
	ownerFrom,
	renameSpot,
	SpotError
} from './spots';

let db: Db;
let recordingId: number;
let lessonVideoId: number;

beforeEach(() => {
	db = openDb(':memory:');
	const { figure } = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!;
	recordingId = addRecording(db, {
		figureId: figure.id,
		file: 'r.mp4',
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: 10,
		note: null
	}).id;
	const { lesson } = createLesson(db, 'salsa', {
		lessonDay: '2026-09-20',
		title: 'Class',
		notes: null
	});
	lessonVideoId = addLessonVideo(db, {
		lessonId: lesson.id,
		file: 'l.mp4',
		mime: 'video/mp4',
		sizeBytes: 10
	}).id;
});

const point = (startMs: number, label: string | null = null) => ({
	startMs,
	endMs: null,
	label
});

describe('ownerFrom', () => {
	it('takes exactly one positive integer id, as a number or digits', () => {
		expect(ownerFrom({ recordingId: 3 })).toEqual({ recordingId: 3 });
		expect(ownerFrom({ lessonVideoId: '7' })).toEqual({ lessonVideoId: 7 });
	});
	it.each([
		{},
		{ recordingId: 1, lessonVideoId: 2 },
		{ recordingId: 0 },
		{ recordingId: -1 },
		{ recordingId: 1.5 },
		{ recordingId: 'abc' },
		{ recordingId: '1e3' },
		{ lessonVideoId: null }
	])('refuses %o', (raw) => {
		expect(ownerFrom(raw)).toBeNull();
	});
});

describe('spots', () => {
	it('adds, lists by start time, renames and deletes on both kinds of owner', () => {
		for (const owner of [{ recordingId }, { lessonVideoId }]) {
			const late = addSpot(db, owner, point(9000))!;
			const early = addSpot(db, owner, { startMs: 1000, endMs: 2500, label: '  Turn  ' })!;
			expect(early).toEqual({ id: early.id, startMs: 1000, endMs: 2500, label: 'Turn' });
			expect(listSpots(db, owner).map((s) => s.id)).toEqual([early.id, late.id]);

			expect(renameSpot(db, late.id, 'Dip')?.label).toBe('Dip');
			expect(renameSpot(db, late.id, '   ')?.label).toBeNull();

			expect(deleteSpot(db, early.id)).toBe(true);
			expect(deleteSpot(db, early.id)).toBe(false);
			expect(listSpots(db, owner).map((s) => s.id)).toEqual([late.id]);
		}
	});

	it("keeps each video's spots to itself", () => {
		addSpot(db, { recordingId }, point(1000));
		expect(listSpots(db, { lessonVideoId })).toEqual([]);
	});

	it('answers null for a video that does not exist', () => {
		expect(ownerExists(db, { recordingId: 999 })).toBe(false);
		expect(ownerExists(db, { recordingId })).toBe(true);
		expect(addSpot(db, { lessonVideoId: 999 }, point(0))).toBeNull();
		expect(renameSpot(db, 999, 'x')).toBeNull();
	});

	it.each([
		['a negative start', { startMs: -1, endMs: null, label: null }],
		['a fractional start', { startMs: 1.5, endMs: null, label: null }],
		['a string start', { startMs: '100', endMs: null, label: null }],
		['an end at the start', { startMs: 100, endMs: 100, label: null }],
		['an end before the start', { startMs: 100, endMs: 50, label: null }],
		['a non-string label', { startMs: 100, endMs: null, label: 5 }],
		['an 81-character label', { startMs: 100, endMs: null, label: 'x'.repeat(81) }]
	])('refuses %s', (_, input) => {
		expect(() => addSpot(db, { recordingId }, input)).toThrow(SpotError);
	});

	it('accepts an 80-character label and refuses a longer rename', () => {
		const spot = addSpot(db, { recordingId }, point(0, 'x'.repeat(80)))!;
		expect(spot.label).toHaveLength(80);
		expect(() => renameSpot(db, spot.id, 'y'.repeat(81))).toThrow(SpotError);
	});

	it('has a CHECK for exactly one owner', () => {
		expect(() =>
			db.insert(videoSpots).values({ recordingId, lessonVideoId, startMs: 0 }).run()
		).toThrow(/CHECK/);
		expect(() => db.insert(videoSpots).values({ startMs: 0 }).run()).toThrow(/CHECK/);
	});

	it('goes with its video when the video is deleted', () => {
		addSpot(db, { recordingId }, point(1000));
		addSpot(db, { lessonVideoId }, point(1000));
		expect(deleteRecording(db, recordingId)?.file).toBe('r.mp4');
		expect(deleteLessonVideo(db, lessonVideoId)?.file).toBe('l.mp4');
		expect(db.select().from(videoSpots).all()).toEqual([]);
	});
});
