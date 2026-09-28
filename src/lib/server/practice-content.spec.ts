import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { createCustomExercise, getExercise, logSet } from './exercises';
import { createFigure } from './figures';
import { createLesson, linkFigure } from './lessons';
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
	name: 'Enchufla',
	partner: 'partner' as const,
	style: 'salsa' as const,
	notes: 'Lead on 1',
	callable: true,
	callText: 'en-CHU-fla'
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
			figures: [{ id: figure.id, name: 'Enchufla' }],
			videos: []
		});
		expect(p.content.type === 'lesson' && p.content.links.map((l) => l.url)).toEqual([
			'https://youtu.be/dQw4w9WgXcQ'
		]);
	});

	it('gives a figure its notes, spoken name, length and links', () => {
		const { figure, exercise } = createFigure(db, 'salsa', figureInput)!;
		addLinks(db, { figureId: figure.id }, ['https://a.org'], 'Demo');
		expect(practicePayload(db, exercise, TZ, Date.now()).content).toMatchObject({
			type: 'figure',
			figure: { id: figure.id, name: 'Enchufla', notes: 'Lead on 1', say: 'en-CHU-fla', eights: 1 },
			links: [{ url: 'https://a.org', title: 'Demo' }],
			recordings: []
		});
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
			slots: [{ note: null, names: ['Enchufla'] }]
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
