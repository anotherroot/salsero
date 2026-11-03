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
	linkRoutine,
	listLessons,
	listLinkableExercises,
	listLinkableFigures,
	listLinkableRoutines,
	reviewName,
	routineTaughtIn,
	unlinkExercise,
	unlinkFigure,
	unlinkRoutine,
	taughtIn,
	updateLesson
} from './lessons';
import {
	archiveExercise,
	createCustomExercise,
	getExercise,
	listExercises,
	updateExercise
} from './exercises';
import { addFigureExercise, archiveVariation, createFigure, createVariationFrom } from './figures';
import { addSpot } from './spots';
import { linkableSections, linkSpot, unlinkSpot } from './spot-links';
import { exercises, spotLinks } from './db/schema';
import { eq } from 'drizzle-orm';
import { archiveRoutine, createRoutine } from './routines';
import { T1_SALSA, U1_SALSA, U1_BACHATA } from '$lib/server/test-walls';

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
	figureName: 'Enchufla',
	name: 'Basic',
	partner: 'partner' as const,
	style: 'salsa' as const,
	notes: null
};
const video = (lessonId: number, file: string, sizeBytes: number) => ({
	lessonId,
	file,
	mime: 'video/mp4',
	sizeBytes
});

describe('createLesson', () => {
	it('creates the lesson and its review exercise together', () => {
		const { lesson, exercise } = createLesson(db, U1_SALSA, lessonInput);
		expect(lesson.title).toBe('Rueda basics');
		expect(exercise.name).toBe(reviewName('Rueda basics'));
		expect(exercise.source).toBe('lesson');
		expect(exercise.lessonId).toBe(lesson.id);
		expect(exercise.figureId).toBeNull();
	});

	it('puts the review exercise on Today with its lesson id', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const row = listExercises(db, U1_SALSA).find((e) => e.lessonId === lesson.id);
		expect(row?.partner).toBeNull();
		expect(row?.source).toBe('lesson');
	});

	it('rejects a day that is not YYYY-MM-DD', () => {
		expect(() => createLesson(db, U1_SALSA, { ...lessonInput, lessonDay: '22/09/2026' })).toThrow();
	});
});

describe('updateLesson', () => {
	it('carries a retitle over to the review exercise', () => {
		const { lesson, exercise } = createLesson(db, U1_SALSA, lessonInput);
		updateLesson(db, lesson.id, { ...lessonInput, title: 'Rueda, week 2' });
		const after = getLesson(db, lesson.id, 'u1');
		expect(after?.exercise?.name).toBe(reviewName('Rueda, week 2'));
		expect(after?.exercise?.id).toBe(exercise.id);
	});

	it('returns null for a lesson that does not exist', () => {
		expect(updateLesson(db, 999, lessonInput)).toBeNull();
	});
});

describe('archiveLesson', () => {
	it('archives the lesson and its exercise, and keeps the videos', () => {
		const { lesson, exercise } = createLesson(db, U1_SALSA, lessonInput);
		addLessonVideo(db, video(lesson.id, 'a.mp4', 10));

		expect(archiveLesson(db, lesson.id, 1000)).toBe(true);
		expect(listLessons(db, U1_SALSA)).toHaveLength(0);
		expect(listExercises(db, U1_SALSA).some((e) => e.id === exercise.id)).toBe(false);
		expect(getLesson(db, lesson.id, 'u1')?.videos).toHaveLength(1);
	});

	it('refuses to archive twice', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		expect(archiveLesson(db, lesson.id, 1000)).toBe(true);
		expect(archiveLesson(db, lesson.id, 2000)).toBe(false);
	});
});

describe('a lesson owns its review exercise', () => {
	it('refuses to archive it through archiveExercise', () => {
		const { exercise } = createLesson(db, U1_SALSA, lessonInput);
		expect(archiveExercise(db, exercise.id, 1000)).toBe(false);
	});

	it('ignores a name submitted for it, the way a figure exercise does', () => {
		const { exercise } = createLesson(db, U1_SALSA, lessonInput);
		const after = updateExercise(db, exercise.id, {
			name: 'Something else',
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
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const exercise = addFigureExercise(db, 'u1', figure.id)!;

		expect(linkFigure(db, lesson.id, figure.id)).toBe(true);
		const [linked] = getLesson(db, lesson.id, 'u1')!.figures;
		expect(linked.name).toBe('Enchufla · Basic');
		expect(linked.exerciseId).toBe(exercise.id);
	});

	it('lists a linked figure that has no exercise, with a null exerciseId', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		expect(linkFigure(db, lesson.id, figure.id)).toBe(true);
		expect(getLesson(db, lesson.id, 'u1')!.figures).toMatchObject([
			{ id: figure.id, exerciseId: null }
		]);
	});

	it('refuses a second link of the same figure', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		expect(linkFigure(db, lesson.id, figure.id)).toBe(true);
		expect(linkFigure(db, lesson.id, figure.id)).toBe(false);
		expect(getLesson(db, lesson.id, 'u1')!.figures).toHaveLength(1);
	});

	it('links a variation', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const doble = createVariationFrom(db, figure.id, 'Doble')!;
		expect(linkFigure(db, lesson.id, doble.id)).toBe(true);
		expect(taughtIn(db, U1_SALSA, doble.id).map((l) => l.id)).toEqual([lesson.id]);
	});

	it('does not teach its sibling', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const doble = createVariationFrom(db, figure.id, 'Doble')!;
		linkFigure(db, lesson.id, doble.id);
		expect(taughtIn(db, U1_SALSA, figure.id)).toEqual([]);
	});

	it('refuses an archived figure', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		db.run(`update figures set archived_at = 1 where id = ${figure.id}`);
		expect(linkFigure(db, lesson.id, figure.id)).toBe(false);
	});

	it('unlinks, and reports whether there was anything to unlink', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		linkFigure(db, lesson.id, figure.id);
		expect(unlinkFigure(db, lesson.id, figure.id)).toBe(true);
		expect(unlinkFigure(db, lesson.id, figure.id)).toBe(false);
	});
});

describe('a figure exercise never shows up in both places', () => {
	it('drops it from the linked list when its figure is linked afterwards', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const exercise = addFigureExercise(db, 'u1', figure.id)!;

		expect(linkExercise(db, lesson.id, exercise.id)).toBe(true);
		expect(getLesson(db, lesson.id, 'u1')!.exercises.map((e) => e.id)).toEqual([exercise.id]);

		linkFigure(db, lesson.id, figure.id);
		const after = getLesson(db, lesson.id, 'u1')!;
		expect(after.exercises).toHaveLength(0);
		expect(after.figures[0].exerciseId).toBe(exercise.id);
	});

	it('refuses to link it once its figure is already linked', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const exercise = addFigureExercise(db, 'u1', figure.id)!;
		linkFigure(db, lesson.id, figure.id);
		expect(linkExercise(db, lesson.id, exercise.id)).toBe(false);
	});
});

describe('frequencies on the lesson page', () => {
	it('lists a linked routine and a linked drill with their frequencies', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { routine } = createRoutine(db, U1_SALSA, { name: 'Rueda combo', notes: null });
		db.update(exercises).set({ everyDays: 7 }).where(eq(exercises.routineId, routine.id)).run();
		const custom = createCustomExercise(db, U1_SALSA, { name: 'Drill', everyDays: 1, notes: null });
		linkRoutine(db, lesson.id, routine.id);
		linkExercise(db, lesson.id, custom.id);

		const got = getLesson(db, lesson.id, 'u1')!;
		expect(got.routines[0].everyDays).toBe(7);
		expect(got.exercises[0].everyDays).toBe(1);
	});
});

describe('linking exercises', () => {
	it('links a custom exercise and unlinks it again', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const custom = createCustomExercise(db, U1_SALSA, {
			name: 'Son basic',
			everyDays: 3,
			notes: null
		});

		expect(linkExercise(db, lesson.id, custom.id)).toBe(true);
		expect(getLesson(db, lesson.id, 'u1')!.exercises.map((e) => e.name)).toEqual(['Son basic']);
		expect(unlinkExercise(db, lesson.id, custom.id)).toBe(true);
		expect(getLesson(db, lesson.id, 'u1')!.exercises).toHaveLength(0);
	});

	it('refuses a review exercise, including its own', () => {
		const { lesson, exercise } = createLesson(db, U1_SALSA, lessonInput);
		const other = createLesson(db, U1_SALSA, { ...lessonInput, title: 'Other' });
		expect(linkExercise(db, lesson.id, exercise.id)).toBe(false);
		expect(linkExercise(db, lesson.id, other.exercise.id)).toBe(false);
	});

	it('refuses an archived exercise', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const custom = createCustomExercise(db, U1_SALSA, {
			name: 'Son basic',
			everyDays: 3,
			notes: null
		});
		archiveExercise(db, custom.id, 1000);
		expect(linkExercise(db, lesson.id, custom.id)).toBe(false);
	});
});

describe('the link pickers', () => {
	it('listLinkableFigures: a hand-linked variation is present with linked true', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const a = createFigure(db, U1_SALSA, figureInput)!.figure;
		linkFigure(db, lesson.id, a.id);
		expect(listLinkableFigures(db, lesson.id)).toEqual([
			expect.objectContaining({ id: a.id, label: 'Enchufla · Basic', linked: true })
		]);
	});

	it('listLinkableFigures: other live variations of the dance are linked false; archived ones absent', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const a = createFigure(db, U1_SALSA, figureInput)!.figure;
		const b = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Dile que no' })!.figure;
		const c = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Old' })!.figure;
		archiveVariation(db, c.id, 1000);
		linkFigure(db, lesson.id, a.id);
		expect(listLinkableFigures(db, lesson.id).map((f) => [f.id, f.linked])).toEqual([
			[b.id, false],
			[a.id, true]
		]);
	});

	it('lists variations to link by label', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		createVariationFrom(db, figure.id, 'Doble');
		expect(listLinkableFigures(db, lesson.id).map((f) => f.label)).toEqual([
			'Enchufla · Basic',
			'Enchufla · Doble'
		]);
	});

	it('keeps custom exercises in the picker once a figure is linked', () => {
		// The null-propagating `NOT IN` bug would empty this list entirely.
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const custom = createCustomExercise(db, U1_SALSA, {
			name: 'Son basic',
			everyDays: 3,
			notes: null
		});
		linkFigure(db, lesson.id, figure.id);

		expect(listLinkableExercises(db, lesson.id).map((e) => e.id)).toEqual([custom.id]);
	});

	it('listLinkableExercises: a linked drill is present with linked true', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const linked = createCustomExercise(db, U1_SALSA, {
			name: 'Linked',
			everyDays: 3,
			notes: null
		});
		const free = createCustomExercise(db, U1_SALSA, { name: 'Free', everyDays: 3, notes: null });
		linkExercise(db, lesson.id, linked.id);
		expect(listLinkableExercises(db, lesson.id)).toEqual([
			expect.objectContaining({ id: free.id, linked: false, everyDays: 3, source: 'custom' }),
			expect.objectContaining({ id: linked.id, linked: true })
		]);
	});

	it('listLinkableExercises: a figure exercise carries figure and variation names', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		const own = addFigureExercise(db, 'u1', figure.id)!;
		expect(listLinkableExercises(db, lesson.id)).toEqual([
			expect.objectContaining({
				id: own.id,
				source: 'figure',
				figure: 'Enchufla',
				variation: 'Basic',
				linked: false
			})
		]);
	});

	it("listLinkableExercises: another lesson's review exercise and the exercise of a linked figure stay absent", () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		createLesson(db, U1_SALSA, { ...lessonInput, title: 'Other' });
		const { figure } = createFigure(db, U1_SALSA, figureInput)!;
		addFigureExercise(db, 'u1', figure.id);
		linkFigure(db, lesson.id, figure.id);
		const gone = createCustomExercise(db, U1_SALSA, {
			name: 'Archived',
			everyDays: 3,
			notes: null
		});
		const free = createCustomExercise(db, U1_SALSA, { name: 'Free', everyDays: 3, notes: null });
		archiveExercise(db, gone.id, 1000);
		expect(listLinkableExercises(db, lesson.id).map((e) => e.id)).toEqual([free.id]);
	});

	it('leaves out archived and any lesson review exercise', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		createLesson(db, U1_SALSA, { ...lessonInput, title: 'Other' });
		const linked = createCustomExercise(db, U1_SALSA, {
			name: 'Linked',
			everyDays: 3,
			notes: null
		});
		const gone = createCustomExercise(db, U1_SALSA, {
			name: 'Archived',
			everyDays: 3,
			notes: null
		});
		const free = createCustomExercise(db, U1_SALSA, { name: 'Free', everyDays: 3, notes: null });

		linkExercise(db, lesson.id, linked.id);
		archiveExercise(db, gone.id, 1000);

		expect(
			listLinkableExercises(db, lesson.id)
				.filter((e) => !e.linked)
				.map((e) => e.id)
		).toEqual([free.id]);
	});
});

describe('videos', () => {
	it('lists them per lesson and totals their bytes', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const other = createLesson(db, U1_SALSA, { ...lessonInput, title: 'Other' }).lesson;
		addLessonVideo(db, video(lesson.id, 'a.mp4', 100));
		addLessonVideo(db, video(lesson.id, 'b.mp4', 250));
		addLessonVideo(db, video(other.id, 'c.mp4', 5));

		const rows = listLessons(db, U1_SALSA);
		expect(rows.find((r) => r.id === lesson.id)).toMatchObject({ videos: 2, videoBytes: 350 });
		expect(rows.find((r) => r.id === other.id)).toMatchObject({ videos: 1, videoBytes: 5 });
		expect(lessonVideoBytes(db, 'u1')).toBe(355);
	});

	it('reports zero for a lesson with no videos, not null', () => {
		createLesson(db, U1_SALSA, lessonInput);
		expect(listLessons(db, U1_SALSA)[0]).toMatchObject({ videos: 0, videoBytes: 0 });
		expect(lessonVideoBytes(db, 'u1')).toBe(0);
	});

	it('counts an archived lesson’s videos against the disk, because they are still on it', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		addLessonVideo(db, video(lesson.id, 'a.mp4', 100));
		archiveLesson(db, lesson.id, 1000);
		expect(lessonVideoBytes(db, 'u1')).toBe(100);
	});

	it('returns the deleted row once, so the caller can remove the file', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const row = addLessonVideo(db, video(lesson.id, 'a.mp4', 100));
		expect(deleteLessonVideo(db, row.id)?.file).toBe('a.mp4');
		expect(deleteLessonVideo(db, row.id)).toBeNull();
		expect(getLessonVideoByFile(db, 'a.mp4')).toBeNull();
	});

	it('finds a video by its file name, for the range-served route', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		addLessonVideo(db, video(lesson.id, 'a.mp4', 100));
		expect(getLessonVideoByFile(db, 'a.mp4')?.lessonId).toBe(lesson.id);
	});
});

describe('listLessons', () => {
	it('orders by the day of the class, newest first', () => {
		createLesson(db, U1_SALSA, { ...lessonInput, lessonDay: '2026-09-01', title: 'First' });
		createLesson(db, U1_SALSA, { ...lessonInput, lessonDay: '2026-09-20', title: 'Latest' });
		createLesson(db, U1_SALSA, { ...lessonInput, lessonDay: '2026-09-10', title: 'Middle' });
		expect(listLessons(db, U1_SALSA).map((l) => l.title)).toEqual(['Latest', 'Middle', 'First']);
	});

	it('reports zero sections, routines and figures for a bare lesson', () => {
		createLesson(db, U1_SALSA, lessonInput);
		expect(listLessons(db, U1_SALSA)[0]).toMatchObject({ sections: 0, routines: 0, figures: 0 });
	});

	it('counts sections on its videos, not points and not other lessons’ sections', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const other = createLesson(db, U1_SALSA, { ...lessonInput, title: 'Other' }).lesson;
		const v1 = addLessonVideo(db, video(lesson.id, 'a.mp4', 1)).id;
		const v2 = addLessonVideo(db, video(lesson.id, 'b.mp4', 1)).id;
		const v3 = addLessonVideo(db, video(other.id, 'c.mp4', 1)).id;
		addSpot(db, { lessonVideoId: v1 }, { startMs: 0, endMs: 1000, label: null });
		addSpot(db, { lessonVideoId: v2 }, { startMs: 0, endMs: 1000, label: null });
		addSpot(db, { lessonVideoId: v2 }, { startMs: 5000, endMs: null, label: null });
		addSpot(db, { lessonVideoId: v3 }, { startMs: 0, endMs: 1000, label: null });

		const rows = listLessons(db, U1_SALSA);
		expect(rows.find((r) => r.id === lesson.id)?.sections).toBe(2);
		expect(rows.find((r) => r.id === other.id)?.sections).toBe(1);
	});

	it('counts live linked routines', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const kept = createRoutine(db, U1_SALSA, { name: 'Kept', notes: null }).routine;
		const gone = createRoutine(db, U1_SALSA, { name: 'Gone', notes: null }).routine;
		linkRoutine(db, lesson.id, kept.id);
		linkRoutine(db, lesson.id, gone.id);
		archiveRoutine(db, gone.id, 1000);
		expect(listLessons(db, U1_SALSA)[0].routines).toBe(1);
	});

	it('counts figures once, whether linked by hand or through a section, leaving archived variations out', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const basic = createFigure(db, U1_SALSA, figureInput)!.figure.id;
		const doble = createVariationFrom(db, basic, 'Doble')!.id;
		const setenta = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Setenta' })!.figure
			.id;
		const vacilala = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Vacilala' })!.figure
			.id;
		const videoId = addLessonVideo(db, video(lesson.id, 'a.mp4', 1)).id;
		const spot = addSpot(db, { lessonVideoId: videoId }, { startMs: 0, endMs: 1000, label: null })!;

		// Enchufla twice — Basic by hand, Doble through a section — counts once.
		linkFigure(db, lesson.id, basic);
		linkSpot(db, 'u1', spot.id, { figureId: doble });
		linkSpot(db, 'u1', spot.id, { figureId: setenta });
		linkFigure(db, lesson.id, vacilala);
		archiveVariation(db, vacilala, 1000);

		expect(listLessons(db, U1_SALSA)[0].figures).toBe(2);
	});
});

describe('lessons are walled off by dance', () => {
	const lessonInput = { lessonDay: '2026-09-01', title: 'Tuesday class', notes: null };

	it('lists only its own dance and gives the review exercise that dance', () => {
		createLesson(db, U1_SALSA, lessonInput);
		const b = createLesson(db, U1_BACHATA, { ...lessonInput, title: 'Bachata class' });

		expect(listLessons(db, U1_SALSA).map((l) => l.title)).toEqual(['Tuesday class']);
		expect(listLessons(db, U1_BACHATA).map((l) => l.title)).toEqual(['Bachata class']);
		expect(getExercise(db, b.exercise.id)?.dance).toBe('bachata');
	});

	it('refuses to link a figure from another dance', () => {
		const lesson = createLesson(db, U1_BACHATA, lessonInput);
		const salsaFigure = createFigure(db, U1_SALSA, {
			figureName: 'Dile que no',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;

		expect(linkFigure(db, lesson.lesson.id, salsaFigure.figure.id)).toBe(false);
		expect(listLinkableFigures(db, lesson.lesson.id)).toEqual([]);
	});

	it('refuses to link an exercise from another dance', () => {
		// The route action (`[id]/+page.server.ts`) checks the LESSON's dance via
		// `lessonOf`, but passes `exerciseId` straight through from the form body
		// — this clause in `linkExercise` is the only thing standing between a
		// bachata lesson and a salsa exercise id posted at it by hand.
		const lesson = createLesson(db, U1_BACHATA, lessonInput);
		const salsaExercise = createCustomExercise(db, U1_SALSA, {
			name: 'Salsa footwork',
			everyDays: 2,
			notes: null
		});

		expect(linkExercise(db, lesson.lesson.id, salsaExercise.id)).toBe(false);
	});

	it('offers only its own dance exercises to link', () => {
		const lesson = createLesson(db, U1_BACHATA, lessonInput);
		createCustomExercise(db, U1_SALSA, { name: 'Salsa footwork', everyDays: 2, notes: null });
		const own = createCustomExercise(db, U1_BACHATA, {
			name: 'Bachata footwork',
			everyDays: 2,
			notes: null
		});

		expect(listLinkableExercises(db, lesson.lesson.id).map((e) => e.id)).toEqual([own.id]);
	});
});

describe('linking routines', () => {
	const routineInput = { name: 'Rueda combo', notes: null };

	it('links a routine and lists it with the exercise that came with it', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { routine, exercise } = createRoutine(db, U1_SALSA, routineInput);

		expect(linkRoutine(db, lesson.id, routine.id)).toBe(true);
		expect(getLesson(db, lesson.id, 'u1')!.routines).toEqual([
			{
				id: routine.id,
				name: 'Rueda combo',
				exerciseId: exercise.id,
				everyDays: exercise.everyDays
			}
		]);
	});

	it('refuses a second link of the same routine', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { routine } = createRoutine(db, U1_SALSA, routineInput);
		expect(linkRoutine(db, lesson.id, routine.id)).toBe(true);
		expect(linkRoutine(db, lesson.id, routine.id)).toBe(false);
		expect(getLesson(db, lesson.id, 'u1')!.routines).toHaveLength(1);
	});

	it('refuses an archived routine, and one that does not exist', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { routine } = createRoutine(db, U1_SALSA, routineInput);
		archiveRoutine(db, routine.id, 1000);
		expect(linkRoutine(db, lesson.id, routine.id)).toBe(false);
		expect(linkRoutine(db, lesson.id, 999)).toBe(false);
	});

	it('refuses a routine from another dance', () => {
		const { lesson } = createLesson(db, U1_BACHATA, lessonInput);
		const { routine } = createRoutine(db, U1_SALSA, routineInput);
		expect(linkRoutine(db, lesson.id, routine.id)).toBe(false);
		expect(listLinkableRoutines(db, lesson.id)).toEqual([]);
	});

	it('unlinks, and reports whether there was anything to unlink', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { routine } = createRoutine(db, U1_SALSA, routineInput);
		linkRoutine(db, lesson.id, routine.id);
		expect(unlinkRoutine(db, lesson.id, routine.id)).toBe(true);
		expect(unlinkRoutine(db, lesson.id, routine.id)).toBe(false);
		expect(getLesson(db, lesson.id, 'u1')!.routines).toHaveLength(0);
	});

	it('listLinkableRoutines: a linked routine is present with linked true and carries slots and loops', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const a = createRoutine(db, U1_SALSA, routineInput).routine;
		linkRoutine(db, lesson.id, a.id);
		expect(listLinkableRoutines(db, lesson.id)).toEqual([
			{ id: a.id, name: 'Rueda combo', slots: 0, loops: false, linked: true }
		]);
	});

	it('offers only unarchived routines', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const a = createRoutine(db, U1_SALSA, routineInput).routine;
		const b = createRoutine(db, U1_SALSA, { name: 'Shines', notes: null }).routine;
		const gone = createRoutine(db, U1_SALSA, { name: 'Old combo', notes: null }).routine;
		archiveRoutine(db, gone.id, 1000);

		linkRoutine(db, lesson.id, a.id);
		expect(listLinkableRoutines(db, lesson.id).map((r) => [r.id, r.linked])).toEqual([
			[a.id, true],
			[b.id, false]
		]);
	});
});

describe('a routine exercise never shows up in both places', () => {
	const routineInput = { name: 'Rueda combo', notes: null };

	it('drops it from the linked list when its routine is linked afterwards', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { routine, exercise } = createRoutine(db, U1_SALSA, routineInput);

		expect(linkExercise(db, lesson.id, exercise.id)).toBe(true);
		linkRoutine(db, lesson.id, routine.id);

		const after = getLesson(db, lesson.id, 'u1')!;
		expect(after.exercises).toHaveLength(0);
		expect(after.routines[0].exerciseId).toBe(exercise.id);
	});

	it('refuses to link it once its routine is already linked', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { routine, exercise } = createRoutine(db, U1_SALSA, routineInput);
		linkRoutine(db, lesson.id, routine.id);
		expect(linkExercise(db, lesson.id, exercise.id)).toBe(false);
	});

	it('hides it on read even if a row predates the link', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { routine, exercise } = createRoutine(db, U1_SALSA, routineInput);
		linkRoutine(db, lesson.id, routine.id);
		db.run(
			`insert into lesson_exercises (lesson_id, exercise_id, created_at) values (${lesson.id}, ${exercise.id}, 0)`
		);
		expect(getLesson(db, lesson.id, 'u1')!.exercises).toHaveLength(0);
	});

	it('leaves its exercise out of the picker once its routine is linked', () => {
		const { lesson } = createLesson(db, U1_SALSA, lessonInput);
		const { routine, exercise } = createRoutine(db, U1_SALSA, routineInput);
		const custom = createCustomExercise(db, U1_SALSA, {
			name: 'Son basic',
			everyDays: 3,
			notes: null
		});

		expect(listLinkableExercises(db, lesson.id).map((e) => e.id)).toContain(exercise.id);
		linkRoutine(db, lesson.id, routine.id);
		// The null arm again: a custom exercise has a null `routine_id`.
		expect(listLinkableExercises(db, lesson.id).map((e) => e.id)).toEqual([custom.id]);
	});
});

describe('routineTaughtIn', () => {
	it('lists the lessons that link a routine, newest first, without archived ones', () => {
		const { routine } = createRoutine(db, U1_SALSA, { name: 'Rueda combo', notes: null });
		const older = createLesson(db, U1_SALSA, { ...lessonInput, lessonDay: '2026-09-01' }).lesson;
		const newer = createLesson(db, U1_SALSA, { ...lessonInput, lessonDay: '2026-09-15' }).lesson;
		const gone = createLesson(db, U1_SALSA, { ...lessonInput, lessonDay: '2026-09-20' }).lesson;
		for (const l of [older, newer, gone]) linkRoutine(db, l.id, routine.id);
		archiveLesson(db, gone.id, 1000);

		expect(routineTaughtIn(db, U1_SALSA, routine.id).map((l) => l.id)).toEqual([
			newer.id,
			older.id
		]);
	});
});

describe('through sections', () => {
	let lessonId: number;
	let basic: number;
	let doble: number;
	let drill: number;
	let a: number;
	let b: number;

	beforeEach(() => {
		lessonId = createLesson(db, U1_SALSA, lessonInput).lesson.id;
		basic = createFigure(db, U1_SALSA, figureInput)!.figure.id;
		doble = createVariationFrom(db, basic, 'Doble')!.id;
		drill = createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 3, notes: null }).id;
		const videoId = addLessonVideo(db, video(lessonId, 'l.mp4', 1)).id;
		a = addSpot(db, { lessonVideoId: videoId }, { startMs: 1000, endMs: 4000, label: null })!.id;
		b = addSpot(db, { lessonVideoId: videoId }, { startMs: 6000, endMs: 9000, label: 'B' })!.id;
	});

	const figuresOf = () => getLesson(db, lessonId, 'u1')!.figures;
	const exercisesOf = () => getLesson(db, lessonId, 'u1')!.exercises;
	const spotLinkCount = () => db.select().from(spotLinks).all().length;

	it('lists a variation linked only through a section, and drops it with the link', () => {
		const link = linkSpot(db, 'u1', a, { figureId: doble });
		expect(figuresOf()).toEqual([
			expect.objectContaining({
				id: doble,
				name: 'Enchufla · Doble',
				byHand: false,
				viaSections: [{ spotId: a, startMs: 1000, endMs: 4000, label: null }]
			})
		]);
		unlinkSpot(db, link, { figureId: doble });
		expect(figuresOf()).toEqual([]);
	});

	it('shows a hand-linked variation that is also linked through a section once', () => {
		linkFigure(db, lessonId, doble);
		linkSpot(db, 'u1', a, { figureId: doble });
		const rows = figuresOf();
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ id: doble, byHand: true });
		expect(rows[0].viaSections).toHaveLength(1);
	});

	it('marks a hand-only row', () => {
		linkFigure(db, lessonId, basic);
		expect(figuresOf()[0]).toMatchObject({ byHand: true, viaSections: [] });
	});

	it('keeps an archived variation, as a hand-linked one is kept', () => {
		linkSpot(db, 'u1', a, { figureId: doble });
		archiveVariation(db, doble, 1);
		expect(figuresOf().map((f) => f.id)).toEqual([doble]);
	});

	it('lists a drill linked through a section, and not once it is archived', () => {
		linkSpot(db, 'u1', a, { exerciseId: drill });
		expect(exercisesOf()).toEqual([
			expect.objectContaining({ id: drill, byHand: false, viaSections: [expect.anything()] })
		]);
		archiveExercise(db, drill, 1);
		expect(exercisesOf()).toEqual([]);
	});

	it("never shows a variation's own exercise beside it when the variation came through a section", () => {
		const own = addFigureExercise(db, 'u1', doble)!.id;
		expect(linkExercise(db, lessonId, own)).toBe(true);
		linkSpot(db, 'u1', a, { figureId: doble });
		expect(exercisesOf().map((e) => e.id)).not.toContain(own);
	});

	it("refuses to hand-link a variation's exercise while the variation is there through a section", () => {
		const own = addFigureExercise(db, 'u1', doble)!.id;
		linkSpot(db, 'u1', a, { figureId: doble });
		expect(linkExercise(db, lessonId, own)).toBe(false);
		expect(listLinkableExercises(db, lessonId).map((e) => e.id)).not.toContain(own);
	});

	it('listLinkableFigures: a variation linked through a section is present with linked true', () => {
		linkSpot(db, 'u1', a, { figureId: doble });
		linkSpot(db, 'u1', a, { exerciseId: drill });
		expect(listLinkableFigures(db, lessonId).find((f) => f.id === doble)?.linked).toBe(true);
		expect(listLinkableFigures(db, lessonId).find((f) => f.id === basic)?.linked).toBe(false);
		expect(listLinkableExercises(db, lessonId).find((e) => e.id === drill)?.linked).toBe(true);
	});

	it("counts the lesson in the variation's Taught in, unless the lesson is archived", () => {
		linkSpot(db, 'u1', a, { figureId: doble });
		expect(taughtIn(db, U1_SALSA, doble).map((l) => l.id)).toEqual([lessonId]);
		archiveLesson(db, lessonId, 1);
		expect(taughtIn(db, U1_SALSA, doble)).toEqual([]);
	});

	it('puts the lesson first in the link sheet when a section of it links the variation', () => {
		const other = createLesson(db, U1_SALSA, { ...lessonInput, lessonDay: '2026-10-01' }).lesson.id;
		const otherVideo = addLessonVideo(db, video(other, 'o.mp4', 1)).id;
		addSpot(db, { lessonVideoId: otherVideo }, { startMs: 0, endMs: 2000, label: null });
		linkSpot(db, 'u1', a, { figureId: doble });
		const groups = linkableSections(db, { figureId: doble });
		expect(groups[0]).toMatchObject({ taughtHere: true });
		expect(groups[0].video.from).toMatchObject({ kind: 'lesson', lessonId });
	});

	it('unlinks the hand link and every section link with alsoSections', () => {
		linkFigure(db, lessonId, doble);
		linkSpot(db, 'u1', a, { figureId: doble });
		linkSpot(db, 'u1', b, { figureId: doble });
		expect(unlinkFigure(db, lessonId, doble, true)).toBe(true);
		expect(figuresOf()).toEqual([]);
		expect(spotLinkCount()).toBe(0);
	});

	it('unlinks only the hand link without alsoSections', () => {
		linkFigure(db, lessonId, doble);
		linkSpot(db, 'u1', a, { figureId: doble });
		expect(unlinkFigure(db, lessonId, doble)).toBe(true);
		expect(figuresOf()).toEqual([expect.objectContaining({ id: doble, byHand: false })]);
		expect(spotLinkCount()).toBe(1);
	});

	it('removes a section-only variation with alsoSections', () => {
		linkSpot(db, 'u1', a, { figureId: doble });
		expect(unlinkFigure(db, lessonId, doble, true)).toBe(true);
		expect(figuresOf()).toEqual([]);
	});

	it('does the same for a drill', () => {
		linkExercise(db, lessonId, drill);
		linkSpot(db, 'u1', a, { exerciseId: drill });
		expect(unlinkExercise(db, lessonId, drill)).toBe(true);
		expect(exercisesOf()).toEqual([expect.objectContaining({ id: drill, byHand: false })]);
		expect(unlinkExercise(db, lessonId, drill, true)).toBe(true);
		expect(exercisesOf()).toEqual([]);
		expect(spotLinkCount()).toBe(0);
	});
});

describe('in a group', () => {
	const figureInput = { name: 'Basic', partner: 'partner' as const, style: 'salsa', notes: null };

	it('creates a lesson owned by the team, with no exercise', () => {
		const made = createLesson(db, T1_SALSA, lessonInput);
		expect(made.lesson).toMatchObject({ userId: null, teamId: 1 });
		expect(made.exercise).toBeNull();
		expect(db.select().from(exercises).all()).toEqual([]);
		expect(listLessons(db, U1_SALSA)).toEqual([]);
		expect(listLessons(db, T1_SALSA).map((l) => l.title)).toEqual(['Rueda basics']);
	});

	it('refuses a figure, routine or drill of another owner', () => {
		const lessonId = createLesson(db, T1_SALSA, lessonInput).lesson.id;
		const mine = createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Enchufla' })!.figure;
		const routine = createRoutine(db, U1_SALSA, { name: 'R', notes: null }).routine;
		const drill = createCustomExercise(db, U1_SALSA, { name: 'Clave', everyDays: 3, notes: null });
		expect(linkFigure(db, lessonId, mine.id)).toBe(false);
		expect(linkRoutine(db, lessonId, routine.id)).toBe(false);
		expect(linkExercise(db, lessonId, drill.id)).toBe(false);
		expect(listLinkableFigures(db, lessonId)).toEqual([]);
		expect(listLinkableRoutines(db, lessonId)).toEqual([]);
		expect(listLinkableExercises(db, lessonId)).toEqual([]);

		const theirs = createFigure(db, T1_SALSA, { ...figureInput, figureName: 'Enchufla' })!.figure;
		const teamDrill = createCustomExercise(db, T1_SALSA, {
			name: 'Clave',
			everyDays: 3,
			notes: null
		});
		expect(linkFigure(db, lessonId, theirs.id, 'u1')).toBe(true);
		expect(linkExercise(db, lessonId, teamDrill.id, 'u1')).toBe(true);
	});

	it("judges an entry by its target's owner, not its own", () => {
		const mineLesson = createLesson(db, U1_SALSA, lessonInput).lesson.id;
		const teamFigure = createFigure(db, T1_SALSA, {
			...figureInput,
			figureName: 'Enchufla'
		})!.figure;
		// u1's own entry for the group's figure: u1's row, the group's target.
		const entry = db
			.insert(exercises)
			.values({ name: 'Enchufla · Basic', source: 'figure', figureId: teamFigure.id, userId: 'u1' })
			.returning()
			.get();
		expect(linkExercise(db, mineLesson, entry.id)).toBe(false);
		expect(listLinkableExercises(db, mineLesson).map((e) => e.id)).not.toContain(entry.id);
	});
});

import { listTeamLessons, publishLesson } from './lessons';
import { createTeam, deleteTeam, joinTeam, setRole } from './teams';
import { linkOptionsFor } from './link-popup';
import { lessons as lessonRows } from './db/schema';

describe('a group lesson: draft and publish', () => {
	let teamId: number;
	const T = () => ({ dance: 'salsa' as const, teamId, actorId: 'u1' });
	const row = (id: number) => db.select().from(lessonRows).where(eq(lessonRows.id, id)).get()!;

	beforeEach(() => {
		const made = createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
		if (!made.ok) throw new Error('team expected');
		teamId = made.teamId;
		joinTeam(db, 'u2', teamId, 2);
		joinTeam(db, 'u3', teamId, 2);
		setRole(db, teamId, 'u3', 'editor');
	});

	it('starts a draft, and only its editors publish it, once', () => {
		const { lesson, exercise } = createLesson(db, T(), lessonInput);
		expect([lesson.publishedAt, exercise]).toEqual([null, null]);
		expect(publishLesson(db, { ...T(), actorId: 'u2' }, lesson.id, 5)).toBe(false);
		expect(publishLesson(db, { ...T(), actorId: 'u9' }, lesson.id, 5)).toBe(false);
		expect(row(lesson.id).publishedAt).toBeNull();
		expect(publishLesson(db, { ...T(), actorId: 'u3' }, lesson.id, 5)).toBe(true);
		expect(row(lesson.id).publishedAt).toBe(5);
		// No unpublish, and no second publish moving the date.
		expect(publishLesson(db, T(), lesson.id, 9)).toBe(false);
		expect(row(lesson.id).publishedAt).toBe(5);
	});

	it("publishes only this group's live drafts", () => {
		const other = createTeam(db, 'u1', 'salsa', 'Another', 1);
		if (!other.ok) throw new Error('team expected');
		const theirs = createLesson(db, { ...T(), teamId: other.teamId }, lessonInput).lesson.id;
		const mine = createLesson(db, U1_SALSA, lessonInput).lesson.id;
		const archived = createLesson(db, T(), lessonInput).lesson.id;
		archiveLesson(db, archived, 3, 'u1');
		expect(publishLesson(db, T(), theirs, 5)).toBe(false);
		expect(publishLesson(db, T(), mine, 5)).toBe(false);
		expect(publishLesson(db, T(), archived, 5)).toBe(false);
		expect([row(theirs), row(mine), row(archived)].map((l) => l.publishedAt)).toEqual([
			null,
			null,
			null
		]);
	});

	it('a deleted group publishes nothing', () => {
		const id = createLesson(db, T(), lessonInput).lesson.id;
		deleteTeam(db, teamId, 'u1', 2);
		expect(publishLesson(db, T(), id, 5)).toBe(false);
	});

	it('lists drafts first to its editors, newest first, and only published lessons to members', () => {
		const older = createLesson(db, T(), { ...lessonInput, lessonDay: '2026-09-01' }).lesson.id;
		const newer = createLesson(db, T(), { ...lessonInput, lessonDay: '2026-09-20' }).lesson.id;
		const draft = createLesson(db, T(), { ...lessonInput, lessonDay: '2026-09-10' }).lesson.id;
		publishLesson(db, T(), older, 1);
		publishLesson(db, T(), newer, 2);
		const forEditor = listTeamLessons(db, 'u3', teamId, 'editor');
		expect(forEditor.map((l) => [l.id, l.publishedAt !== null])).toEqual([
			[draft, false],
			[newer, true],
			[older, true]
		]);
		expect(forEditor[0].team).toEqual({ id: teamId, name: 'Salsa nadaljevalna' });
		expect(listTeamLessons(db, 'u2', teamId, 'member').map((l) => l.id)).toEqual([newer, older]);
		// A person's own list never shows a group's lesson, and its rows say so.
		expect(listLessons(db, U1_SALSA)).toEqual([]);
		createLesson(db, U1_SALSA, lessonInput);
		expect(listLessons(db, U1_SALSA).map((l) => l.team)).toEqual([null]);
	});

	it("the Link popup in a group lesson offers only the group's things", () => {
		createFigure(db, U1_SALSA, { ...figureInput, figureName: 'Mine only' });
		createCustomExercise(db, U1_SALSA, { name: 'My drill', everyDays: 3, notes: null });
		const groupFigure = createFigure(db, T(), { ...figureInput, figureName: 'Group figure' })!;
		const groupDrill = createCustomExercise(db, T(), {
			name: 'Group drill',
			everyDays: 3,
			notes: null
		});
		const id = createLesson(db, T(), lessonInput).lesson.id;
		const video = addLessonVideo(db, video_(id), 'u1');
		const section = addSpot(
			db,
			{ lessonVideoId: video.id },
			{ startMs: 0, endMs: 9, label: 'S' },
			'u1'
		)!;

		const options = linkOptionsFor(db, section.id, 'u1')!;
		const offered = [...options.near, ...options.figures, ...options.drills].map((o) => o.label);
		expect(offered).toContain('Group figure · Basic');
		expect(offered).toContain('Group drill');
		expect(offered.join()).not.toContain('Mine only');
		expect(offered).not.toContain('My drill');
		expect(options.figureChoices.map((f) => f.name)).toEqual(['Group figure']);
		expect([groupFigure.figure.teamId, groupDrill.teamId]).toEqual([teamId, teamId]);
		// A member reads the section but may not link it: no options at all.
		expect(linkOptionsFor(db, section.id, 'u2')).toBeNull();
	});
});

const video_ = (lessonId: number) => ({
	lessonId,
	file: '00000000-0000-4000-8000-0000000000f1.mp4',
	mime: 'video/mp4',
	sizeBytes: 1
});
