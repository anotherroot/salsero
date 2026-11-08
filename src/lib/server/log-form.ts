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
import { error, fail, type ActionFailure } from '@sveltejs/kit';
import { getDb } from './db';
import { deleteDay, deleteSet, getSet, logSet, restoreSets, saveDay, undoSave } from './exercises';
import { int, optionalInt, optionalText } from './form';
import { requireExerciseInWall, wallOf } from './scope';
import { scheduleStateOf } from './schedule';
import { daysBetween, isValidDay, localDay, noonOf } from '$lib/day/day';
import { hasField } from '$lib/exercises/kinds';
import { t } from '$lib/i18n/catalog';
import type { DoneResult, SetSnapshot } from '$lib/types';

export type LogEvent = { params: { dance: string }; request: Request; locals: App.Locals };

export async function logSetFrom({ params, request, locals }: LogEvent) {
	if (!locals.user) throw error(401);
	const tz = locals.user.timezone;
	const wall = wallOf(params, locals);
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
		return fail(400, { action: 'log', message: t().exercise.refused.checkValues });
	}

	// The id arrives in a form body, so it is checked against the URL's dance
	// rather than trusted.
	const exercise = requireExerciseInWall(getDb(), wall, exerciseId);
	const has = (f: Parameters<typeof hasField>[1]) => hasField(exercise.source, f);

	if (has('rating') && rating === null) {
		return fail(400, { action: 'log', message: t().exercise.log.pickFeel });
	}

	const now = Date.now();
	const backfill = isValidDay(day) && day < localDay(now, tz);
	// Exact seconds come from the practice panel; typing into Minutes clears
	// them on the client, so when both arrive the panel's are the truth.
	const seconds = durationS ?? (durationMin === null ? null : durationMin * 60);
	try {
		const { set, before } = saveDay(
			getDb(),
			{
				exerciseId,
				doneAt: backfill ? noonOf(day, tz) : now,
				durationS: has('minutes') ? seconds : null,
				reps: has('reps') ? reps : null,
				rating: has('rating') ? rating : null,
				note: has('note') ? note : null,
				playerJson: backfill ? null : (run ?? null)
			},
			tz
		);
		return {
			action: 'log' as const,
			ok: true,
			setId: set.id,
			before: before && JSON.stringify(before)
		};
	} catch {
		return fail(400, { action: 'log', message: t().exercise.refused.gone });
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

export async function deleteSetFrom({ params, request, locals }: LogEvent) {
	const id = int(await request.formData(), 'setId');
	// A set already gone is a refusal the page can show, not a 404 page.
	const row = id === undefined ? null : getSet(getDb(), id);
	if (id === undefined || !row) {
		return fail(404, { action: 'deleteSet', message: t().exercise.refused.setGone });
	}
	// Before the delete, not after: `deleteSet` takes an id alone, so a set from
	// the other dance would already be gone by the time it answered.
	requireExerciseInWall(getDb(), wallOf(params, locals), row.exerciseId);
	if (!deleteSet(getDb(), id)) {
		return fail(404, { action: 'deleteSet', message: t().exercise.refused.setGone });
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
export async function restoreSetFrom({ params, request, locals }: LogEvent) {
	const form = await request.formData();
	const snap = parseSetSnapshot(String(form.get('snapshot') ?? ''), Date.now());
	if (!snap) {
		return fail(400, { action: 'restoreSet', message: t().exercise.refused.putBack });
	}
	requireExerciseInWall(getDb(), wallOf(params, locals), snap.exerciseId);
	try {
		logSet(getDb(), snap);
	} catch {
		return fail(400, { action: 'restoreSet', message: t().exercise.refused.putBack });
	}
	return { action: 'restoreSet' as const, ok: true };
}

/**
 * Done: save the exercise's day (`saveDay`: one row a day, time added, face and
 * note replaced). Fields: exerciseId, durationS (0..86400, optional), rating
 * (1..5, optional), note (≤2000), run (≤4000, dropped when longer), day (a past
 * day: back-filled at noon, no run, no time). A fixed rhythm stores no face
 * whatever was posted; any other exercise refuses a missing one. The exercise is
 * checked against the wall, so a group's own drill (not the member's entry) is a 404.
 */
export async function saveDoneFrom({
	params,
	request,
	locals
}: LogEvent): Promise<
	ActionFailure<{ action: 'done'; message: string }> | (DoneResult & { action: 'done' })
> {
	if (!locals.user) throw error(401);
	const tz = locals.user.timezone;
	const wall = wallOf(params, locals);
	const form = await request.formData();
	const exerciseId = int(form, 'exerciseId');
	const durationS = optionalInt(form, 'durationS', 0, 24 * 3600);
	const rating = optionalInt(form, 'rating', 1, 5);
	const note = optionalText(form, 'note', 2000);
	const run = optionalText(form, 'run', 4000);
	const day = String(form.get('day') ?? '');

	if (
		exerciseId === undefined ||
		durationS === undefined ||
		rating === undefined ||
		note === undefined
	) {
		return fail(400, { action: 'done', message: t().exercise.refused.checkValues });
	}
	const db = getDb();
	requireExerciseInWall(db, wall, exerciseId);
	const fixed = scheduleStateOf(db, exerciseId, tz).every !== null;
	if (!fixed && rating === null) {
		return fail(400, { action: 'done', message: t().exercise.log.pickFeel });
	}

	const now = Date.now();
	const backfill = isValidDay(day) && day < localDay(now, tz);
	let saved: ReturnType<typeof saveDay>;
	try {
		saved = saveDay(
			db,
			{
				exerciseId,
				doneAt: backfill ? noonOf(day, tz) : now,
				durationS: backfill ? null : durationS,
				reps: null,
				rating: fixed ? null : rating,
				note,
				playerJson: backfill ? null : (run ?? null)
			},
			tz
		);
	} catch {
		return fail(400, { action: 'done', message: t().exercise.refused.gone });
	}
	return {
		action: 'done',
		ok: true,
		setId: saved.set.id,
		before: saved.before && JSON.stringify(saved.before),
		backDays: backfill
			? null
			: daysBetween(localDay(now, tz), scheduleStateOf(db, exerciseId, tz).dueDay)
	};
}

/**
 * Undo of Done. Fields: setId, before ('' = the day had no row). The set must be
 * the wall's; `before` must be a snapshot of the same exercise.
 */
export async function undoDoneFrom({ params, request, locals }: LogEvent) {
	const form = await request.formData();
	const refused = () => fail(400, { action: 'undoDone', message: t().today.refused.undo });
	const setId = int(form, 'setId');
	const row = setId === undefined ? null : getSet(getDb(), setId);
	if (setId === undefined || !row) return refused();
	requireExerciseInWall(getDb(), wallOf(params, locals), row.exerciseId);
	const raw = String(form.get('before') ?? '');
	const before = raw === '' ? null : parseSetSnapshot(raw, Date.now());
	if (raw !== '' && (!before || before.exerciseId !== row.exerciseId)) return refused();
	if (!undoSave(getDb(), setId, before)) return refused();
	return { action: 'undoDone' as const, ok: true as const };
}

/** Every snapshot valid and of one exercise, in order; else null (also for an empty list). */
export function parseSetSnapshots(raw: string, now: number): SetSnapshot[] | null {
	let v: unknown;
	try {
		v = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(v) || v.length === 0) return null;
	const snaps: SetSnapshot[] = [];
	for (const item of v) {
		const snap = parseSetSnapshot(JSON.stringify(item), now);
		if (!snap || (snap.exerciseId !== snaps[0]?.exerciseId && snaps.length > 0)) return null;
		snaps.push(snap);
	}
	return snaps;
}

/** Delete a whole day of an exercise. Fields: exerciseId, day. Answers the rows as a JSON array for Undo. */
export async function deleteDayFrom({ params, request, locals }: LogEvent) {
	if (!locals.user) throw error(401);
	const form = await request.formData();
	const exerciseId = int(form, 'exerciseId');
	const day = String(form.get('day') ?? '');
	if (exerciseId === undefined || !isValidDay(day)) {
		return fail(400, { action: 'deleteDay', message: t().exercise.refused.dayGone });
	}
	// Before the delete: `deleteDay` takes an id alone, like `deleteSet`.
	requireExerciseInWall(getDb(), wallOf(params, locals), exerciseId);
	const snapshots = deleteDay(getDb(), exerciseId, day, locals.user.timezone);
	if (snapshots.length === 0) {
		return fail(404, { action: 'deleteDay', message: t().exercise.refused.dayGone });
	}
	return { action: 'deleteDay' as const, ok: true as const, snapshots: JSON.stringify(snapshots) };
}

/** Undo of a day's delete. Fields: snapshots. */
export async function restoreDayFrom({ params, request, locals }: LogEvent) {
	const form = await request.formData();
	const snaps = parseSetSnapshots(String(form.get('snapshots') ?? ''), Date.now());
	if (!snaps) {
		return fail(400, { action: 'restoreDay', message: t().exercise.refused.dayPutBack });
	}
	requireExerciseInWall(getDb(), wallOf(params, locals), snaps[0].exerciseId);
	try {
		restoreSets(getDb(), snaps);
	} catch {
		return fail(400, { action: 'restoreDay', message: t().exercise.refused.dayPutBack });
	}
	return { action: 'restoreDay' as const, ok: true as const };
}
