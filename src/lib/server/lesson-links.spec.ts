import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { addRecording, createFigure, createVariationFrom } from './figures';
import { addLessonVideo, createLesson } from './lessons';
import { createCustomExercise } from './exercises';
import { addSpot } from './spots';
import { linkSpot } from './spot-links';
import { lessonsReaching, viaSections } from './lesson-links';

let db: Db;
let lessonId: number;
let otherLessonId: number;
let basic: number;
let doble: number;
let drill: number;
let a: number;
let b: number;
let elsewhere: number;
let onRecording: number;

function lessonWithVideo(title: string, file: string) {
	const id = createLesson(db, 'salsa', { lessonDay: '2026-10-12', title, notes: null }).lesson.id;
	const videoId = addLessonVideo(db, { lessonId: id, file, mime: 'video/mp4', sizeBytes: 1 }).id;
	return { id, videoId };
}

beforeEach(() => {
	db = openDb(':memory:');
	basic = createFigure(db, 'salsa', {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
	doble = createVariationFrom(db, basic, 'Doble')!.id;
	drill = createCustomExercise(db, 'salsa', { name: 'Clave', everyDays: 3, notes: null }).id;

	const lesson = lessonWithVideo('Cubana', 'l1.mp4');
	lessonId = lesson.id;
	const second = addLessonVideo(db, {
		lessonId,
		file: 'l2.mp4',
		mime: 'video/mp4',
		sizeBytes: 1
	}).id;
	b = addSpot(db, { lessonVideoId: second }, { startMs: 500, endMs: 3000, label: null })!.id;
	a = addSpot(
		db,
		{ lessonVideoId: lesson.videoId },
		{ startMs: 9000, endMs: 12000, label: 'A' }
	)!.id;
	addSpot(db, { lessonVideoId: lesson.videoId }, { startMs: 100, endMs: null, label: null });

	const other = lessonWithVideo('Other', 'o.mp4');
	otherLessonId = other.id;
	elsewhere = addSpot(
		db,
		{ lessonVideoId: other.videoId },
		{ startMs: 0, endMs: 2000, label: null }
	)!.id;

	const recordingId = addRecording(db, {
		figureId: basic,
		file: 'r.mp4',
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: 1,
		note: null
	}).id;
	onRecording = addSpot(db, { recordingId }, { startMs: 0, endMs: 2000, label: null })!.id;
});

describe('viaSections', () => {
	it('is empty when no section of the lesson is linked', () => {
		const via = viaSections(db, lessonId);
		expect(via.figures.size).toBe(0);
		expect(via.exercises.size).toBe(0);
	});

	it("keys this lesson's section links by variation and drill, each by start", () => {
		linkSpot(db, a, { figureId: doble });
		linkSpot(db, b, { figureId: doble });
		linkSpot(db, a, { exerciseId: drill });
		const via = viaSections(db, lessonId);
		expect(via.figures.get(doble)!.map((s) => s.spotId)).toEqual([b, a]);
		expect(via.figures.get(doble)![1]).toEqual({
			spotId: a,
			startMs: 9000,
			endMs: 12000,
			label: 'A'
		});
		expect(via.exercises.get(drill)!.map((s) => s.spotId)).toEqual([a]);
	});

	it("leaves out another lesson's sections", () => {
		linkSpot(db, elsewhere, { figureId: doble });
		expect(viaSections(db, lessonId).figures.size).toBe(0);
		expect(
			viaSections(db, otherLessonId)
				.figures.get(doble)!
				.map((s) => s.spotId)
		).toEqual([elsewhere]);
	});
});

describe('lessonsReaching', () => {
	it('names a lesson once, however many of its sections link the target', () => {
		linkSpot(db, a, { figureId: doble });
		linkSpot(db, b, { figureId: doble });
		expect(lessonsReaching(db, { figureId: doble })).toEqual([lessonId]);
	});

	it('works for a drill', () => {
		linkSpot(db, b, { exerciseId: drill });
		expect(lessonsReaching(db, { exerciseId: drill })).toEqual([lessonId]);
	});

	it("ignores a recording's sections", () => {
		linkSpot(db, onRecording, { figureId: doble });
		expect(lessonsReaching(db, { figureId: doble })).toEqual([]);
	});
});
