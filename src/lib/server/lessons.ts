import { and, asc, count, desc, eq, inArray, isNull, ne, notInArray, or, sum } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	figures,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessonVideos,
	lessons,
	routines,
	videoSpots
} from './db/schema';
import type { DanceSlug } from '$lib/dances/dances';
import type {
	LessonExerciseRow,
	LessonFigureRow,
	LessonItem,
	LessonRoutineRow,
	LessonVideoRow
} from '$lib/types';

export interface LessonInput {
	/** The local day the class happened, `YYYY-MM-DD`. */
	lessonDay: string;
	title: string;
	notes: string | null;
}

export interface LessonVideoInput {
	lessonId: number;
	file: string;
	mime: string;
	sizeBytes: number;
}

/**
 * What the lesson's own exercise is called on Today. Prefixed so a lesson and
 * the figures it taught never read as the same kind of thing in the list.
 */
export function reviewName(title: string): string {
	return `Review: ${title}`;
}

/**
 * Create a lesson AND its review exercise, in one transaction — the same rule
 * `createFigure` follows. A lesson with nothing on Today is a lesson you never
 * go back to, which is the one thing this feature exists to prevent.
 */
export function createLesson(db: Db, dance: DanceSlug, input: LessonInput, everyDays = 3) {
	return db.transaction((tx) => {
		const lesson = tx
			.insert(lessons)
			.values({ ...input, dance })
			.returning()
			.get();
		const exercise = tx
			.insert(exercises)
			.values({
				name: reviewName(lesson.title),
				source: 'lesson',
				lessonId: lesson.id,
				dance,
				everyDays
			})
			.returning()
			.get();
		return { lesson, exercise };
	});
}

/** Edit a lesson. A retitle carries over to its exercise so the two never drift. */
export function updateLesson(db: Db, id: number, input: LessonInput) {
	return db.transaction((tx) => {
		const lesson = tx.update(lessons).set(input).where(eq(lessons.id, id)).returning().get();
		if (!lesson) return null;
		tx.update(exercises)
			.set({ name: reviewName(lesson.title) })
			.where(eq(exercises.lessonId, id))
			.run();
		return lesson;
	});
}

/** Archive a lesson and its review exercise together. Videos, links and sets stay. */
export function archiveLesson(db: Db, id: number, now: number): boolean {
	return db.transaction((tx) => {
		const res = tx
			.update(lessons)
			.set({ archivedAt: now })
			.where(and(eq(lessons.id, id), isNull(lessons.archivedAt)))
			.run();
		if (res.changes === 0) return false;
		tx.update(exercises).set({ archivedAt: now }).where(eq(exercises.lessonId, id)).run();
		return true;
	});
}

/** The library: newest class first, with what its videos cost on disk. */
export function listLessons(db: Db, dance: DanceSlug): LessonItem[] {
	return db
		.select({
			id: lessons.id,
			lessonDay: lessons.lessonDay,
			title: lessons.title,
			videos: count(lessonVideos.id),
			// `sum` is null when a lesson has no videos; the cast keeps the shape honest.
			videoBytes: sum(lessonVideos.sizeBytes),
			createdAt: lessons.createdAt
		})
		.from(lessons)
		.leftJoin(lessonVideos, eq(lessonVideos.lessonId, lessons.id))
		.where(and(isNull(lessons.archivedAt), eq(lessons.dance, dance)))
		.groupBy(lessons.id)
		.orderBy(desc(lessons.lessonDay), desc(lessons.id))
		.all()
		.map((r) => ({ ...r, videoBytes: Number(r.videoBytes ?? 0) }));
}

/**
 * Every byte lesson videos occupy, archived lessons included — an archived
 * lesson's video is still on a disk that is 80% full, so the readout must say
 * so. See `MAX_LESSON_VIDEO_BYTES` in `src/lib/limits.ts`.
 */
export function lessonVideoBytes(db: Db): number {
	const row = db
		.select({ total: sum(lessonVideos.sizeBytes) })
		.from(lessonVideos)
		.get();
	return Number(row?.total ?? 0);
}

/** The figure ids linked to a lesson. */
function linkedFigureIds(db: Db, lessonId: number): number[] {
	return db
		.select({ id: lessonFigures.figureId })
		.from(lessonFigures)
		.where(eq(lessonFigures.lessonId, lessonId))
		.all()
		.map((r) => r.id);
}

/** The routine ids linked to a lesson. */
function linkedRoutineIds(db: Db, lessonId: number): number[] {
	return db
		.select({ id: lessonRoutines.routineId })
		.from(lessonRoutines)
		.where(eq(lessonRoutines.lessonId, lessonId))
		.all()
		.map((r) => r.id);
}

export function getLesson(db: Db, id: number) {
	const lesson = db.select().from(lessons).where(eq(lessons.id, id)).get();
	if (!lesson) return null;

	const exercise = db.select().from(exercises).where(eq(exercises.lessonId, id)).get() ?? null;

	const videos: LessonVideoRow[] = db
		.select({
			id: lessonVideos.id,
			file: lessonVideos.file,
			mime: lessonVideos.mime,
			sizeBytes: lessonVideos.sizeBytes,
			createdAt: lessonVideos.createdAt
		})
		.from(lessonVideos)
		.where(eq(lessonVideos.lessonId, id))
		.orderBy(asc(lessonVideos.createdAt))
		.all();

	const linkedFigures: LessonFigureRow[] = db
		.select({
			id: figures.id,
			name: figures.name,
			partner: figures.partner,
			style: figures.styleTag,
			exerciseId: exercises.id
		})
		.from(lessonFigures)
		.innerJoin(figures, eq(figures.id, lessonFigures.figureId))
		.leftJoin(exercises, eq(exercises.figureId, figures.id))
		.where(eq(lessonFigures.lessonId, id))
		.orderBy(asc(figures.name))
		.all();

	const linkedRoutines: LessonRoutineRow[] = db
		.select({ id: routines.id, name: routines.name, exerciseId: exercises.id })
		.from(lessonRoutines)
		.innerJoin(routines, eq(routines.id, lessonRoutines.routineId))
		.leftJoin(exercises, eq(exercises.routineId, routines.id))
		.where(eq(lessonRoutines.lessonId, id))
		.orderBy(asc(routines.name))
		.all();

	const linkedExercises: LessonExerciseRow[] = db
		.select({ id: exercises.id, name: exercises.name, source: exercises.source })
		.from(lessonExercises)
		.innerJoin(exercises, eq(exercises.id, lessonExercises.exerciseId))
		.where(and(eq(lessonExercises.lessonId, id), isNull(exercises.archivedAt)))
		.orderBy(asc(exercises.name))
		.all();

	// A linked figure's or routine's exercise belongs under it, never in this
	// list. `linkFigure` and `linkRoutine` already sweep it out on write;
	// filtering here too means a row that slipped in before the link cannot show
	// up twice.
	const ownedByLinked = new Set([
		...linkedFigures.map((f) => f.exerciseId),
		...linkedRoutines.map((r) => r.exerciseId)
	]);

	return {
		lesson,
		exercise,
		videos,
		figures: linkedFigures,
		routines: linkedRoutines,
		exercises: linkedExercises.filter((e) => !ownedByLinked.has(e.id))
	};
}

/**
 * Link a figure, and drop its exercise from the hand-linked list in the same
 * transaction — a figure's exercise is shown under the figure, and showing it
 * in both places is the thing this feature was asked not to do.
 */
export function linkFigure(db: Db, lessonId: number, figureId: number): boolean {
	return db.transaction((tx) => {
		const figure = tx
			.select({ id: figures.id, dance: figures.dance, parentId: figures.parentId })
			.from(figures)
			.where(and(eq(figures.id, figureId), isNull(figures.archivedAt)))
			.get();
		// A lesson teaches the figure; its variations are reached through it.
		if (!figure || figure.parentId !== null) return false;

		const lesson = tx
			.select({ dance: lessons.dance })
			.from(lessons)
			.where(eq(lessons.id, lessonId))
			.get();
		// A lesson and a figure from different dances must never join: the wall
		// is the point, and no CHECK can express it (see `schema.ts`).
		if (!lesson || lesson.dance !== figure.dance) return false;

		const res = tx.insert(lessonFigures).values({ lessonId, figureId }).onConflictDoNothing().run();
		if (res.changes === 0) return false;

		const owned = tx
			.select({ id: exercises.id })
			.from(exercises)
			.where(eq(exercises.figureId, figureId))
			.all()
			.map((r) => r.id);
		if (owned.length > 0) {
			tx.delete(lessonExercises)
				.where(
					and(eq(lessonExercises.lessonId, lessonId), inArray(lessonExercises.exerciseId, owned))
				)
				.run();
		}
		return true;
	});
}

export function unlinkFigure(db: Db, lessonId: number, figureId: number): boolean {
	return (
		db
			.delete(lessonFigures)
			.where(and(eq(lessonFigures.lessonId, lessonId), eq(lessonFigures.figureId, figureId)))
			.run().changes > 0
	);
}

/**
 * Link a routine — `linkFigure`'s twin. A routine owns its exercise the way a
 * figure does, so linking one sweeps that exercise out of the hand-linked list
 * in the same transaction.
 */
export function linkRoutine(db: Db, lessonId: number, routineId: number): boolean {
	return db.transaction((tx) => {
		const routine = tx
			.select({ id: routines.id, dance: routines.dance })
			.from(routines)
			.where(and(eq(routines.id, routineId), isNull(routines.archivedAt)))
			.get();
		if (!routine) return false;

		const lesson = tx
			.select({ dance: lessons.dance })
			.from(lessons)
			.where(eq(lessons.id, lessonId))
			.get();
		// The dance wall, as in `linkFigure`: the route checks the lesson's dance,
		// and this is the only check on the routine id posted with it.
		if (!lesson || lesson.dance !== routine.dance) return false;

		const res = tx
			.insert(lessonRoutines)
			.values({ lessonId, routineId })
			.onConflictDoNothing()
			.run();
		if (res.changes === 0) return false;

		const owned = tx
			.select({ id: exercises.id })
			.from(exercises)
			.where(eq(exercises.routineId, routineId))
			.all()
			.map((r) => r.id);
		if (owned.length > 0) {
			tx.delete(lessonExercises)
				.where(
					and(eq(lessonExercises.lessonId, lessonId), inArray(lessonExercises.exerciseId, owned))
				)
				.run();
		}
		return true;
	});
}

export function unlinkRoutine(db: Db, lessonId: number, routineId: number): boolean {
	return (
		db
			.delete(lessonRoutines)
			.where(and(eq(lessonRoutines.lessonId, lessonId), eq(lessonRoutines.routineId, routineId)))
			.run().changes > 0
	);
}

/**
 * Attach an existing exercise by hand. Refuses one owned by a figure or routine
 * this lesson already links — the other half of the "never in both places" rule.
 */
export function linkExercise(db: Db, lessonId: number, exerciseId: number): boolean {
	return db.transaction((tx) => {
		const exercise = tx
			.select({
				id: exercises.id,
				dance: exercises.dance,
				figureId: exercises.figureId,
				routineId: exercises.routineId,
				lessonId: exercises.lessonId
			})
			.from(exercises)
			.where(and(eq(exercises.id, exerciseId), isNull(exercises.archivedAt)))
			.get();
		if (!exercise) return false;
		// A review exercise belongs to the lesson that created it, this one
		// included; it is never something a lesson "links".
		if (exercise.lessonId !== null) return false;

		const lesson = tx
			.select({ dance: lessons.dance })
			.from(lessons)
			.where(eq(lessons.id, lessonId))
			.get();
		// A lesson and an exercise from different dances must never join: the wall
		// is the point, and no CHECK can express it (see `schema.ts`).
		if (!lesson || lesson.dance !== exercise.dance) return false;

		if (exercise.figureId !== null) {
			const linked = tx
				.select({ figureId: lessonFigures.figureId })
				.from(lessonFigures)
				.where(
					and(eq(lessonFigures.lessonId, lessonId), eq(lessonFigures.figureId, exercise.figureId))
				)
				.get();
			if (linked) return false;
		}
		if (exercise.routineId !== null) {
			const linked = tx
				.select({ routineId: lessonRoutines.routineId })
				.from(lessonRoutines)
				.where(
					and(
						eq(lessonRoutines.lessonId, lessonId),
						eq(lessonRoutines.routineId, exercise.routineId)
					)
				)
				.get();
			if (linked) return false;
		}
		return (
			tx.insert(lessonExercises).values({ lessonId, exerciseId }).onConflictDoNothing().run()
				.changes > 0
		);
	});
}

export function unlinkExercise(db: Db, lessonId: number, exerciseId: number): boolean {
	return (
		db
			.delete(lessonExercises)
			.where(
				and(eq(lessonExercises.lessonId, lessonId), eq(lessonExercises.exerciseId, exerciseId))
			)
			.run().changes > 0
	);
}

/** Unarchived figures this lesson does not already link, alphabetical. */
export function listLinkableFigures(db: Db, lessonId: number) {
	const lesson = db
		.select({ dance: lessons.dance })
		.from(lessons)
		.where(eq(lessons.id, lessonId))
		.get();
	if (!lesson) return [];

	const linked = linkedFigureIds(db, lessonId);
	const where = [
		isNull(figures.archivedAt),
		isNull(figures.parentId),
		eq(figures.dance, lesson.dance)
	];
	if (linked.length > 0) where.push(notInArray(figures.id, linked));
	return db
		.select({ id: figures.id, name: figures.name })
		.from(figures)
		.where(and(...where))
		.orderBy(asc(figures.name))
		.all();
}

/** Unarchived routines this lesson does not already link, alphabetical. */
export function listLinkableRoutines(db: Db, lessonId: number) {
	const lesson = db
		.select({ dance: lessons.dance })
		.from(lessons)
		.where(eq(lessons.id, lessonId))
		.get();
	if (!lesson) return [];

	const linked = linkedRoutineIds(db, lessonId);
	const where = [isNull(routines.archivedAt), eq(routines.dance, lesson.dance)];
	if (linked.length > 0) where.push(notInArray(routines.id, linked));
	return db
		.select({ id: routines.id, name: routines.name })
		.from(routines)
		.where(and(...where))
		.orderBy(asc(routines.name))
		.all();
}

/**
 * Exercises this lesson could still link: not archived, not already linked,
 * not owned by one of its figures or routines, and not any lesson's review exercise — a
 * review exercise belongs to the lesson that created it, and borrowing one
 * into a second lesson makes "whose is this?" unanswerable on screen.
 */
export function listLinkableExercises(db: Db, lessonId: number) {
	const lesson = db
		.select({ dance: lessons.dance })
		.from(lessons)
		.where(eq(lessons.id, lessonId))
		.get();
	if (!lesson) return [];

	const alreadyLinked = db
		.select({ id: lessonExercises.exerciseId })
		.from(lessonExercises)
		.where(eq(lessonExercises.lessonId, lessonId))
		.all()
		.map((r) => r.id);

	const linkedFigures = linkedFigureIds(db, lessonId);

	const where = [
		isNull(exercises.archivedAt),
		ne(exercises.source, 'lesson'),
		eq(exercises.dance, lesson.dance)
	];
	if (alreadyLinked.length > 0) where.push(notInArray(exercises.id, alreadyLinked));
	if (linkedFigures.length > 0) {
		// `NOT IN` is null-propagating: a custom exercise has a null `figure_id`,
		// so `figure_id not in (…)` is NULL, not true, and would drop every custom
		// exercise from the picker. The explicit null arm is the whole point.
		where.push(or(isNull(exercises.figureId), notInArray(exercises.figureId, linkedFigures))!);
	}
	const linkedRoutines = linkedRoutineIds(db, lessonId);
	if (linkedRoutines.length > 0) {
		// The same null arm, for the same reason.
		where.push(or(isNull(exercises.routineId), notInArray(exercises.routineId, linkedRoutines))!);
	}

	return db
		.select({ id: exercises.id, name: exercises.name, source: exercises.source })
		.from(exercises)
		.where(and(...where))
		.orderBy(asc(exercises.name))
		.all();
}

export function addLessonVideo(db: Db, input: LessonVideoInput) {
	return db.insert(lessonVideos).values(input).returning().get();
}

/**
 * Delete a video row and return it, so the caller can remove the file. Its
 * spots go first, in the same transaction — the foreign key would refuse the
 * video otherwise.
 */
export function deleteLessonVideo(db: Db, id: number) {
	return db.transaction((tx) => {
		tx.delete(videoSpots).where(eq(videoSpots.lessonVideoId, id)).run();
		return tx.delete(lessonVideos).where(eq(lessonVideos.id, id)).returning().get() ?? null;
	});
}

export function getLessonVideoByFile(db: Db, file: string) {
	return db.select().from(lessonVideos).where(eq(lessonVideos.file, file)).get() ?? null;
}

/**
 * The lessons that taught a figure — the lesson→figure link read from the
 * figure's side, which until now only the lesson page could show. Archived
 * lessons are gone from every list, so they are gone from this one.
 */
export function taughtIn(db: Db, figureId: number) {
	return db
		.select({ id: lessons.id, title: lessons.title, lessonDay: lessons.lessonDay })
		.from(lessonFigures)
		.innerJoin(lessons, eq(lessons.id, lessonFigures.lessonId))
		.where(and(eq(lessonFigures.figureId, figureId), isNull(lessons.archivedAt)))
		.orderBy(desc(lessons.lessonDay), desc(lessons.id))
		.all();
}

/** `taughtIn`, for a routine: the lessons that link it, newest class first. */
export function routineTaughtIn(db: Db, routineId: number) {
	return db
		.select({ id: lessons.id, title: lessons.title, lessonDay: lessons.lessonDay })
		.from(lessonRoutines)
		.innerJoin(lessons, eq(lessons.id, lessonRoutines.lessonId))
		.where(and(eq(lessonRoutines.routineId, routineId), isNull(lessons.archivedAt)))
		.orderBy(desc(lessons.lessonDay), desc(lessons.id))
		.all();
}
