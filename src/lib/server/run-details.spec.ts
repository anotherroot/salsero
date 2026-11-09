import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, lessons } from './db/schema';
import { createCustomExercise } from './exercises';
import { addFigureExercise, addRecording, createFigure, createVariationIn } from './figures';
import { addLessonVideo, createLesson, linkFigure, linkRoutine } from './lessons';
import { addLesson } from './entries';
import { addLinks } from './links';
import { addFigureSlot, createRoutine } from './routines';
import { addSpot } from './spots';
import { linkSpot } from './spot-links';
import { createTeam, joinTeam } from './teams';
import { T1_SALSA, U1_SALSA } from './test-walls';
import { exerciseDetails, figureDetails } from './run-details';

let db: Db;
const exerciseRow = (id: number) => db.select().from(exercises).where(eq(exercises.id, id)).get()!;

const own = (figureName: string, notes: string | null = null) =>
	createFigure(db, U1_SALSA, {
		figureName,
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes
	})!.figure.id;

beforeEach(() => {
	db = openDb(':memory:');
});

describe('a drill’s details', () => {
	it('has none when it is only a title', () => {
		const drill = createCustomExercise(db, U1_SALSA, {
			name: 'Clave countind and clapping',
			everyDays: 3,
			notes: null
		}).id;
		expect(exerciseDetails(db, U1_SALSA, exerciseRow(drill))).toBeNull();
	});

	it('holds its description and its links', () => {
		const drill = createCustomExercise(db, U1_SALSA, {
			name: 'Salsa to Son switching',
			everyDays: 3,
			notes: '  Do 1 to 3 repetitions  '
		}).id;
		addLinks(db, { exerciseId: drill }, ['https://youtu.be/abc'], 'Switch');
		const d = exerciseDetails(db, U1_SALSA, exerciseRow(drill))!;
		expect(d.heading).toBe('Salsa to Son switching');
		expect(d.notes).toBe('Do 1 to 3 repetitions');
		expect(d.facts).toEqual([]);
		expect(d.links).toEqual([{ url: 'https://youtu.be/abc', title: 'Switch' }]);
	});
});

describe('a figure’s details', () => {
	it('loops a linked lesson section, captioned with its lesson and range', () => {
		const fig = own('Enchufla');
		const lessonId = createLesson(db, U1_SALSA, {
			lessonDay: '2026-10-12',
			title: 'Nadaljevalna',
			notes: null
		}).lesson.id;
		const lessonVideoId = addLessonVideo(db, {
			lessonId,
			file: 'l.mp4',
			mime: 'video/mp4',
			sizeBytes: 1
		}).id;
		const section = addSpot(
			db,
			{ lessonVideoId },
			{ startMs: 42_000, endMs: 58_000, label: null }
		)!.id;
		linkSpot(db, 'u1', section, { figureId: fig });
		const d = figureDetails(db, 'u1', [fig])[fig];
		expect(d.heading).toBe('Enchufla · Basic');
		expect(d.clips).toEqual([
			{
				kind: 'section',
				src: '/lesson-videos/l.mp4',
				startMs: 42_000,
				endMs: 58_000,
				caption: 'Nadaljevalna · 0:42–0:58'
			}
		]);
	});

	it('shows its own video recordings, never an audio one', () => {
		const fig = own('Exhibela');
		for (const [file, kind] of [
			['v.mp4', 'video'],
			['a.m4a', 'audio']
		] as const) {
			addRecording(db, { figureId: fig, file, mime: 'x', kind, sizeBytes: 1, note: null });
		}
		const d = figureDetails(db, 'u1', [fig])[fig];
		expect(d.clips.map((c) => [c.kind, c.src])).toEqual([['recording', '/recordings/v.mp4']]);
	});

	it('says its timing, and its notes trimmed', () => {
		const fig = own('Pa ti, pa mi', '123 she spins.\n');
		const d = figureDetails(db, 'u1', [fig])[fig];
		expect(d.facts[0]).toBe('1 → 1 · 8 counts');
		expect(d.hasPositions).toBe(false);
		expect(d.notes).toBe('123 she spins.');
	});

	it('of a figure exercise, under the exercise’s name', () => {
		const fig = own('Cubanito', 'Spin');
		const ex = addFigureExercise(db, 'u1', fig)!;
		const d = exerciseDetails(db, U1_SALSA, exerciseRow(ex.id))!;
		expect(d.heading).toBe(exerciseRow(ex.id).name);
		expect(d.notes).toBe('Spin');
	});
});

describe('a group’s figures', () => {
	it('reach a member only through a published lesson: never a draft’s', () => {
		createTeam(db, 'u1', 'salsa', 'Tuesdays', 1);
		joinTeam(db, 'u2', 1, 2);
		const made = createFigure(db, T1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: 'Published notes'
		})!;
		const v2 = made.figure.id;
		const v3 = createVariationIn(
			db,
			made.figure.groupId!,
			{ name: 'Draft only', partner: 'partner', style: 'salsa', notes: 'Draft notes' },
			'u1'
		)!.id;
		const routine = createRoutine(db, T1_SALSA, { name: 'R', notes: null }).routine.id;
		addFigureSlot(db, routine, v2, 'u1');
		const published = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-02',
			title: 'P',
			notes: null
		}).lesson.id;
		linkRoutine(db, published, routine, 'u1');
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, published)).run();
		const draft = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-02',
			title: 'D',
			notes: null
		}).lesson.id;
		linkFigure(db, draft, v3, 'u1');

		const seen = figureDetails(db, 'u2', [v2, v3]);
		expect(Object.keys(seen).map(Number)).toEqual([v2]);
		expect(seen[v2].notes).toBe('Published notes');
		expect(Object.keys(figureDetails(db, 'u4', [v2, v3]))).toEqual([]);
	});
});

describe('a lesson’s details', () => {
	it('hold its notes, its figures (each with its own details), its videos and its links', () => {
		const noted = own('Enchufla', 'Turn on 5');
		const plain = own('Dile que no');
		const made = createLesson(db, U1_SALSA, {
			lessonDay: '2026-09-21',
			title: 'Salsa nadaljevalna',
			notes: '  Son cubana  '
		});
		const lessonId = made.lesson.id;
		linkFigure(db, lessonId, noted, 'u1');
		linkFigure(db, lessonId, plain, 'u1');
		addLessonVideo(db, { lessonId, file: 'l.mp4', mime: 'video/mp4', sizeBytes: 1 });
		addLinks(db, { lessonId }, ['https://example.com/notes'], null);

		const d = exerciseDetails(db, U1_SALSA, exerciseRow(made.exercise.id))!;
		expect(d.heading).toBe(made.exercise.name);
		expect(d.notes).toBe('Son cubana');
		// In the lesson's own order, as its page lists them.
		const byName = new Map(d.figures.map((f) => [f.name, f.details]));
		expect([...byName.keys()].sort()).toEqual(['Dile que no · Basic', 'Enchufla · Basic']);
		expect(byName.get('Enchufla · Basic')?.notes).toBe('Turn on 5');
		expect(byName.get('Dile que no · Basic')).toBeNull();
		expect(d.clips).toEqual([
			{
				kind: 'lesson',
				src: '/lesson-videos/l.mp4',
				startMs: 0,
				endMs: null,
				caption: expect.any(String)
			}
		]);
		expect(d.links).toEqual([{ url: 'https://example.com/notes', title: null }]);
	});

	it('reach a member only through the published lesson they added', () => {
		createTeam(db, 'u1', 'salsa', 'Tuesdays', 1);
		joinTeam(db, 'u2', 1, 2);
		const v2 = createFigure(db, T1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: 'Published notes'
		})!.figure.id;
		const published = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-02',
			title: 'P',
			notes: 'Class notes'
		}).lesson.id;
		linkFigure(db, published, v2, 'u1');
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, published)).run();
		addLesson(
			db,
			'u2',
			published,
			{ lesson: true, routineIds: [], drillIds: [], figureIds: [] },
			3
		);
		const entry = db.select().from(exercises).where(eq(exercises.userId, 'u2')).get()!;

		const d = exerciseDetails(db, { userId: 'u2', dance: 'salsa' }, entry)!;
		expect(d.notes).toBe('Class notes');
		expect(d.figures.map((f) => f.details?.notes)).toEqual(['Published notes']);
	});
});
