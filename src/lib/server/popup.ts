/**
 * What a page needs to open a log popup for one exercise: the exercise as the
 * popup reads it, today's sets, and what the practice panel offers. Shared by
 * the exercise, figure and lesson pages; Today builds the same from the
 * lists it already loads.
 */
import { PHRASE_PATTERNS } from '$lib/labels';
import { localDay } from '$lib/day/day';
import type { DanceSlug } from '$lib/dances/dances';
import type { Db } from './db';
import { listCountTakesFor } from './countTakes';
import { exerciseHistory, listExercises } from './exercises';
import { listReadySongs } from './songs';

export function popupData(db: Db, dance: DanceSlug, exerciseId: number, tz: string, now: number) {
	const exercise = listExercises(db, dance).find((e) => e.id === exerciseId);
	if (!exercise) return null;
	const today = localDay(now, tz);
	return {
		exercise,
		// Fifty is far more sets than one day holds; the filter decides "today".
		sets: exerciseHistory(db, exerciseId, 50).filter((s) => localDay(s.doneAt, tz) === today),
		songs: listReadySongs(db, dance),
		takes: PHRASE_PATTERNS.flatMap((p) => listCountTakesFor(db, p))
	};
}
