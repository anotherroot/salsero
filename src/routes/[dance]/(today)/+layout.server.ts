import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { listSetsBetween } from '$lib/server/exercises';
import { listCountTakesFor } from '$lib/server/countTakes';
import { lessonDays } from '$lib/server/lessons';
import { wallOf } from '$lib/server/scope';
import { songChoices } from '$lib/server/songs';
import { dayInputOf } from '$lib/server/today-picks';
import { localDay, noonOf, shiftDay } from '$lib/day/day';
import { PHRASE_PATTERNS } from '$lib/labels';
import { dayListOf, workOf } from '$lib/schedule/today-list';
import { comingUpOf } from '$lib/schedule/coming-up';
import type { LayoutServerLoad } from './$types';

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
	const now = Date.now();
	const today = localDay(now, tz);

	const db = getDb();
	const input = dayInputOf(db, wall, tz, now);
	// The day worked out once, for the list and Coming up alike.
	const worked = workOf(input);

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
			day: dayListOf(worked),
			// Every exercise by the day it comes back: the Coming up page.
			coming: comingUpOf(worked),
			// Every live exercise, paused ones too: opening one by id, a tile's type.
			exercises: input.exercises,
			// The daily number: what "+ Next 5" says.
			daily: input.daily,
			todaySets,
			// The day of each class, for "New · from class Tue 3 Nov" on a lesson's row.
			lessonDays: lessonDays(db, wall),
			// Each live exercise's schedule as of the START of today (sets before today
			// only): what the log popup's faces preview, the same on a second log today.
			schedulesAtStart: Object.fromEntries(
				[...worked.entry.values()].map((x) => [x.e.id, x.start])
			),
			// For the practice panel's song picker.
			songs: songChoices(db, wall),
			// The practice panel's voice: the user's recorded count, a few dozen rows.
			takes: PHRASE_PATTERNS.flatMap((p) => listCountTakesFor(db, wall.userId, p))
		}
	};
};
