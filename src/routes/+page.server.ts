import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	archiveExercise,
	createCustomExercise,
	deleteSet,
	getExercise,
	listExercises,
	listSetTimes,
	listSetsBetween,
	logSet,
	updateExercise
} from '$lib/server/exercises';
import { checkbox, int, optionalInt, optionalText, text } from '$lib/server/form';
import { isValidDay, localDay, noonOf, shiftDay } from '$lib/day/day';
import { isFrequency } from '$lib/frequency';
import { plan } from '$lib/urgency/urgency';
import type { Actions, PageServerLoad } from './$types';

const DAY_MS = 86_400_000;

function zone(locals: App.Locals): string {
	if (!locals.user) throw error(401);
	return locals.user.timezone;
}

export const load: PageServerLoad = ({ url, locals }) => {
	const tz = zone(locals);
	const now = Date.now();
	const today = localDay(now, tz);

	const requested = url.searchParams.get('day');
	if (requested !== null && (!isValidDay(requested) || requested >= today)) {
		// A future day has nothing to show and "today" has one canonical URL.
		throw redirect(303, '/');
	}
	const day = requested ?? today;

	const db = getDb();
	const exercises = listExercises(db);

	// Widen the window by a day each side, then let localDay decide membership:
	// the day boundary is decided in ONE place, in the user's zone.
	const noon = noonOf(day, tz);
	const daySets = listSetsBetween(db, noon - DAY_MS, noon + DAY_MS).filter(
		(s) => localDay(s.doneAt, tz) === day
	);

	return {
		day,
		today,
		prevDay: shiftDay(day, -1),
		nextDay: day === today ? null : shiftDay(day, 1),
		isToday: day === today,
		plan: plan(exercises, listSetTimes(db), now, tz),
		daySets,
		// For the past-day "add a forgotten set" picker.
		exercises: exercises
			.map((e) => ({ id: e.id, name: e.name }))
			.sort((a, b) => a.name.localeCompare(b.name))
	};
};

export const actions: Actions = {
	/** Log a set: now, or at noon of a past day when back-filling. */
	log: async ({ request, locals }) => {
		const tz = zone(locals);
		const form = await request.formData();
		const exerciseId = int(form, 'exerciseId');
		const durationMin = optionalInt(form, 'durationMin', 0, 600);
		const reps = optionalInt(form, 'reps', 0, 10_000);
		const rating = optionalInt(form, 'rating', 1, 5);
		const note = optionalText(form, 'note');
		const day = String(form.get('day') ?? '');

		if (
			exerciseId === undefined ||
			durationMin === undefined ||
			reps === undefined ||
			rating === undefined ||
			note === undefined
		) {
			return fail(400, { action: 'log', message: 'Check the values and try again.' });
		}

		const now = Date.now();
		const backfill = isValidDay(day) && day < localDay(now, tz);
		try {
			logSet(getDb(), {
				exerciseId,
				doneAt: backfill ? noonOf(day, tz) : now,
				durationS: durationMin === null ? null : durationMin * 60,
				reps,
				rating,
				note,
				playerJson: null
			});
		} catch {
			return fail(400, { action: 'log', message: 'That exercise no longer exists.' });
		}
		return { action: 'log', ok: true };
	},

	deleteSet: async ({ request }) => {
		const id = int(await request.formData(), 'setId');
		if (id === undefined || !deleteSet(getDb(), id)) {
			return fail(404, { action: 'deleteSet', message: 'That set was already removed.' });
		}
		return { action: 'deleteSet', ok: true };
	},

	createExercise: async ({ request }) => {
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
		createCustomExercise(getDb(), { name, everyDays, notes });
		return { action: 'createExercise', ok: true };
	},

	updateExercise: async ({ request }) => {
		const form = await request.formData();
		const id = int(form, 'id');
		const name = text(form, 'name') ?? '';
		const everyDays = int(form, 'everyDays');
		const notes = optionalText(form, 'notes');
		if (
			id === undefined ||
			everyDays === undefined ||
			!isFrequency(everyDays) ||
			notes === undefined
		) {
			return fail(400, { action: 'updateExercise', message: 'Check the values and try again.' });
		}
		// The settings sheet has no practice-mode picker yet (phase 2b UI); carry
		// the exercise's current mode/song/count through unchanged rather than
		// clearing them just because this form doesn't know about them.
		const current = getExercise(getDb(), id);
		if (!current) return fail(404, { action: 'updateExercise', message: 'Exercise not found.' });
		const updated = updateExercise(getDb(), id, {
			name,
			everyDays,
			notes,
			active: checkbox(form, 'active'),
			practiceMode: current.practiceMode,
			songId: current.songId,
			countBpm: current.countBpm
		});
		if (!updated) return fail(404, { action: 'updateExercise', message: 'Exercise not found.' });
		return { action: 'updateExercise', ok: true };
	},

	archiveExercise: async ({ request }) => {
		const id = int(await request.formData(), 'id');
		if (id === undefined || !archiveExercise(getDb(), id, Date.now())) {
			return fail(400, {
				action: 'archiveExercise',
				message: 'Only custom exercises are archived here. Archive a figure from its page.'
			});
		}
		return { action: 'archiveExercise', ok: true };
	}
};
