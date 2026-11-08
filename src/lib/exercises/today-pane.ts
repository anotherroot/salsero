/**
 * What Today's desktop panes say: which row opens by itself and a past day's
 * totals. PURE, client-safe.
 */
import { t } from '$lib/i18n/catalog';
import type { DaySet } from '$lib/types';
import { practisedLabel } from './exercise-page';
import { sessionWalk, type Walkable } from './session';

/** The row the right pane opens on: the first of the walk (warm-ups first), else none. */
export function defaultOpen(day: { rows: readonly Walkable[] }): number | null {
	return sessionWalk(day.rows)[0]?.exercise.id ?? null;
}

/** A past day's totals: "7 exercises · 1 h 05". */
export function dayTotals(sets: DaySet[]): string {
	const exercises = new Set(sets.map((s) => s.exerciseId)).size;
	const totalS = sets.reduce((a, s) => a + (s.durationS ?? 0), 0);
	return t().today.totals(exercises) + (totalS > 0 ? ` · ${practisedLabel(totalS)}` : '');
}
