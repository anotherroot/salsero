import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	createCustomExercise,
	listPickExercises,
	listSetTimes,
	listSetsBetween
} from '$lib/server/exercises';
import { dayCounts } from '$lib/exercises/calendar';
import { shownExercise } from '$lib/exercises/name';
import { int, optionalText, text } from '$lib/server/form';
import { readComesBack, readWarmup } from '$lib/server/comes-back-form';
import { saveDoneFrom, undoDoneFrom } from '$lib/server/log-form';
import { wallOf } from '$lib/server/scope';
import { setWarmupOrder } from '$lib/server/warmup-order';
import { PickRefused, addPicks, dayInputOf, removePick } from '$lib/server/today-picks';
import { inLine } from '$lib/schedule/today-list';
import { isValidDay, localDay, noonOf, shiftDay } from '$lib/day/day';
import { t } from '$lib/i18n/catalog';
import type { Actions, PageServerLoad } from './$types';
import { serverNow } from '$lib/server/server-clock';

const DAY_MS = 86_400_000;

function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

/**
 * Today's list is the layout's (`list`). This page adds a past day (`?day=`):
 * its entries and the exercises a forgotten one can go on. Today itself
 * has nothing of its own: `past` is null.
 */
export const load: PageServerLoad = ({ url, params, locals }) => {
	const wall = wallOf(params, locals);
	const dance = wall.dance;
	const tz = zone(locals);
	const today = localDay(serverNow(), tz);

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
			// For the past day's "Add an exercise to this day" picker.
			exercises: listPickExercises(db, wall).map(shownExercise),
			// The calendar's numbers: exercises per day, every day with an entry.
			counts: dayCounts(listSetTimes(db, wall), tz)
		}
	};
};

export const actions: Actions = {
	/** Done: save the exercise's day, today or a past day (`day`). See `saveDoneFrom`. */
	done: (event) => saveDoneFrom(event),
	undoDone: (event) => undoDoneFrom(event),

	/** Put an exercise on today's list by hand (`add`) or take it off for today (`skip`). */
	pick: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const form = await request.formData();
		const exerciseId = int(form, 'exerciseId');
		const kind = form.get('kind');
		if (exerciseId === undefined || (kind !== 'add' && kind !== 'skip')) {
			return fail(400, { action: 'pick', message: t().today.refused.pickWhat });
		}
		const now = serverNow();
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
		if (pickId === undefined)
			return fail(400, { action: 'unpick', message: t().today.refused.noPick });
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
		const now = serverNow();
		const tz = zone(locals);
		const db = getDb();
		const input = dayInputOf(db, wall, tz, now);
		const ids = inLine(input)
			.slice(0, input.daily)
			.map((e) => e.id);
		if (ids.length === 0) {
			return fail(400, { action: 'next', message: t().today.refused.nothingToAdd });
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

	/** The warm-ups in the person's own order (a drag on Today); `ids` comma-separated. */
	warmupOrder: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const raw = String((await request.formData()).get('ids') ?? '');
		const ids = raw === '' ? [] : raw.split(',').map((x) => (/^\d+$/.test(x) ? Number(x) : NaN));
		if (ids.some(Number.isNaN) || !setWarmupOrder(getDb(), wall, ids)) {
			return fail(400, { action: 'warmupOrder', message: t().today.refused.warmupOrder });
		}
		return { action: 'warmupOrder', ok: true };
	},

	createExercise: async ({ params, request, locals }) => {
		const wall = wallOf(params, locals);
		const form = await request.formData();
		const name = text(form, 'name');
		const notes = optionalText(form, 'notes');
		if (!name || notes === undefined) {
			return fail(400, {
				action: 'createExercise',
				message: t().today.refused.name,
				name: String(form.get('name') ?? ''),
				notes: String(form.get('notes') ?? '')
			});
		}
		const comesBack = readComesBack(form, null, serverNow());
		if (comesBack === 'invalid') {
			return fail(400, {
				action: 'createExercise',
				message: t().exercise.refused.checkValues,
				name,
				notes: notes ?? ''
			});
		}
		createCustomExercise(getDb(), wall, {
			name,
			notes,
			warmup: readWarmup(form),
			comesBack: comesBack === 'teacher' ? undefined : comesBack
		});
		return { action: 'createExercise', ok: true };
	}
};
