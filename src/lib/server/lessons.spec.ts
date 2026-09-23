import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import {
	addLessonVideo,
	archiveLesson,
	createLesson,
	deleteLessonVideo,
	getLesson,
	getLessonVideoByFile,
	lessonVideoBytes,
	linkExercise,
	linkFigure,
	listLessons,
	listLinkableExercises,
	listLinkableFigures,
	reviewName,
	unlinkExercise,
	unlinkFigure,
	updateLesson
} from './lessons';
import { archiveExercise, createCustomExercise, listExercises, updateExercise } from './exercises';
import { createFigure } from './figures';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const lessonInput = {
	lessonDay: '2026-09-22',
	title: 'Rueda basics',
	notes: null
};
const figureInput = {
	name: 'Enchufla',
	partner: 'partner' as const,
	style: 'salsa' as const,
	notes: null,
	callable: true,
	callText: null
};
const video = (lessonId: number, file: string, sizeBytes: number) => ({
	lessonId,
	file,
	mime: 'video/mp4',
	sizeBytes
});

describe('createLesson', () => {
	it('creates the lesson and its review exercise together', () => {
		const { lesson, exercise } = createLesson(db, lessonInput);
		expect(lesson.title).toBe('Rueda basics');
		expect(exercise.name).toBe(reviewName('Rueda basics'));
		expect(exercise.source).toBe('lesson');
		expect(exercise.lessonId).toBe(lesson.id);
		expect(exercise.figureId).toBeNull();
	});

	it('puts the review exercise on Today with its lesson id', () => {
		const { lesson } = createLesson(db, lessonInput);
		const row = listExercises(db).find((e) => e.lessonId === lesson.id);
		expect(row?.partner).toBeNull();
		expect(row?.source).toBe('lesson');
	});

	it('rejects a day that is not YYYY-MM-DD', () => {
		expect(() => createLesson(db, { ...lessonInput, lessonDay: '22/09/2026' })).toThrow();
	});
});

describe('updateLesson', () => {
	it('carries a retitle over to the review exercise', () => {
		const { lesson, exercise } = createLesson(db, lessonInput);
		updateLesson(db, lesson.id, { ...lessonInput, title: 'Rueda, week 2' });
		const after = getLesson(db, lesson.id);
		expect(after?.exercise?.name).toBe(reviewName('Rueda, week 2'));
		expect(after?.exercise?.id).toBe(exercise.id);
	});

	it('returns null for a lesson that does not exist', () => {
		expect(updateLesson(db, 999, lessonInput)).toBeNull();
	});
});

describe('archiveLesson', () => {
	it('archives the lesson and its exercise, and keeps the videos', () => {
		const { lesson, exercise } = createLesson(db, lessonInput);
		addLessonVideo(db, video(lesson.id, 'a.mp4', 10));

		expect(archiveLesson(db, lesson.id, 1000)).toBe(true);
		expect(listLessons(db)).toHaveLength(0);
		expect(listExercises(db).some((e) => e.id === exercise.id)).toBe(false);
		expect(getLesson(db, lesson.id)?.videos).toHaveLength(1);
	});

	it('refuses to archive twice', () => {
		const { lesson } = createLesson(db, lessonInput);
		expect(archiveLesson(db, lesson.id, 1000)).toBe(true);
		expect(archiveLesson(db, lesson.id, 2000)).toBe(false);
	});
});

describe('a lesson owns its review exercise', () => {
	it('refuses to archive it through archiveExercise', () => {
		const { exercise } = createLesson(db, lessonInput);
		expect(archiveExercise(db, exercise.id, 1000)).toBe(false);
	});

	it('ignores a name submitted for it, the way a figure exercise does', () => {
		const { exercise } = createLesson(db, lessonInput);
		const after = updateExercise(db, exercise.id, {
			name: 'Something else',
			practiceMode: 'none',
			songId: null,
			countBpm: null,
			everyDays: 7,
			active: true,
			notes: null
		});
		expect(after?.name).toBe(reviewName('Rueda basics'));
		expect(after?.everyDays).toBe(7);
	});
});

describe('linking figures', () => {
	it('links a figure and lists it with the exercise that came with it', () => {
		const { lesson } = createLesson(db, lessonInput);
		const { figure, exercise } = createFigure(db, figureInput);

		expect(linkFigure(db, lesson.id, figure.id)).toBe(true);
		const [linked] = getLesson(db, lesson.id)!.figures;
		expect(linked.name).toBe('Enchufla');
		expect(linked.exerciseId).toBe(exercise.id);
	});

	it('refuses a second link of the same figure', () => {
		const { lesson } = createLesson(db, lessonInput);
		const { figure } = createFigure(db, figureInput);
		expect(linkFigure(db, lesson.id, figure.id)).toBe(true);
		expect(linkFigure(db, lesson.id, figure.id)).toBe(false);
		expect(getLesson(db, lesson.id)!.figures).toHaveLength(1);
	});

	it('refuses an archived figure', () => {
		const { lesson } = createLesson(db, lessonInput);
		const { figure } = createFigure(db, figureInput);
		db.run(`update figures set archived_at = 1 where id = ${figure.id}`);
		expect(linkFigure(db, lesson.id, figure.id)).toBe(false);
	});

	it('unlinks, and reports whether there was anything to unlink', () => {
		const { lesson } = createLesson(db, lessonInput);
		const { figure } = createFigure(db, figureInput);
		linkFigure(db, lesson.id, figure.id);
		expect(unlinkFigure(db, lesson.id, figure.id)).toBe(true);
		expect(unlinkFigure(db, lesson.id, figure.id)).toBe(false);
	});
});

describe('a figure exercise never shows up in both places', () => {
	it('drops it from the linked list when its figure is linked afterwards', () => {
		const { lesson } = createLesson(db, lessonInput);
		const { figure, exercise } = createFigure(db, figureInput);

		expect(linkExercise(db, lesson.id, exercise.id)).toBe(true);
		expect(getLesson(db, lesson.id)!.exercises.map((e) => e.id)).toEqual([exercise.id]);

		linkFigure(db, lesson.id, figure.id);
		const after = getLesson(db, lesson.id)!;
		expect(after.exercises).toHaveLength(0);
		expect(after.figures[0].exerciseId).toBe(exercise.id);
	});

	it('refuses to link it once its figure is already linked', () => {
		const { lesson } = createLesson(db, lessonInput);
		const { figure, exercise } = createFigure(db, figureInput);
		linkFigure(db, lesson.id, figure.id);
		expect(linkExercise(db, lesson.id, exercise.id)).toBe(false);
	});
});

describe('linking exercises', () => {
	it('links a custom exercise and unlinks it again', () => {
		const { lesson } = createLesson(db, lessonInput);
		const custom = createCustomExercise(db, { name: 'Son basic', everyDays: 3, notes: null });

		expect(linkExercise(db, lesson.id, custom.id)).toBe(true);
		expect(getLesson(db, lesson.id)!.exercises.map((e) => e.name)).toEqual(['Son basic']);
		expect(unlinkExercise(db, lesson.id, custom.id)).toBe(true);
		expect(getLesson(db, lesson.id)!.exercises).toHaveLength(0);
	});

	it('refuses a review exercise, including its own', () => {
		const { lesson, exercise } = createLesson(db, lessonInput);
		const other = createLesson(db, { ...lessonInput, title: 'Other' });
		expect(linkExercise(db, lesson.id, exercise.id)).toBe(false);
		expect(linkExercise(db, lesson.id, other.exercise.id)).toBe(false);
	});

	it('refuses an archived exercise', () => {
		const { lesson } = createLesson(db, lessonInput);
		const custom = createCustomExercise(db, { name: 'Son basic', everyDays: 3, notes: null });
		archiveExercise(db, custom.id, 1000);
		expect(linkExercise(db, lesson.id, custom.id)).toBe(false);
	});
});

describe('the link pickers', () => {
	it('offers only figures that are not linked yet', () => {
		const { lesson } = createLesson(db, lessonInput);
		const a = createFigure(db, figureInput).figure;
		const b = createFigure(db, { ...figureInput, name: 'Dile que no' }).figure;

		linkFigure(db, lesson.id, a.id);
		expect(listLinkableFigures(db, lesson.id).map((f) => f.id)).toEqual([b.id]);
	});

	it('keeps custom exercises in the picker once a figure is linked', () => {
		// The null-propagating `NOT IN` bug would empty this list entirely.
		const { lesson } = createLesson(db, lessonInput);
		const { figure } = createFigure(db, figureInput);
		const custom = createCustomExercise(db, { name: 'Son basic', everyDays: 3, notes: null });
		linkFigure(db, lesson.id, figure.id);

		expect(listLinkableExercises(db, lesson.id).map((e) => e.id)).toEqual([custom.id]);
	});

	it('leaves out what is linked, archived, or any lesson review exercise', () => {
		const { lesson } = createLesson(db, lessonInput);
		createLesson(db, { ...lessonInput, title: 'Other' });
		const linked = createCustomExercise(db, { name: 'Linked', everyDays: 3, notes: null });
		const gone = createCustomExercise(db, { name: 'Archived', everyDays: 3, notes: null });
		const free = createCustomExercise(db, { name: 'Free', everyDays: 3, notes: null });

		linkExercise(db, lesson.id, linked.id);
		archiveExercise(db, gone.id, 1000);

		expect(listLinkableExercises(db, lesson.id).map((e) => e.id)).toEqual([free.id]);
	});
});

describe('videos', () => {
	it('lists them per lesson and totals their bytes', () => {
		const { lesson } = createLesson(db, lessonInput);
		const other = createLesson(db, { ...lessonInput, title: 'Other' }).lesson;
		addLessonVideo(db, video(lesson.id, 'a.mp4', 100));
		addLessonVideo(db, video(lesson.id, 'b.mp4', 250));
		addLessonVideo(db, video(other.id, 'c.mp4', 5));

		const rows = listLessons(db);
		expect(rows.find((r) => r.id === lesson.id)).toMatchObject({ videos: 2, videoBytes: 350 });
		expect(rows.find((r) => r.id === other.id)).toMatchObject({ videos: 1, videoBytes: 5 });
		expect(lessonVideoBytes(db)).toBe(355);
	});

	it('reports zero for a lesson with no videos, not null', () => {
		createLesson(db, lessonInput);
		expect(listLessons(db)[0]).toMatchObject({ videos: 0, videoBytes: 0 });
		expect(lessonVideoBytes(db)).toBe(0);
	});

	it('counts an archived lesson’s videos against the disk, because they are still on it', () => {
		const { lesson } = createLesson(db, lessonInput);
		addLessonVideo(db, video(lesson.id, 'a.mp4', 100));
		archiveLesson(db, lesson.id, 1000);
		expect(lessonVideoBytes(db)).toBe(100);
	});

	it('returns the deleted row once, so the caller can remove the file', () => {
		const { lesson } = createLesson(db, lessonInput);
		const row = addLessonVideo(db, video(lesson.id, 'a.mp4', 100));
		expect(deleteLessonVideo(db, row.id)?.file).toBe('a.mp4');
		expect(deleteLessonVideo(db, row.id)).toBeNull();
		expect(getLessonVideoByFile(db, 'a.mp4')).toBeNull();
	});

	it('finds a video by its file name, for the range-served route', () => {
		const { lesson } = createLesson(db, lessonInput);
		addLessonVideo(db, video(lesson.id, 'a.mp4', 100));
		expect(getLessonVideoByFile(db, 'a.mp4')?.lessonId).toBe(lesson.id);
	});
});

describe('listLessons', () => {
	it('orders by the day of the class, newest first', () => {
		createLesson(db, { ...lessonInput, lessonDay: '2026-09-01', title: 'First' });
		createLesson(db, { ...lessonInput, lessonDay: '2026-09-20', title: 'Latest' });
		createLesson(db, { ...lessonInput, lessonDay: '2026-09-10', title: 'Middle' });
		expect(listLessons(db).map((l) => l.title)).toEqual(['Latest', 'Middle', 'First']);
	});
});
