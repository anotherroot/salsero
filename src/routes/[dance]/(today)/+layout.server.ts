import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { lastSets, listExercises, listSetTimes, listSetsBetween } from '$lib/server/exercises';
import { listCountTakesFor } from '$lib/server/countTakes';
import { lessonDays } from '$lib/server/lessons';
import { wallOf } from '$lib/server/scope';
import { songChoices } from '$lib/server/songs';
import { localDay, noonOf, shiftDay } from '$lib/day/day';
import { PHRASE_PATTERNS } from '$lib/labels';
import { plan } from '$lib/urgency/urgency';
import type { LayoutServerLoad } from './$types';

const DAY_MS = 86_400_000;

/**
 * Today's list, for the list page and for an exercise open beside it (desktop:
 * the list column is the layout's). It reads `params` and `locals`, never `url`:
 * a session flag, a past day or opening an exercise does not rerun it.
 * Namespaced under `list`, so it never collides with an exercise page's own
 * data keys (`today`, `songs`, `takes`).
 */
export const load: LayoutServerLoad = ({ params, locals }) => {
	if (!locals.user) throw error(401);
	const wall = wallOf(params, locals);
	const tz = locals.user.timezone;
	const now = Date.now();
	const today = localDay(now, tz);

	const db = getDb();
	const exercises = listExercises(db, wall);

	// Widen the window by a day each side, then let localDay decide membership:
	// the day boundary is decided in ONE place, in the user's zone.
	const noon = noonOf(today, tz);
	const todaySets = listSetsBetween(db, noon - DAY_MS, noon + DAY_MS, wall).filter(
		(s) => localDay(s.doneAt, tz) === today
	);

	return {
		list: {
			today,
			yesterday: shiftDay(today, -1),
			plan: plan(exercises, listSetTimes(db, wall), now, tz),
			todaySets,
			// The day of each class, for "Lesson · Wed 28 Oct" on a lesson's row.
			lessonDays: lessonDays(db, wall),
			// The latest set's rating per exercise, for the dots on each row.
			lastRatings: Object.fromEntries(
				[...lastSets(db, wall)].map(([id, s]) => [id, s.rating] as [number, number | null])
			),
			// For the practice panel's song picker.
			songs: songChoices(db, wall),
			// The practice panel's voice: the user's recorded count, a few dozen rows.
			takes: PHRASE_PATTERNS.flatMap((p) => listCountTakesFor(db, wall.userId, p))
		}
	};
};
