/**
 * Logging a set and deleting one, shared by every page that opens a log popup:
 * Today, the exercise page, the figure page and the lesson page. One parser,
 * one set of rules — before this, three pages each carried their own bare-log
 * action, each checking the exercise a little differently.
 *
 * Only the fields the exercise's TYPE has are stored (`hasField`): a figure's
 * form posting reps is ignored, not written. And a back-filled set never gets
 * a player run — a run is something that happened now.
 */
import { error, fail } from '@sveltejs/kit';
import { getDb } from './db';
import { deleteSet, logSet } from './exercises';
import { int, optionalInt, optionalText } from './form';
import { danceOf, requireExerciseInDance, requireSetInDance } from './scope';
import { isValidDay, localDay, noonOf } from '$lib/day/day';
import { hasField } from '$lib/exercises/kinds';

export type LogEvent = { params: { dance: string }; request: Request; locals: App.Locals };

export async function logSetFrom({ params, request, locals }: LogEvent) {
	if (!locals.user) throw error(401);
	const tz = locals.user.timezone;
	const dance = danceOf(params);
	const form = await request.formData();
	const exerciseId = int(form, 'exerciseId');
	const durationMin = optionalInt(form, 'durationMin', 0, 600);
	const durationS = optionalInt(form, 'durationS', 0, 24 * 3600);
	const reps = optionalInt(form, 'reps', 0, 10_000);
	const rating = optionalInt(form, 'rating', 1, 5);
	const note = optionalText(form, 'note');
	// The summary of a run is a nicety; the set is the point. An overlong one is
	// dropped rather than costing the user the set — the player's own rule.
	const run = optionalText(form, 'run', 4000);
	const day = String(form.get('day') ?? '');

	if (
		exerciseId === undefined ||
		durationMin === undefined ||
		durationS === undefined ||
		reps === undefined ||
		rating === undefined ||
		note === undefined
	) {
		return fail(400, { action: 'log', message: 'Check the values and try again.' });
	}

	// The id arrives in a form body, so it is checked against the URL's dance
	// rather than trusted.
	const exercise = requireExerciseInDance(getDb(), dance, exerciseId);
	const has = (f: Parameters<typeof hasField>[1]) => hasField(exercise.source, f);

	const now = Date.now();
	const backfill = isValidDay(day) && day < localDay(now, tz);
	// Exact seconds come from the practice panel; typing into Minutes clears
	// them on the client, so when both arrive the panel's are the truth.
	const seconds = durationS ?? (durationMin === null ? null : durationMin * 60);
	try {
		const set = logSet(getDb(), {
			exerciseId,
			doneAt: backfill ? noonOf(day, tz) : now,
			durationS: has('minutes') ? seconds : null,
			reps: has('reps') ? reps : null,
			rating: has('rating') ? rating : null,
			note: has('note') ? note : null,
			playerJson: backfill ? null : (run ?? null)
		});
		return { action: 'log' as const, ok: true, setId: set.id };
	} catch {
		return fail(400, { action: 'log', message: 'That exercise no longer exists.' });
	}
}

export async function deleteSetFrom({ params, request }: LogEvent) {
	const id = int(await request.formData(), 'setId');
	// Before the delete, not after: `deleteSet` takes an id alone, so a set from
	// the other dance would already be gone by the time it answered.
	if (id !== undefined) requireSetInDance(getDb(), danceOf(params), id);
	if (id === undefined || !deleteSet(getDb(), id)) {
		return fail(404, { action: 'deleteSet', message: 'That set was already removed.' });
	}
	return { action: 'deleteSet' as const, ok: true };
}
