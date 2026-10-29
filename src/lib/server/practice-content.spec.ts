import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { figures } from './db/schema';
import { createCustomExercise, getExercise, logSet } from './exercises';
import { addFigureExercise, createFigure, createVariationFrom } from './figures';
import { addLessonVideo, createLesson, linkFigure } from './lessons';
import { addSpot } from './spots';
import { linkSpot } from './spot-links';
import { addLinks } from './links';
import { addFigureSlot, createRoutine } from './routines';
import { practicePayload } from './practice-content';
import { noonOf } from '$lib/day/day';

const TZ = 'Europe/Ljubljana';
let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const figureInput = {
	figureName: 'Enchufla',
	name: 'Basic',
	partner: 'partner' as const,
	style: 'salsa' as const,
	notes: 'Lead on 1'
};
const set = (exerciseId: number, doneAt: number, rating: number | null = null) =>
	logSet(db, {
		exerciseId,
		doneAt,
		durationS: null,
		reps: null,
		rating,
		note: null,
		playerJson: null
	});

describe('practicePayload', () => {
	it('gives a lesson review its notes, links and figures', () => {
		const { lesson, exercise } = createLesson(db, 'salsa', {
			lessonDay: '2026-09-20',
			title: 'Rueda',
			notes: 'Watch the video'
		});
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		linkFigure(db, lesson.id, figure.id);
		addLinks(db, { lessonId: lesson.id }, ['https://youtu.be/dQw4w9WgXcQ'], null);
		const p = practicePayload(db, exercise, TZ, Date.now());
		expect(p.content).toMatchObject({
			type: 'lesson',
			lesson: { title: 'Rueda', notes: 'Watch the video', lessonDay: '2026-09-20' },
			figures: [{ id: figure.id, name: 'Enchufla · Basic' }],
			videos: []
		});
		expect(p.content.type === 'lesson' && p.content.links.map((l) => l.url)).toEqual([
			'https://youtu.be/dQw4w9WgXcQ'
		]);
	});

	it('gives a figure its notes, spoken name, length and links', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		const exercise = addFigureExercise(db, figure.id)!;
		addLinks(db, { figureId: figure.id }, ['https://a.org'], 'Demo');
		expect(practicePayload(db, exercise, TZ, Date.now()).content).toMatchObject({
			type: 'figure',
			figure: { id: figure.id, name: 'Enchufla · Basic', notes: 'Lead on 1', eights: 1 },
			links: [{ url: 'https://a.org', title: 'Demo' }],
			recordings: []
		});
	});

	it('derives the cue’s 8-counts from the figure’s length in counts', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		const exercise = addFigureExercise(db, figure.id)!;
		db.update(figures).set({ lengthCounts: 12 }).where(eq(figures.id, figure.id)).run();
		const content = practicePayload(db, exercise, TZ, Date.now()).content;
		// 12 counts round up to two 8-counts, so the cue is never called over itself.
		expect(content.type === 'figure' && content.figure.eights).toBe(2);
	});

	it('gives a drill its own notes and links', () => {
		const drill = createCustomExercise(db, 'salsa', {
			name: 'Son switch',
			everyDays: 2,
			notes: 'Switch every 4'
		});
		addLinks(db, { exerciseId: drill.id }, ['https://a.org'], null);
		expect(practicePayload(db, getExercise(db, drill.id)!, TZ, Date.now()).content).toMatchObject({
			type: 'drill',
			notes: 'Switch every 4',
			links: [{ url: 'https://a.org' }]
		});
	});

	it('gives a routine its slots as names', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		const { routine, exercise } = createRoutine(db, 'salsa', { name: 'Friday', notes: null });
		addFigureSlot(db, routine.id, figure.id);
		expect(practicePayload(db, exercise, TZ, Date.now()).content).toMatchObject({
			type: 'routine',
			routine: { id: routine.id, name: 'Friday' },
			slots: [{ note: null, names: ['Enchufla · Basic'] }]
		});
	});

	it('reports the last set in calendar days, in the user’s zone', () => {
		const drill = createCustomExercise(db, 'salsa', { name: 'D', everyDays: 1, notes: null });
		// 23:30 local on the 19th, read at 08:00 on the 20th: "yesterday", though under 9 hours ago.
		set(drill.id, noonOf('2026-09-19', TZ) + 11.5 * 3_600_000, 3);
		const now = noonOf('2026-09-20', TZ) - 4 * 3_600_000;
		expect(practicePayload(db, getExercise(db, drill.id)!, TZ, now).last).toMatchObject({
			rating: 3,
			daysAgo: 1
		});
	});

	it('has no last set for a fresh exercise', () => {
		const drill = createCustomExercise(db, 'salsa', { name: 'D', everyDays: 1, notes: null });
		expect(practicePayload(db, getExercise(db, drill.id)!, TZ, Date.now()).last).toBeNull();
	});
});

describe('practicePayload sections', () => {
	let n = 0;
	const section = () => {
		const { lesson } = createLesson(db, 'salsa', {
			lessonDay: '2026-10-12',
			title: 'Cubana',
			notes: null
		});
		const v = addLessonVideo(db, {
			lessonId: lesson.id,
			file: `l${++n}.mp4`,
			mime: 'video/mp4',
			sizeBytes: 1
		}).id;
		return addSpot(db, { lessonVideoId: v }, { startMs: 0, endMs: 900, label: 'Turn' })!.id;
	};
	const sectionsOf = (content: { type: string }) =>
		'sections' in content ? (content.sections as { spot: { label: string } }[]) : null;

	it('gives a figure its own sections, not its variations’', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		const exercise = addFigureExercise(db, figure.id)!;
		const doble = createVariationFrom(db, figure.id, 'Doble')!;
		linkSpot(db, section(), { figureId: doble.id });
		expect(sectionsOf(practicePayload(db, exercise, TZ, Date.now()).content)).toEqual([]);
		linkSpot(db, section(), { figureId: figure.id });
		expect(
			sectionsOf(practicePayload(db, exercise, TZ, Date.now()).content)!.map((s) => s.spot.label)
		).toEqual(['Turn']);
	});

	it('a figure exercise is named by its label', () => {
		const { figure } = createFigure(db, 'salsa', figureInput)!;
		const doble = createVariationFrom(db, figure.id, 'Doble')!;
		const exercise = addFigureExercise(db, doble.id)!;
		const content = practicePayload(db, exercise, TZ, Date.now()).content;
		expect(content.type === 'figure' && content.figure.name).toBe('Enchufla · Doble');
	});

	it('gives a drill its sections', () => {
		const drill = createCustomExercise(db, 'salsa', { name: 'Clave', everyDays: 3, notes: null });
		linkSpot(db, section(), { exerciseId: drill.id });
		expect(sectionsOf(practicePayload(db, drill, TZ, Date.now()).content)).toHaveLength(1);
	});
});
