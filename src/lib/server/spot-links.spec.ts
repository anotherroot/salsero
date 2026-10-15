import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises } from './db/schema';
import { addRecording, archiveFigure, createFigure, createVariation } from './figures';
import { addLessonVideo, createLesson } from './lessons';
import { createCustomExercise } from './exercises';
import { addSpot } from './spots';
import {
	assertUnlinked,
	getSpotLink,
	linkChips,
	linksBlocking,
	linkSpot,
	SpotLinkedError,
	SpotLinkError,
	targetFrom,
	unlinkSpot
} from './spot-links';

let db: Db;
let lessonId: number;
let figureId: number;
let doble: number;
let drill: number;
let lessonVideoId: number;
let section: number;
let point: number;

const fig = (dance: 'salsa' | 'bachata', name: string) =>
	createFigure(db, dance, {
		name,
		partner: 'partner',
		style: dance === 'salsa' ? 'salsa' : 'sensual',
		notes: null
	})!.figure.id;

beforeEach(() => {
	db = openDb(':memory:');
	figureId = fig('salsa', 'Enchufla');
	doble = createVariation(db, figureId, { name: 'Doble', notes: null })!.id;
	drill = createCustomExercise(db, 'salsa', { name: 'Clave', everyDays: 3, notes: null }).id;
	lessonId = createLesson(db, 'salsa', { lessonDay: '2026-10-12', title: 'Cubana', notes: null })
		.lesson.id;
	lessonVideoId = addLessonVideo(db, {
		lessonId,
		file: 'l.mp4',
		mime: 'video/mp4',
		sizeBytes: 1
	}).id;
	section = addSpot(db, { lessonVideoId }, { startMs: 1000, endMs: 4000, label: 'Enchufla' })!.id;
	point = addSpot(db, { lessonVideoId }, { startMs: 500, endMs: null, label: null })!.id;
});

describe('targetFrom', () => {
	it('reads figure:<id> and exercise:<id>', () => {
		expect(targetFrom('figure:12')).toEqual({ figureId: 12 });
		expect(targetFrom('exercise:5')).toEqual({ exerciseId: 5 });
	});
	it.each([undefined, '', 'figure:', 'figure:0', 'routine:3', 'figure:1.5', 'figure:-2'])(
		'refuses %s',
		(raw) => expect(targetFrom(raw)).toBeNull()
	);
});

describe('linkSpot', () => {
	it('links a section to a figure, a variation and a drill', () => {
		linkSpot(db, section, { figureId });
		linkSpot(db, section, { figureId: doble });
		linkSpot(db, section, { exerciseId: drill });
		expect(
			linkChips(db, [section])
				.get(section)!
				.map((c) => c.label)
		).toEqual(['Clave', 'Enchufla', 'Enchufla · Doble']);
	});
	it('refuses a point', () => {
		expect(() => linkSpot(db, point, { figureId })).toThrow(SpotLinkError);
	});
	it('refuses a target of the other dance', () => {
		const bachata = fig('bachata', 'Paseo');
		expect(() => linkSpot(db, section, { figureId: bachata })).toThrow(/dance/);
	});
	it('refuses an exercise that is not a drill', () => {
		const review = db.select().from(exercises).where(eq(exercises.lessonId, lessonId)).get()!;
		expect(() => linkSpot(db, section, { exerciseId: review.id })).toThrow(/drill/);
	});
	it('refuses the same pair twice with a 409', () => {
		linkSpot(db, section, { figureId });
		try {
			linkSpot(db, section, { figureId });
			expect.unreachable();
		} catch (e) {
			expect(e).toBeInstanceOf(SpotLinkError);
			expect((e as SpotLinkError).status).toBe(409);
		}
	});
	it('refuses a missing spot or target', () => {
		expect(() => linkSpot(db, 999, { figureId })).toThrow(SpotLinkError);
		expect(() => linkSpot(db, section, { figureId: 999 })).toThrow(SpotLinkError);
		expect(() => linkSpot(db, section, { exerciseId: 999 })).toThrow(SpotLinkError);
	});
});

describe('unlinkSpot', () => {
	it('is scoped to its target', () => {
		const id = linkSpot(db, section, { figureId });
		expect(unlinkSpot(db, id, { figureId: doble })).toBe(false);
		expect(getSpotLink(db, id)).toEqual({ id, spotId: section, target: { figureId } });
		expect(unlinkSpot(db, id, { figureId })).toBe(true);
		expect(getSpotLink(db, id)).toBeNull();
	});
	it('leaves the section’s other links', () => {
		const a = linkSpot(db, section, { figureId });
		linkSpot(db, section, { exerciseId: drill });
		unlinkSpot(db, a, { figureId });
		expect(linksBlocking(db, { spotId: section })).toEqual(['Clave']);
	});
});

describe('linksBlocking', () => {
	it('names the targets of a spot and of a whole video, archived marked', () => {
		linkSpot(db, section, { figureId: doble });
		archiveFigure(db, figureId, Date.now());
		expect(linksBlocking(db, { spotId: section })).toEqual(['Enchufla · Doble (archived)']);
		expect(linksBlocking(db, { lessonVideoId })).toEqual(['Enchufla · Doble (archived)']);
		expect(() => assertUnlinked(db, { lessonVideoId })).toThrow(SpotLinkedError);
		expect(() => assertUnlinked(db, { lessonVideoId })).toThrow(
			'Linked to Enchufla · Doble (archived) — unlink it first.'
		);
	});
	it('is empty when nothing links', () => {
		expect(linksBlocking(db, { lessonVideoId })).toEqual([]);
		expect(() => assertUnlinked(db, { spotId: section })).not.toThrow();
	});
	it('covers recordings too', () => {
		const rec = addRecording(db, {
			figureId,
			file: 'r.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		}).id;
		const s = addSpot(db, { recordingId: rec }, { startMs: 0, endMs: 900, label: null })!.id;
		linkSpot(db, s, { exerciseId: drill });
		expect(linksBlocking(db, { recordingId: rec })).toEqual(['Clave']);
	});
});
