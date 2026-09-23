import { and, desc, eq, gte, isNull, lt } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures, sets } from './db/schema';
import type { PracticeMode } from '$lib/labels';
import type { DaySet, ExerciseItem } from '$lib/types';

/** Every exercise that has not been archived, with its figure's partner flag. */
export function listExercises(db: Db): ExerciseItem[] {
	return db
		.select({
			id: exercises.id,
			name: exercises.name,
			source: exercises.source,
			figureId: exercises.figureId,
			lessonId: exercises.lessonId,
			partner: figures.partner,
			practiceMode: exercises.practiceMode,
			songId: exercises.songId,
			countBpm: exercises.countBpm,
			everyDays: exercises.everyDays,
			active: exercises.active,
			notes: exercises.notes,
			createdAt: exercises.createdAt
		})
		.from(exercises)
		.leftJoin(figures, eq(figures.id, exercises.figureId))
		.where(isNull(exercises.archivedAt))
		.all()
		.map((r) => ({ ...r, archived: false }));
}

/**
 * The (exercise, time) pairs urgency is computed from. All of them: one person
 * logging a few sets a day stays in the low thousands of rows for years, and
 * reading two integer columns off an index is cheaper than being clever.
 */
export function listSetTimes(db: Db): { exerciseId: number; doneAt: number }[] {
	return db.select({ exerciseId: sets.exerciseId, doneAt: sets.doneAt }).from(sets).all();
}

export function getExercise(db: Db, id: number) {
	return db.select().from(exercises).where(eq(exercises.id, id)).get() ?? null;
}

export interface ExerciseInput {
	name: string;
	practiceMode: PracticeMode;
	songId: number | null;
	countBpm: number | null;
	everyDays: number;
	active: boolean;
	notes: string | null;
}

export function createCustomExercise(
	db: Db,
	input: Omit<ExerciseInput, 'active' | 'practiceMode' | 'songId' | 'countBpm'>
) {
	return db
		.insert(exercises)
		.values({ ...input, source: 'custom' })
		.returning()
		.get();
}

/**
 * Edit an exercise. A figure's exercise takes its NAME from the figure, so a
 * name passed for one is ignored rather than letting the two drift apart.
 *
 * SQLite can't enforce the song/count pairing with a CHECK on this table (see
 * `schema.ts`), so it's enforced here: whichever column the mode doesn't use
 * is cleared, whatever the form submitted for it.
 */
export function updateExercise(db: Db, id: number, input: ExerciseInput) {
	const current = db.select().from(exercises).where(eq(exercises.id, id)).get();
	if (!current) return null;
	const name = current.source === 'custom' && input.name ? input.name : current.name;
	const songId = input.practiceMode === 'song' ? input.songId : null;
	const countBpm = input.practiceMode === 'count' ? input.countBpm : null;
	return db
		.update(exercises)
		.set({ ...input, name, songId, countBpm })
		.where(eq(exercises.id, id))
		.returning()
		.get();
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

export function deleteSet(db: Db, id: number): boolean {
	return db.delete(sets).where(eq(sets.id, id)).run().changes > 0;
}

/**
 * Sets whose instant falls in `[from, to)`, newest first. The caller widens the
 * window around a calendar day and filters with `localDay`, so which day a set
 * belongs to is decided in one place, in the user's zone.
 */
export function listSetsBetween(db: Db, from: number, to: number): DaySet[] {
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
		.where(and(gte(sets.doneAt, from), lt(sets.doneAt, to)))
		.orderBy(desc(sets.doneAt))
		.all();
}
