import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	createCustomExercise,
	lastSets,
	listExercises,
	listSetTimes,
	listSetsBetween
} from '$lib/server/exercises';
import { listCountTakesFor } from '$lib/server/countTakes';
import { int, optionalText, text } from '$lib/server/form';
import { logSetFrom, deleteSetFrom } from '$lib/server/log-form';
import { danceOf } from '$lib/server/scope';
import { listReadySongs } from '$lib/server/songs';
import { isValidDay, localDay, noonOf, shiftDay } from '$lib/day/day';
import { isFrequency } from '$lib/frequency';
import { PHRASE_PATTERNS } from '$lib/labels';
import { plan } from '$lib/urgency/urgency';
import type { Actions, PageServerLoad } from './$types';

const DAY_MS = 86_400_000;

function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

export const load: PageServerLoad = ({ url, params, locals }) => {
	const dance = danceOf(params);
	const tz = zone(locals);
	const now = Date.now();
	const today = localDay(now, tz);

	const requested = url.searchParams.get('day');
	if (requested !== null && (!isValidDay(requested) || requested >= today)) {
		// A future day has nothing to show and "today" has one canonical URL.
		// Back to THIS dance's Today rather than `/`, which would bounce off the
		// cookie to the same page and lose the correction.
		throw redirect(303, `/${dance}`);
	}
	const day = requested ?? today;

	const db = getDb();
	const exercises = listExercises(db, dance);

	// Widen the window by a day each side, then let localDay decide membership:
	// the day boundary is decided in ONE place, in the user's zone.
	const noon = noonOf(day, tz);
	const daySets = listSetsBetween(db, noon - DAY_MS, noon + DAY_MS, dance).filter(
		(s) => localDay(s.doneAt, tz) === day
	);

	return {
		day,
		today,
		prevDay: shiftDay(day, -1),
		nextDay: day === today ? null : shiftDay(day, 1),
		isToday: day === today,
		plan: plan(exercises, listSetTimes(db, dance), now, tz),
		daySets,
		// For the past-day "add a forgotten set" picker.
		exercises: exercises
			.map((e) => ({ id: e.id, name: e.name }))
			.sort((a, b) => a.name.localeCompare(b.name)),
		// For the practice panel's song picker.
		songs: listReadySongs(db, dance),
		// The latest set's rating per exercise, for the dots on each row.
		lastRatings: Object.fromEntries(
			[...lastSets(db, dance)].map(([id, s]) => [id, s.rating] as [number, number | null])
		),
		// The practice panel's voice: the user's recorded count, a few dozen rows.
		takes: PHRASE_PATTERNS.flatMap((p) => listCountTakesFor(db, p))
	};
};

export const actions: Actions = {
	/** Log a set: now, or at noon of a past day when back-filling. See `log-form.ts`. */
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),

	createExercise: async ({ params, request }) => {
		const dance = danceOf(params);
		const form = await request.formData();
		const name = text(form, 'name');
		const everyDays = int(form, 'everyDays');
		const notes = optionalText(form, 'notes');
		if (!name || everyDays === undefined || !isFrequency(everyDays) || notes === undefined) {
			return fail(400, {
				action: 'createExercise',
				message: 'Give it a name (up to 200 characters) and a frequency.',
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}
		createCustomExercise(getDb(), dance, { name, everyDays, notes });
		return { action: 'createExercise', ok: true };
	}
};
