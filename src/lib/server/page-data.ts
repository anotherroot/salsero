/**
 * What a page needs to practise one exercise: the exercise as the page
 * reads it, its sets, and what the practice panel offers. Shared by
 * the exercise, figure and lesson pages; Today builds the same from the
 * lists it already loads.
 */
import { localDay } from '$lib/day/day';
import { shownExercise } from '$lib/exercises/name';
import type { Wall } from './scope';
import type { Db } from './db';
import { exerciseHistory, listExercises } from './exercises';
import { songChoices } from './songs';
import { listMusic } from './song-links';
import { exercises } from './db/schema';
import { eq } from 'drizzle-orm';
import type { MusicParent } from '$lib/types';

/**
 * The Music a practice of this exercise suggests (spec B): a drill's own, an
 * entry's drill's, a routine's or a lesson's. Null for anything else.
 */
function musicOf(db: Db, exerciseId: number): MusicParent | null {
	const e = db
		.select({
			source: exercises.source,
			drillId: exercises.drillId,
			routineId: exercises.routineId,
			lessonId: exercises.lessonId
		})
		.from(exercises)
		.where(eq(exercises.id, exerciseId))
		.get();
	if (!e) return null;
	if (e.source === 'custom') return { exerciseId };
	if (e.source === 'added' && e.drillId !== null) return { exerciseId: e.drillId };
	if (e.routineId !== null) return { routineId: e.routineId };
	if (e.lessonId !== null) return { lessonId: e.lessonId };
	return null;
}

export function pageData(db: Db, wall: Wall, exerciseId: number, tz: string, now: number) {
	const found = listExercises(db, wall).find((e) => e.id === exerciseId);
	if (!found) return null;
	// A lesson's own exercise is named in the reader's language.
	const exercise = shownExercise(found);
	const today = localDay(now, tz);
	return {
		exercise,
		// Fifty is far more sets than one day holds; the filter decides "today".
		sets: exerciseHistory(db, exerciseId, 50).filter((s) => localDay(s.doneAt, tz) === today),
		songs: markMusic(db, wall, exerciseId, exercise.name)
	};
}

/** The popup's songs, the row's own Music marked so the song popup lists it first. */
function markMusic(db: Db, wall: Wall, exerciseId: number, label: string) {
	const songs = songChoices(db, wall);
	const parent = musicOf(db, exerciseId);
	if (!parent) return songs;
	const rank = new Map(listMusic(db, parent, wall.userId).map((r, i) => [r.songId, i]));
	return songs.map((s) => (rank.has(s.id) ? { ...s, music: { label, rank: rank.get(s.id)! } } : s));
}
