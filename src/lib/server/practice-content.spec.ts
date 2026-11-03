import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, figures } from './db/schema';
import { createCustomExercise, getExercise, logSet } from './exercises';
import { addFigureExercise, createFigure, createVariationFrom } from './figures';
import { addLessonVideo, createLesson, linkFigure, linkRoutine, publishLesson } from './lessons';
import { linkInSpace, linkSpot } from './spot-links';
import { createTeam, joinTeam } from './teams';
import { addSpot } from './spots';
import { addLinks } from './links';
import { addFigureSlot, createRoutine } from './routines';
import { practicePayload } from './practice-content';
import { noonOf } from '$lib/day/day';
import { T1_SALSA, U1_SALSA } from '$lib/server/test-walls';

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
		const { lesson, exercise } = createLesson(db, U1_SALSA, {
			lessonDay: '2026-09-20',
			title: 'Rueda',
			notes: 'Watch the video'
		});
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
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
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const exercise = addFigureExercise(db, 'u1', figure.id)!;
		addLinks(db, { figureId: figure.id }, ['https://a.org'], 'Demo');
		expect(practicePayload(db, exercise, TZ, Date.now()).content).toMatchObject({
			type: 'figure',
			figure: { id: figure.id, name: 'Enchufla · Basic', notes: 'Lead on 1', eights: 1 },
			links: [{ url: 'https://a.org', title: 'Demo' }],
			recordings: []
		});
	});

	it('shows a variation by its label but says the figure’s name', () => {
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const doble = createVariationFrom(db, figure.id, 'Doble')!;
		const exercise = addFigureExercise(db, 'u1', doble.id)!;
		const { content } = practicePayload(db, exercise, TZ, Date.now());
		expect(content.type === 'figure' && content.figure).toMatchObject({
			name: 'Enchufla · Doble',
			say: 'Enchufla'
		});
	});

	it('derives the cue’s 8-counts from the figure’s length in counts', () => {
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const exercise = addFigureExercise(db, 'u1', figure.id)!;
		db.update(figures).set({ lengthCounts: 12 }).where(eq(figures.id, figure.id)).run();
		const content = practicePayload(db, exercise, TZ, Date.now()).content;
		// 12 counts round up to two 8-counts, so the cue is never called over itself.
		expect(content.type === 'figure' && content.figure.eights).toBe(2);
	});

	it('gives a drill its own notes and links', () => {
		const drill = createCustomExercise(db, U1_SALSA, {
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
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const { routine, exercise: made } = createRoutine(db, U1_SALSA, {
			name: 'Friday',
			notes: null
		});
		const exercise = getExercise(db, made.id)!; // re-read: the owner was filled in after the insert
		addFigureSlot(db, routine.id, figure.id);
		expect(practicePayload(db, exercise, TZ, Date.now()).content).toMatchObject({
			type: 'routine',
			routine: { id: routine.id, name: 'Friday' },
			slots: [{ note: null, names: ['Enchufla · Basic'] }]
		});
	});

	it('reports the last set in calendar days, in the user’s zone', () => {
		const drill = createCustomExercise(db, U1_SALSA, { name: 'D', everyDays: 1, notes: null });
		// 23:30 local on the 19th, read at 08:00 on the 20th: "yesterday", though under 9 hours ago.
		set(drill.id, noonOf('2026-09-19', TZ) + 11.5 * 3_600_000, 3);
		const now = noonOf('2026-09-20', TZ) - 4 * 3_600_000;
		expect(practicePayload(db, getExercise(db, drill.id)!, TZ, now).last).toMatchObject({
			rating: 3,
			daysAgo: 1
		});
	});

	it('has no last set for a fresh exercise', () => {
		const drill = createCustomExercise(db, U1_SALSA, { name: 'D', everyDays: 1, notes: null });
		expect(practicePayload(db, getExercise(db, drill.id)!, TZ, Date.now()).last).toBeNull();
	});
});

describe('practicePayload sections', () => {
	let n = 0;
	const section = () => {
		const { lesson } = createLesson(db, U1_SALSA, {
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
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const exercise = addFigureExercise(db, 'u1', figure.id)!;
		const doble = createVariationFrom(db, figure.id, 'Doble')!;
		linkSpot(db, 'u1', section(), { figureId: doble.id });
		expect(sectionsOf(practicePayload(db, exercise, TZ, Date.now()).content)).toEqual([]);
		linkSpot(db, 'u1', section(), { figureId: figure.id });
		expect(
			sectionsOf(practicePayload(db, exercise, TZ, Date.now()).content)!.map((s) => s.spot.label)
		).toEqual(['Turn']);
	});

	it('a figure exercise is named by its label', () => {
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const doble = createVariationFrom(db, figure.id, 'Doble')!;
		const exercise = addFigureExercise(db, 'u1', doble.id)!;
		const content = practicePayload(db, exercise, TZ, Date.now()).content;
		expect(content.type === 'figure' && content.figure.name).toBe('Enchufla · Doble');
	});

	it('gives a drill its sections', () => {
		const drill = createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 3, notes: null });
		linkSpot(db, 'u1', section(), { exerciseId: drill.id });
		expect(sectionsOf(practicePayload(db, drill, TZ, Date.now()).content)).toHaveLength(1);
	});
});

describe('practicePayload for an entry of a group', () => {
	// Team 1, owned by u1; u2 a member. What a member reaches is what the
	// published lessons hold.
	beforeEach(() => {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		if (!made.ok || made.teamId !== T1_SALSA.teamId) throw new Error('team 1 expected');
		joinTeam(db, 'u2', 1, 2);
	});
	const published = (link: (lessonId: number) => unknown) => {
		const id = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'P', notes: null })
			.lesson.id;
		link(id);
		publishLesson(db, T1_SALSA, id, 1);
		return id;
	};
	// u2's own exercise row, pointing at the group's routine or figure.
	const entry = (values: { source: 'routine' | 'figure'; routineId?: number; figureId?: number }) =>
		db
			.insert(exercises)
			.values({ name: 'entry', userId: 'u2', dance: 'salsa', ...values })
			.returning()
			.get();

	it("reads a group routine's slots in the group's space", () => {
		const { figure } = createFigure(db, T1_SALSA, figureInput)!;
		const { routine } = createRoutine(db, T1_SALSA, { name: 'Group', notes: null });
		addFigureSlot(db, routine.id, figure.id);
		published((id) => linkRoutine(db, id, routine.id));
		const content = practicePayload(
			db,
			entry({ source: 'routine', routineId: routine.id }),
			TZ,
			Date.now()
		).content;
		expect(content).toMatchObject({ type: 'routine', slots: [{ names: ['Enchufla · Basic'] }] });
	});

	it('names a group figure by its label', () => {
		const { figure } = createFigure(db, T1_SALSA, figureInput)!;
		const doble = createVariationFrom(db, figure.id, 'Doble')!;
		published((id) => linkFigure(db, id, doble.id));
		const content = practicePayload(
			db,
			entry({ source: 'figure', figureId: doble.id }),
			TZ,
			Date.now()
		).content;
		expect(content.type === 'figure' && content.figure.name).toBe('Enchufla · Doble');
	});
	it("shows only the entry's own notes once its target is out of reach", () => {
		const { figure } = createFigure(db, T1_SALSA, figureInput)!;
		const content = practicePayload(
			db,
			entry({ source: 'figure', figureId: figure.id }),
			TZ,
			1
		).content;
		expect(content).toEqual({ type: 'drill', notes: null, links: [], sections: [] });
	});

	it("never shows a draft's section to a member", () => {
		const { figure } = createFigure(db, T1_SALSA, figureInput)!;
		published((id) => linkFigure(db, id, figure.id));
		const draft = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-02',
			title: 'Draft',
			notes: null
		}).lesson.id;
		const video = addLessonVideo(db, {
			lessonId: draft,
			file: 'draft.mp4',
			mime: 'video/mp4',
			sizeBytes: 1
		});
		const spot = addSpot(db, { lessonVideoId: video.id }, { startMs: 0, endMs: 9, label: 'D' })!;
		linkInSpace(db, T1_SALSA, spot.id, { figureId: figure.id });
		const forMember = practicePayload(db, entry({ source: 'figure', figureId: figure.id }), TZ, 1);
		expect(JSON.stringify(forMember)).not.toContain('draft.mp4');
		// The owner, an editor, sees it.
		const own = db
			.insert(exercises)
			.values({ name: 'e', userId: 'u1', dance: 'salsa', source: 'figure', figureId: figure.id })
			.returning()
			.get();
		expect(JSON.stringify(practicePayload(db, own, TZ, 1))).toContain('draft.mp4');
	});
});
