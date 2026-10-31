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
import { deleteSet, getSet, logSet } from './exercises';
import { int, optionalInt, optionalText } from './form';
import { danceOf, requireExerciseInDance } from './scope';
import { isValidDay, localDay, noonOf } from '$lib/day/day';
import { hasField } from '$lib/exercises/kinds';
import type { SetSnapshot } from '$lib/types';

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

/**
 * A set snapshot from a form field, or null. The same limits `logSetFrom`
 * applies, plus: the instant is a real past one.
 */
export function parseSetSnapshot(raw: string, now: number): SetSnapshot | null {
	let v: unknown;
	try {
		v = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof v !== 'object' || v === null) return null;
	const o = v as Record<string, unknown>;
	const intIn = (x: unknown, lo: number, hi: number) =>
		typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;
	const orNull = (x: unknown, ok: (y: unknown) => boolean) => x === null || ok(x);
	const text = (max: number) => (x: unknown) => typeof x === 'string' && x.length <= max;
	if (!intIn(o.exerciseId, 1, Number.MAX_SAFE_INTEGER)) return null;
	if (!intIn(o.doneAt, 1, now)) return null;
	if (!orNull(o.durationS, (x) => intIn(x, 0, 24 * 3600))) return null;
	if (!orNull(o.reps, (x) => intIn(x, 0, 10_000))) return null;
	if (!orNull(o.rating, (x) => intIn(x, 1, 5))) return null;
	if (!orNull(o.note, text(2000))) return null;
	if (!orNull(o.playerJson, text(4000))) return null;
	return {
		exerciseId: o.exerciseId as number,
		doneAt: o.doneAt as number,
		durationS: o.durationS as number | null,
		reps: o.reps as number | null,
		rating: o.rating as number | null,
		note: o.note as string | null,
		playerJson: o.playerJson as string | null
	};
}

export async function deleteSetFrom({ params, request }: LogEvent) {
	const id = int(await request.formData(), 'setId');
	// A set already gone is a refusal the page can show, not a 404 page.
	const row = id === undefined ? null : getSet(getDb(), id);
	if (id === undefined || !row) {
		return fail(404, { action: 'deleteSet', message: 'That set was already removed.' });
	}
	// Before the delete, not after: `deleteSet` takes an id alone, so a set from
	// the other dance would already be gone by the time it answered.
	requireExerciseInDance(getDb(), danceOf(params), row.exerciseId);
	if (!deleteSet(getDb(), id)) {
		return fail(404, { action: 'deleteSet', message: 'That set was already removed.' });
	}
	const snapshot: SetSnapshot = {
		exerciseId: row.exerciseId,
		doneAt: row.doneAt,
		durationS: row.durationS,
		reps: row.reps,
		rating: row.rating,
		note: row.note,
		playerJson: row.playerJson
	};
	return { action: 'deleteSet' as const, ok: true, snapshot: JSON.stringify(snapshot) };
}

/**
 * Undo of a delete. The delete happened at once (spec "Additions"); Undo
 * re-inserts the same values with the original instant: a new id, the same
 * set. Nothing is held back on the client.
 */
export async function restoreSetFrom({ params, request }: LogEvent) {
	const form = await request.formData();
	const snap = parseSetSnapshot(String(form.get('snapshot') ?? ''), Date.now());
	if (!snap) {
		return fail(400, { action: 'restoreSet', message: 'That set could not be put back.' });
	}
	requireExerciseInDance(getDb(), danceOf(params), snap.exerciseId);
	try {
		logSet(getDb(), snap);
	} catch {
		return fail(400, { action: 'restoreSet', message: 'That set could not be put back.' });
	}
	return { action: 'restoreSet' as const, ok: true };
}
