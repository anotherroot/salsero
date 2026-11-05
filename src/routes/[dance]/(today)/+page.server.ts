import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createCustomExercise, listPickExercises, listSetsBetween } from '$lib/server/exercises';
import { int, optionalText, text } from '$lib/server/form';
import { logSetFrom, deleteSetFrom, restoreSetFrom } from '$lib/server/log-form';
import { wallOf } from '$lib/server/scope';
import { isValidDay, localDay, noonOf, shiftDay } from '$lib/day/day';
import { isFrequency } from '$lib/frequency';
import type { Actions, PageServerLoad } from './$types';

const DAY_MS = 86_400_000;

function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

/**
 * Today's list is the layout's (`list`). This page adds a past day (`?day=`):
 * its sets and the exercises a forgotten set can be logged against. Today itself
 * has nothing of its own: `past` is null.
 */
export const load: PageServerLoad = ({ url, params, locals }) => {
	const wall = wallOf(params, locals);
	const dance = wall.dance;
	const tz = zone(locals);
	const today = localDay(Date.now(), tz);

	const requested = url.searchParams.get('day');
	if (requested !== null && (!isValidDay(requested) || requested >= today)) {
		// A future day has nothing to show and "today" has one canonical URL.
		// Back to THIS dance's Today rather than `/`, which would bounce off the
		// cookie to the same page and lose the correction.
		throw redirect(303, `/${dance}`);
	}
	if (requested === null) return { past: null };
	const day = requested;

	const db = getDb();
	// Widen the window by a day each side, then let localDay decide membership:
	// the day boundary is decided in ONE place, in the user's zone.
	const noon = noonOf(day, tz);
	const daySets = listSetsBetween(db, noon - DAY_MS, noon + DAY_MS, wall).filter(
		(s) => localDay(s.doneAt, tz) === day
	);

	return {
		past: {
			day,
			prevDay: shiftDay(day, -1),
			nextDay: shiftDay(day, 1),
			daySets,
			// For the past-day "add a forgotten set" picker.
			exercises: listPickExercises(db, wall)
		}
	};
};

export const actions: Actions = {
	/** Log a set: now, or at noon of a past day when back-filling. See `log-form.ts`. */
	log: (event) => logSetFrom(event),
	deleteSet: (event) => deleteSetFrom(event),
	restoreSet: (event) => restoreSetFrom(event),

	createExercise: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
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
		createCustomExercise(getDb(), wall, { name, everyDays, notes });
		return { action: 'createExercise', ok: true };
	}
};
