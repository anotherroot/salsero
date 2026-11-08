/**
 * What Today's desktop panes say: which row opens by itself, the session line
 * and a past day's totals. PURE, client-safe.
 */
import { t } from '$lib/i18n/catalog';
import type { DaySet } from '$lib/types';
import { practisedLabel } from './exercise-page';
import { sessionWalk } from './session';

/** The row the right pane opens on: the first to-do, else the first picked, else none. */
export function defaultOpen(day: {
	rows: readonly { exercise: { id: number }; kind: 'done' | 'todo' | 'picked' }[];
}): number | null {
	return sessionWalk(day.rows)[0]?.exercise.id ?? null;
}

/**
 * "Session · 2 of 5 · 1 logged so far". `walked`: ids logged or skipped this
 * session, in order; `remaining`: the walk's ids still to do. Null when the
 * open exercise is in neither.
 */
export function sessionLine(
	walked: readonly number[],
	remaining: readonly number[],
	open: number,
	logged: number
): string | null {
	const n = walked.length + remaining.filter((id) => !walked.includes(id)).length;
	const at = walked.indexOf(open);
	let i: number;
	if (at >= 0) i = at + 1;
	else if (remaining.includes(open)) i = walked.length + 1;
	else return null;
	return t().today.session.line(i, n, logged);
}

/** A past day's totals: "7 exercises · 9 sets · 1 h 05". */
export function dayTotals(sets: DaySet[]): string {
	const exercises = new Set(sets.map((s) => s.exerciseId)).size;
	const totalS = sets.reduce((a, s) => a + (s.durationS ?? 0), 0);
	return (
		t().today.totals(exercises, sets.length) + (totalS > 0 ? ` · ${practisedLabel(totalS)}` : '')
	);
}
