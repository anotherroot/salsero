import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { createCustomExercise, listPickExercises, listSetsBetween } from '$lib/server/exercises';
import { checkbox, int, optionalText, text } from '$lib/server/form';
import { readComesBack } from '$lib/server/comes-back-form';
import { logSetFrom, deleteSetFrom, restoreSetFrom } from '$lib/server/log-form';
import { wallOf } from '$lib/server/scope';
import { PickRefused, addPicks, dayInputOf, removePick } from '$lib/server/today-picks';
import { inLine } from '$lib/schedule/today-list';
import { isValidDay, localDay, noonOf, shiftDay } from '$lib/day/day';
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

	/** Put an exercise on today's list by hand (`add`) or take it off for today (`skip`). */
	pick: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const form = await request.formData();
		const exerciseId = int(form, 'exerciseId');
		const kind = form.get('kind');
		if (exerciseId === undefined || (kind !== 'add' && kind !== 'skip')) {
			return fail(400, { action: 'pick', message: 'Pick an exercise to add or skip.' });
		}
		const now = Date.now();
		try {
			const day = localDay(now, zone(locals));
			const { created, unskipped } = addPicks(getDb(), wall, [exerciseId], day, kind, now);
			// `unskipped`: an add took the day's skip away; its Undo skips again (`undoAddSteps`).
			return { action: 'pick', pickIds: created, unskipped };
		} catch (e) {
			if (e instanceof PickRefused) return fail(400, { action: 'pick', message: e.message });
			throw e;
		}
	},

	/** Undo a pick. */
	unpick: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const pickId = int(await request.formData(), 'pickId');
		if (pickId === undefined) return fail(400, { action: 'unpick', message: 'No such pick.' });
		removePick(getDb(), wall, pickId);
		return { action: 'unpick', ok: true };
	},

	/**
	 * "+ Next 5": the next daily-number exercises in line, picked for today. The
	 * line is worked out here from what is stored, as the list does, so a second
	 * tap takes the ones after the first tap's (never the same again).
	 */
	next: async ({ params, locals }) => {
		const wall = wallOf(params, locals);
		const now = Date.now();
		const tz = zone(locals);
		const db = getDb();
		const input = dayInputOf(db, wall, tz, now);
		const ids = inLine(input)
			.slice(0, input.daily)
			.map((e) => e.id);
		if (ids.length === 0) {
			return fail(400, { action: 'next', message: 'Nothing left to add today.' });
		}
		try {
			const pickIds = addPicks(db, wall, ids, localDay(now, tz), 'next', now).created;
			// The rows' ids too: the page focuses the first of them.
			return { action: 'next', pickIds, exerciseIds: ids };
		} catch (e) {
			if (e instanceof PickRefused) return fail(400, { action: 'next', message: e.message });
			throw e;
		}
	},

	createExercise: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		if (!name || notes === undefined) {
			return fail(400, {
				action: 'createExercise',
				message: 'Give it a name (up to 200 characters).',
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}
		const comesBack = readComesBack(form, null, Date.now());
		if (comesBack === 'invalid') {
			return fail(400, {
				action: 'createExercise',
				message: 'Check the values and try again.',
				name,
				notes: notes ?? ''
			});
		}
		createCustomExercise(getDb(), wall, {
			name,
			notes,
			warmup: form.has('warmupSent') ? checkbox(form, 'warmup') : undefined,
			comesBack: comesBack === 'teacher' ? undefined : comesBack
		});
		return { action: 'createExercise', ok: true };
	}
};
