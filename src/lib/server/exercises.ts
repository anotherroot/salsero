import { and, count, desc, eq, gte, isNotNull, isNull, lt, sql, sum } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures, sets, songs } from './db/schema';
import type { DanceSlug } from '$lib/dances/dances';
import type { PracticeInput } from '$lib/exercises/practice';
import type { DaySet, ExerciseItem, ExerciseSummary, HistorySet } from '$lib/types';

/** Every exercise that has not been archived, with its figure's partner flag. */
export function listExercises(db: Db, dance: DanceSlug): ExerciseItem[] {
	return db
		.select({
			id: exercises.id,
			name: exercises.name,
			source: exercises.source,
			figureId: exercises.figureId,
			lessonId: exercises.lessonId,
			routineId: exercises.routineId,
			partner: figures.partner,
			practiceMode: exercises.practiceMode,
			songId: exercises.songId,
			countBpm: exercises.countBpm,
			practiceJson: exercises.practiceJson,
			everyDays: exercises.everyDays,
			active: exercises.active,
			notes: exercises.notes,
			createdAt: exercises.createdAt
		})
		.from(exercises)
		.leftJoin(figures, eq(figures.id, exercises.figureId))
		.where(and(isNull(exercises.archivedAt), eq(exercises.dance, dance)))
		.all()
		.map((r) => ({ ...r, archived: false }));
}

/**
 * The (exercise, time) pairs urgency is computed from, for ONE dance. The join
 * is how a set knows its dance: `sets` carries no `dance` column on purpose —
 * it would be a second copy of a fact that can drift.
 */
export function listSetTimes(db: Db, dance: DanceSlug): { exerciseId: number; doneAt: number }[] {
	return db
		.select({ exerciseId: sets.exerciseId, doneAt: sets.doneAt })
		.from(sets)
		.innerJoin(exercises, eq(exercises.id, sets.exerciseId))
		.where(eq(exercises.dance, dance))
		.all();
}

export function getExercise(db: Db, id: number) {
	return db.select().from(exercises).where(eq(exercises.id, id)).get() ?? null;
}

/** What the exercise page's settings form edits. Practice choices are the panel's, not these. */
export interface SettingsInput {
	name: string;
	everyDays: number;
	active: boolean;
	notes: string | null;
}

export function createCustomExercise(
	db: Db,
	dance: DanceSlug,
	input: Omit<SettingsInput, 'active'>
) {
	return db
		.insert(exercises)
		.values({ ...input, source: 'custom', dance })
		.returning()
		.get();
}

/**
 * Edit an exercise's settings. An owned exercise takes its NAME from its owner
 * (figure, lesson, routine), so a name passed for one is ignored rather than
 * letting the two drift apart.
 */
export function updateExercise(db: Db, id: number, input: SettingsInput) {
	const current = db.select().from(exercises).where(eq(exercises.id, id)).get();
	if (!current) return null;
	const name = current.source === 'custom' && input.name ? input.name : current.name;
	return db
		.update(exercises)
		.set({ ...input, name })
		.where(eq(exercises.id, id))
		.returning()
		.get();
}

/**
 * Remember what the practice panel played. A song must be READY and in the
 * exercise's own dance: the pairing has no CHECK to lean on (see `schema.ts`),
 * and a stored song the panel cannot open would greet the user with an error
 * the next time. `parsePracticeInput` has already cleared the unused half of
 * the mode's pair.
 */
export function setPracticeSettings(db: Db, id: number, input: PracticeInput): boolean {
	const current = db.select().from(exercises).where(eq(exercises.id, id)).get();
	if (!current) return false;
	if (input.mode === 'song') {
		const song =
			input.songId === null
				? null
				: db.select().from(songs).where(eq(songs.id, input.songId)).get();
		if (
			!song ||
			song.dance !== current.dance ||
			song.status !== 'ready' ||
			song.archivedAt !== null
		) {
			return false;
		}
	}
	db.update(exercises)
		.set({
			practiceMode: input.mode,
			songId: input.songId,
			countBpm: input.countBpm,
			practiceJson: JSON.stringify(input.config)
		})
		.where(eq(exercises.id, id))
		.run();
	return true;
}

/**
 * Archive a custom exercise. Figure exercises are archived through their
 * figure (`archiveFigure`), which keeps the pair in step; refusing here is
 * what stops a live figure from losing its exercise.
 */
export function archiveExercise(db: Db, id: number, now: number): boolean {
	const res = db
		.update(exercises)
		.set({ archivedAt: now })
		.where(and(eq(exercises.id, id), eq(exercises.source, 'custom')))
		.run();
	return res.changes > 0;
}

export interface SetInput {
	exerciseId: number;
	doneAt: number;
	durationS: number | null;
	reps: number | null;
	rating: number | null;
	note: string | null;
	playerJson: string | null;
}

export function logSet(db: Db, input: SetInput) {
	return db.insert(sets).values(input).returning().get();
}

/**
 * One set by id. A set carries no dance of its own — it belongs to the dance of
 * its exercise — so this is how a route resolves the one from the other before
 * touching it (see `src/lib/server/scope.ts`).
 */
export function getSet(db: Db, id: number) {
	return db.select().from(sets).where(eq(sets.id, id)).get() ?? null;
}

export function deleteSet(db: Db, id: number): boolean {
	return db.delete(sets).where(eq(sets.id, id)).run().changes > 0;
}

/**
 * Sets whose instant falls in `[from, to)`, newest first. The caller widens the
 * window around a calendar day and filters with `localDay`, so which day a set
 * belongs to is decided in one place, in the user's zone.
 */
export function listSetsBetween(db: Db, from: number, to: number, dance: DanceSlug): DaySet[] {
	return db
		.select({
			id: sets.id,
			exerciseId: sets.exerciseId,
			exerciseName: exercises.name,
			doneAt: sets.doneAt,
			durationS: sets.durationS,
			reps: sets.reps,
			rating: sets.rating,
			note: sets.note
		})
		.from(sets)
		.innerJoin(exercises, eq(exercises.id, sets.exerciseId))
		.where(and(gte(sets.doneAt, from), lt(sets.doneAt, to), eq(exercises.dance, dance)))
		.orderBy(desc(sets.doneAt))
		.all();
}

const historyRow = {
	id: sets.id,
	doneAt: sets.doneAt,
	durationS: sets.durationS,
	reps: sets.reps,
	rating: sets.rating,
	note: sets.note
};

/** An exercise's sets, newest first. The page shows the latest `limit`; the summary counts all. */
export function exerciseHistory(db: Db, id: number, limit = 200): HistorySet[] {
	return db
		.select(historyRow)
		.from(sets)
		.where(eq(sets.exerciseId, id))
		.orderBy(desc(sets.doneAt), desc(sets.id))
		.limit(limit)
		.all();
}

/** How many ratings "recent" means on the summary line. */
const RECENT_RATED = 5;

export function exerciseSummary(db: Db, id: number): ExerciseSummary {
	const totals = db
		.select({ sets: count(), totalS: sum(sets.durationS) })
		.from(sets)
		.where(eq(sets.exerciseId, id))
		.get();
	const rated = db
		.select({ rating: sets.rating })
		.from(sets)
		.where(and(eq(sets.exerciseId, id), isNotNull(sets.rating)))
		.orderBy(desc(sets.doneAt))
		.limit(RECENT_RATED)
		.all();
	const mean =
		rated.length === 0 ? null : rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length;
	return {
		sets: totals?.sets ?? 0,
		totalS: Number(totals?.totalS ?? 0),
		recentRating: mean === null ? null : Math.round(mean * 10) / 10
	};
}

/**
 * The latest set of every exercise in one dance — for the rating dots on
 * Today's rows. One grouped query rather than one per row.
 *
 * Relies on SQLite's documented bare-column rule: in a query with exactly one
 * `max()` aggregate, the other selected columns come from the row holding that
 * maximum. Two sets at the same millisecond pick either, which is fine.
 */
export function lastSets(db: Db, dance: DanceSlug): Map<number, HistorySet> {
	const rows = db.all<HistorySet & { exerciseId: number }>(sql`
		select s.exercise_id as exerciseId, s.id as id, max(s.done_at) as doneAt,
		       s.duration_s as durationS, s.reps as reps, s.rating as rating, s.note as note
		from sets s join exercises e on e.id = s.exercise_id
		where e.dance = ${dance}
		group by s.exercise_id`);
	return new Map(rows.map(({ exerciseId, ...set }) => [exerciseId, set]));
}

export function lastSet(db: Db, exerciseId: number): HistorySet | null {
	return exerciseHistory(db, exerciseId, 1)[0] ?? null;
}
