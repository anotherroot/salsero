import { error, fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import {
	archiveExercise,
	createCustomExercise,
	deleteSet,
	listExercises,
	listSetTimes,
	listSetsBetween,
	logSet,
	updateExercise
} from '$lib/server/exercises';
import { checkbox, int, oneOf, optionalInt, optionalText, text } from '$lib/server/form';
import { danceOf, requireExerciseInDance, requireSetInDance } from '$lib/server/scope';
import { listReadySongs } from '$lib/server/songs';
import { isValidDay, localDay, noonOf, shiftDay } from '$lib/day/day';
import { isFrequency } from '$lib/frequency';
import { PRACTICE_MODES } from '$lib/labels';
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
		// For the exercise sheet's practice-mode song picker.
		songs: listReadySongs(db, dance)
	};
};

export const actions: Actions = {
	/** Log a set: now, or at noon of a past day when back-filling. */
	log: async ({ params, request, locals }) => {
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

		// The picker only ever offers this dance's exercises, but the id arrives in
		// a form body, so it is checked rather than trusted.
		requireExerciseInDance(getDb(), danceOf(params), exerciseId);

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

	deleteSet: async ({ params, request }) => {
		const id = int(await request.formData(), 'setId');
		// Before the delete, not after: `deleteSet` takes an id alone, so a set
		// from the other dance would already be gone by the time it answered.
		if (id !== undefined) requireSetInDance(getDb(), danceOf(params), id);
		if (id === undefined || !deleteSet(getDb(), id)) {
			return fail(404, { action: 'deleteSet', message: 'That set was already removed.' });
		}
		return { action: 'deleteSet', ok: true };
	},

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
	},

	updateExercise: async ({ params, request }) => {
		const form = await request.formData();
		const id = int(form, 'id');
		const name = text(form, 'name') ?? '';
		const everyDays = int(form, 'everyDays');
		const notes = optionalText(form, 'notes');
		const practiceMode = oneOf(form, 'practiceMode', PRACTICE_MODES);
		const songId = optionalInt(form, 'songId', 1, Number.MAX_SAFE_INTEGER);
		const countBpm = optionalInt(form, 'countBpm', 60, 300);
		// Kept on every failure below so the sheet can re-show exactly what was typed.
		const entered = {
			id: String(form.get('id') ?? ''),
			name,
			everyDays: String(form.get('everyDays') ?? ''),
			notes: String(form.get('notes') ?? ''),
			active: checkbox(form, 'active'),
			practiceMode: String(form.get('practiceMode') ?? ''),
			songId: String(form.get('songId') ?? ''),
			countBpm: String(form.get('countBpm') ?? '')
		};
		if (
			id === undefined ||
			everyDays === undefined ||
			!isFrequency(everyDays) ||
			notes === undefined ||
			practiceMode === undefined ||
			songId === undefined ||
			countBpm === undefined
		) {
			return fail(400, {
				action: 'updateExercise',
				message: 'Check the values and try again.',
				...entered
			});
		}
		if (practiceMode === 'song') {
			if (songId === null) {
				return fail(400, {
					action: 'updateExercise',
					message: 'Pick a song, or switch to a different practice mode.',
					...entered
				});
			}
			// The picker only offers analysed songs, but one can be archived or
			// fail its analysis between the sheet opening and Save being tapped —
			// the home worker runs on its own schedule. Saving a song the player
			// cannot open would turn Practice into an error page.
			if (!listReadySongs(getDb(), danceOf(params)).some((s) => s.id === songId)) {
				return fail(400, {
					action: 'updateExercise',
					message: 'That song is not ready to practise with. Pick another.',
					...entered
				});
			}
		}
		if (practiceMode === 'count' && countBpm === null) {
			return fail(400, {
				action: 'updateExercise',
				message: 'Give a tempo in BPM, or switch to a different practice mode.',
				...entered
			});
		}
		requireExerciseInDance(getDb(), danceOf(params), id);
		const updated = updateExercise(getDb(), id, {
			name,
			everyDays,
			notes,
			active: checkbox(form, 'active'),
			practiceMode,
			songId,
			countBpm
		});
		if (!updated) return fail(404, { action: 'updateExercise', message: 'Exercise not found.' });
		return { action: 'updateExercise', ok: true };
	},

	archiveExercise: async ({ params, request }) => {
		const id = int(await request.formData(), 'id');
		// A missing id and a cross-dance id are different answers: the first gets
		// the friendly 400 below, the second a 404 that never reaches the archive.
		if (id !== undefined) requireExerciseInDance(getDb(), danceOf(params), id);
		if (id === undefined || !archiveExercise(getDb(), id, Date.now())) {
			return fail(400, {
				action: 'archiveExercise',
				message: 'Only custom exercises are archived here. Archive a figure from its page.'
			});
		}
		return { action: 'archiveExercise', ok: true };
	}
};
