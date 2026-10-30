import {
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	ne,
	notInArray,
	or,
	sum
} from 'drizzle-orm';
import type { Db } from './db';
import { assertUnlinked } from './spot-links';
import { lessonsReaching, viaSections } from './lesson-links';
import {
	exercises,
	figureGroups,
	figures,
	lessonExercises,
	lessonFigures,
	lessonRoutines,
	lessonVideos,
	lessons,
	routines,
	spotLinks,
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

/**
 * The library: newest class first, with what its videos cost on disk and how
 * much is in it — sections, routines, figures. Each count is one grouped query
 * over the whole dance, keyed by lesson, so the list stays a fixed number of
 * queries however many lessons there are.
 */
export function listLessons(db: Db, dance: DanceSlug): LessonItem[] {
	const sections = new Map(
		db
			.select({ id: lessonVideos.lessonId, n: count(videoSpots.id) })
			.from(videoSpots)
			.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
			.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
			.where(and(eq(lessons.dance, dance), isNotNull(videoSpots.endMs)))
			.groupBy(lessonVideos.lessonId)
			.all()
			.map((r) => [r.id, r.n])
	);
	const routineCounts = new Map(
		db
			.select({ id: lessonRoutines.lessonId, n: count(routines.id) })
			.from(lessonRoutines)
			.innerJoin(routines, eq(routines.id, lessonRoutines.routineId))
			.where(and(eq(routines.dance, dance), isNull(routines.archivedAt)))
			.groupBy(lessonRoutines.lessonId)
			.all()
			.map((r) => [r.id, r.n])
	);
	// A figure is its group: two variations of one figure on a lesson count once.
	const hand = db
		.select({ id: lessonFigures.lessonId, group: figures.groupId })
		.from(lessonFigures)
		.innerJoin(figures, eq(figures.id, lessonFigures.figureId))
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt)))
		.all();
	const viaSection = db
		.select({ id: lessonVideos.lessonId, group: figures.groupId })
		.from(spotLinks)
		.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
		.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.innerJoin(figures, eq(figures.id, spotLinks.figureId))
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt)))
		.all();
	const figureGroupsOf = new Map<number, Set<number | null>>();
	for (const { id, group } of [...hand, ...viaSection]) {
		figureGroupsOf.set(id, (figureGroupsOf.get(id) ?? new Set()).add(group));
	}

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
		.map((r) => ({
			...r,
			videoBytes: Number(r.videoBytes ?? 0),
			sections: sections.get(r.id) ?? 0,
			routines: routineCounts.get(r.id) ?? 0,
			figures: figureGroupsOf.get(r.id)?.size ?? 0
		}));
}

/** Each lesson's day, by id, for Today's lesson rows. */
export function lessonDays(db: Db, dance: DanceSlug): Record<number, string> {
	return Object.fromEntries(
		db
			.select({ id: lessons.id, day: lessons.lessonDay })
			.from(lessons)
			.where(eq(lessons.dance, dance))
			.all()
			.map((r) => [r.id, r.day])
	);
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

/** The variation ids on a lesson: linked by hand or through its sections. */
function linkedFigureIds(db: Db, lessonId: number): number[] {
	const hand = db
		.select({ id: lessonFigures.figureId })
		.from(lessonFigures)
		.where(eq(lessonFigures.lessonId, lessonId))
		.all()
		.map((r) => r.id);
	return [...new Set([...hand, ...viaSections(db, lessonId).figures.keys()])];
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
			sourceUrl: lessonVideos.sourceUrl,
			createdAt: lessonVideos.createdAt
		})
		.from(lessonVideos)
		.where(eq(lessonVideos.lessonId, id))
		.orderBy(asc(lessonVideos.createdAt))
		.all();

	// Hand links and section links, merged: a variation linked both ways is one row.
	const via = viaSections(db, id);
	const figureColumns = {
		id: figures.id,
		figure: figureGroups.name,
		variation: figures.name,
		partner: figures.partner,
		style: figures.styleTag,
		exerciseId: exercises.id
	};
	const handFigures = db
		.select(figureColumns)
		.from(lessonFigures)
		.innerJoin(figures, eq(figures.id, lessonFigures.figureId))
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.leftJoin(exercises, eq(exercises.figureId, figures.id))
		.where(eq(lessonFigures.lessonId, id))
		.all();
	const handFigureIds = new Set(handFigures.map((r) => r.id));
	const sectionFigureIds = [...via.figures.keys()].filter((f) => !handFigureIds.has(f));
	const sectionFigures =
		sectionFigureIds.length === 0
			? []
			: db
					.select(figureColumns)
					.from(figures)
					.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
					.leftJoin(exercises, eq(exercises.figureId, figures.id))
					.where(inArray(figures.id, sectionFigureIds))
					.all();
	const linkedFigures: LessonFigureRow[] = [...handFigures, ...sectionFigures]
		.map(({ figure, variation, ...r }) => ({
			...r,
			name: `${figure} · ${variation}`,
			byHand: handFigureIds.has(r.id),
			viaSections: via.figures.get(r.id) ?? []
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

	const linkedRoutines: LessonRoutineRow[] = db
		.select({ id: routines.id, name: routines.name, exerciseId: exercises.id })
		.from(lessonRoutines)
		.innerJoin(routines, eq(routines.id, lessonRoutines.routineId))
		.leftJoin(exercises, eq(exercises.routineId, routines.id))
		.where(eq(lessonRoutines.lessonId, id))
		.orderBy(asc(routines.name))
		.all();

	const exerciseColumns = { id: exercises.id, name: exercises.name, source: exercises.source };
	const handExercises = db
		.select(exerciseColumns)
		.from(lessonExercises)
		.innerJoin(exercises, eq(exercises.id, lessonExercises.exerciseId))
		.where(and(eq(lessonExercises.lessonId, id), isNull(exercises.archivedAt)))
		.all();
	const handExerciseIds = new Set(handExercises.map((r) => r.id));
	const sectionExerciseIds = [...via.exercises.keys()].filter((e) => !handExerciseIds.has(e));
	const sectionExercises =
		sectionExerciseIds.length === 0
			? []
			: db
					.select(exerciseColumns)
					.from(exercises)
					.where(and(inArray(exercises.id, sectionExerciseIds), isNull(exercises.archivedAt)))
					.all();
	const linkedExercises: LessonExerciseRow[] = [...handExercises, ...sectionExercises]
		.map((r) => ({
			...r,
			byHand: handExerciseIds.has(r.id),
			viaSections: via.exercises.get(r.id) ?? []
		}))
		.sort((a, b) => a.name.localeCompare(b.name));

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
			.select({ id: figures.id, dance: figures.dance })
			.from(figures)
			.where(and(eq(figures.id, figureId), isNull(figures.archivedAt)))
			.get();
		if (!figure) return false;

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

/**
 * Take a variation off a lesson. With `alsoSections`, the links from this
 * lesson's videos' sections to it go too, in the same transaction — otherwise
 * a variation there through a section would stay on the lesson.
 */
export function unlinkFigure(
	db: Db,
	lessonId: number,
	figureId: number,
	alsoSections = false
): boolean {
	return db.transaction((tx) => {
		let changes = tx
			.delete(lessonFigures)
			.where(and(eq(lessonFigures.lessonId, lessonId), eq(lessonFigures.figureId, figureId)))
			.run().changes;
		if (alsoSections) {
			const spots = (viaSections(tx, lessonId).figures.get(figureId) ?? []).map((s) => s.spotId);
			if (spots.length > 0) {
				changes += tx
					.delete(spotLinks)
					.where(and(eq(spotLinks.figureId, figureId), inArray(spotLinks.spotId, spots)))
					.run().changes;
			}
		}
		return changes > 0;
	});
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
			// On the lesson through a section counts too: never in both places.
			if (viaSections(tx, lessonId).figures.has(exercise.figureId)) return false;
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

/** `unlinkFigure`, for a drill or any hand-linked exercise. */
export function unlinkExercise(
	db: Db,
	lessonId: number,
	exerciseId: number,
	alsoSections = false
): boolean {
	return db.transaction((tx) => {
		let changes = tx
			.delete(lessonExercises)
			.where(
				and(eq(lessonExercises.lessonId, lessonId), eq(lessonExercises.exerciseId, exerciseId))
			)
			.run().changes;
		if (alsoSections) {
			const spots = (viaSections(tx, lessonId).exercises.get(exerciseId) ?? []).map(
				(s) => s.spotId
			);
			if (spots.length > 0) {
				changes += tx
					.delete(spotLinks)
					.where(and(eq(spotLinks.exerciseId, exerciseId), inArray(spotLinks.spotId, spots)))
					.run().changes;
			}
		}
		return changes > 0;
	});
}

/** Live variations this lesson does not already link, by label. */
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
		isNull(figureGroups.archivedAt),
		eq(figures.dance, lesson.dance)
	];
	if (linked.length > 0) where.push(notInArray(figures.id, linked));
	return db
		.select({ id: figures.id, figure: figureGroups.name, variation: figures.name })
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(and(...where))
		.all()
		.map((r) => ({ id: r.id, name: `${r.figure} · ${r.variation}` }))
		.sort((a, b) => a.name.localeCompare(b.name));
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

	const alreadyLinked = [
		...db
			.select({ id: lessonExercises.exerciseId })
			.from(lessonExercises)
			.where(eq(lessonExercises.lessonId, lessonId))
			.all()
			.map((r) => r.id),
		...viaSections(db, lessonId).exercises.keys()
	];

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
 * video otherwise. Throws `SpotLinkedError`, deleting nothing, while one of its
 * sections is linked to a figure or drill.
 */
export function deleteLessonVideo(db: Db, id: number) {
	return db.transaction((tx) => {
		assertUnlinked(tx, { lessonVideoId: id });
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
	const ids = [
		...db
			.select({ id: lessonFigures.lessonId })
			.from(lessonFigures)
			.where(eq(lessonFigures.figureId, figureId))
			.all()
			.map((r) => r.id),
		// A section of one of the lesson's videos linked to it counts too.
		...lessonsReaching(db, { figureId })
	];
	if (ids.length === 0) return [];
	return db
		.select({ id: lessons.id, title: lessons.title, lessonDay: lessons.lessonDay })
		.from(lessons)
		.where(and(inArray(lessons.id, ids), isNull(lessons.archivedAt)))
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
