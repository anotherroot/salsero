import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listSetsBetween } from '$lib/server/exercises';
import { lessonDays } from '$lib/server/lessons';
import { wallOf } from '$lib/server/scope';
import { dayInputOf } from '$lib/server/today-picks';
import { shownExercise } from '$lib/exercises/name';
import { localDay, noonOf, shiftDay } from '$lib/day/day';
import { dayListOf, workOf } from '$lib/schedule/today-list';
import { comingUpOf } from '$lib/schedule/coming-up';
import { runEstimate } from '$lib/exercises/estimate';
import { sessionWalk } from '$lib/exercises/session';
import type { LayoutServerLoad } from './$types';
import { serverNow } from '$lib/server/server-clock';

const DAY_MS = 86_400_000;

/**
 * Today's list, for the list page and for an exercise open beside it (desktop:
 * the list column is the layout's). It reads `params` and `locals`, never `url`:
 * a session flag, a past day or opening an exercise does not rerun it.
 * Namespaced under `list`, so it never collides with an exercise page's own
 * data keys (`today`, `songs`, `takes`).
 */
export const load: LayoutServerLoad = ({ params, locals, depends }) => {
	// The phone's fresh visit to the list (back from an exercise) reloads it.
	depends('today:list');
	if (!locals.user) throw error(401);
	const wall = wallOf(params, locals);
	const tz = locals.user.timezone;
	const now = serverNow();
	const today = localDay(now, tz);

	const db = getDb();
	// A lesson's own exercise is named in the reader's language (`shownExercise`).
	const stored = dayInputOf(db, wall, tz, now);
	const input = { ...stored, exercises: stored.exercises.map(shownExercise) };
	// The day worked out once, for the list and Coming up alike.
	const worked = workOf(input);
	const day = dayListOf(worked);

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
			// The day's rows: done, to do, picked (`src/lib/schedule/today-list.ts`).
			day,
			// About how long what is still to walk takes (null: none of it was ever timed).
			estimateS: runEstimate(
				input.sets.map((s) => ({
					exerciseId: s.exerciseId,
					doneAt: s.doneAt,
					durationS: s.durationS ?? null
				})),
				sessionWalk(day.rows).map((r) => r.exercise.id),
				tz
			),
			// Every exercise by the day it comes back: the Coming up page.
			coming: comingUpOf(worked),
			// Every live exercise, paused ones too: opening one by id, a tile's type.
			exercises: input.exercises,
			// The daily number: what "+ Next 5" says.
			daily: input.daily,
			todaySets,
			// The day of each class, for "New · from class Tue 3 Nov" on a lesson's row.
			lessonDays: lessonDays(db, wall)
		}
	};
};
