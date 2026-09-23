import { and, asc, count, desc, eq, inArray, isNull, ne, notInArray, or, sum } from 'drizzle-orm';
import type { Db } from './db';
import {
	exercises,
	figures,
	lessonExercises,
	lessonFigures,
	lessonVideos,
	lessons
} from './db/schema';
import type { LessonExerciseRow, LessonFigureRow, LessonItem, LessonVideoRow } from '$lib/types';

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
export function createLesson(db: Db, input: LessonInput, everyDays = 3) {
	return db.transaction((tx) => {
		const lesson = tx.insert(lessons).values(input).returning().get();
		const exercise = tx
			.insert(exercises)
			.values({
				name: reviewName(lesson.title),
				source: 'lesson',
				lessonId: lesson.id,
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
export function listLessons(db: Db): LessonItem[] {
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
		.where(isNull(lessons.archivedAt))
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
			style: figures.style,
			exerciseId: exercises.id
		})
		.from(lessonFigures)
		.innerJoin(figures, eq(figures.id, lessonFigures.figureId))
		.leftJoin(exercises, eq(exercises.figureId, figures.id))
		.where(eq(lessonFigures.lessonId, id))
		.orderBy(asc(figures.name))
		.all();

	const linkedExercises: LessonExerciseRow[] = db
		.select({ id: exercises.id, name: exercises.name, source: exercises.source })
		.from(lessonExercises)
		.innerJoin(exercises, eq(exercises.id, lessonExercises.exerciseId))
		.where(and(eq(lessonExercises.lessonId, id), isNull(exercises.archivedAt)))
		.orderBy(asc(exercises.name))
		.all();

	// A linked figure's exercise belongs under the figure, never in this list.
	// `linkFigure` already sweeps it out on write; filtering here too means a row
	// that slipped in before the link cannot show up twice.
	const ownedByLinkedFigure = new Set(linkedFigures.map((f) => f.exerciseId));

	return {
		lesson,
		exercise,
		videos,
		figures: linkedFigures,
		exercises: linkedExercises.filter((e) => !ownedByLinkedFigure.has(e.id))
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
			.select({ id: figures.id })
			.from(figures)
			.where(and(eq(figures.id, figureId), isNull(figures.archivedAt)))
			.get();
		if (!figure) return false;

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
 * Attach an existing exercise by hand. Refuses one owned by a figure this
 * lesson already links — the other half of the "never in both places" rule.
 */
export function linkExercise(db: Db, lessonId: number, exerciseId: number): boolean {
	return db.transaction((tx) => {
		const exercise = tx
			.select({ id: exercises.id, figureId: exercises.figureId, lessonId: exercises.lessonId })
			.from(exercises)
			.where(and(eq(exercises.id, exerciseId), isNull(exercises.archivedAt)))
			.get();
		if (!exercise) return false;
		// A review exercise belongs to the lesson that created it, this one
		// included; it is never something a lesson "links".
		if (exercise.lessonId !== null) return false;
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
	const linked = linkedFigureIds(db, lessonId);
	const where = [isNull(figures.archivedAt)];
	if (linked.length > 0) where.push(notInArray(figures.id, linked));
	return db
		.select({ id: figures.id, name: figures.name })
		.from(figures)
		.where(and(...where))
		.orderBy(asc(figures.name))
		.all();
}

/**
 * Exercises this lesson could still link: not archived, not already linked,
 * not owned by one of its figures, and not any lesson's review exercise — a
 * review exercise belongs to the lesson that created it, and borrowing one
 * into a second lesson makes "whose is this?" unanswerable on screen.
 */
export function listLinkableExercises(db: Db, lessonId: number) {
	const alreadyLinked = db
		.select({ id: lessonExercises.exerciseId })
		.from(lessonExercises)
		.where(eq(lessonExercises.lessonId, lessonId))
		.all()
		.map((r) => r.id);

	const linkedFigures = linkedFigureIds(db, lessonId);

	const where = [isNull(exercises.archivedAt), ne(exercises.source, 'lesson')];
	if (alreadyLinked.length > 0) where.push(notInArray(exercises.id, alreadyLinked));
	if (linkedFigures.length > 0) {
		// `NOT IN` is null-propagating: a custom exercise has a null `figure_id`,
		// so `figure_id not in (…)` is NULL, not true, and would drop every custom
		// exercise from the picker. The explicit null arm is the whole point.
		where.push(or(isNull(exercises.figureId), notInArray(exercises.figureId, linkedFigures))!);
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

/** Delete a video row and return it, so the caller can remove the file. */
export function deleteLessonVideo(db: Db, id: number) {
	return db.delete(lessonVideos).where(eq(lessonVideos.id, id)).returning().get() ?? null;
}

export function getLessonVideoByFile(db: Db, file: string) {
	return db.select().from(lessonVideos).where(eq(lessonVideos.file, file)).get() ?? null;
}
