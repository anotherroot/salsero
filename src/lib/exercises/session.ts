/**
 * A session walks Today's list popup by popup: the to-do rows, then the picked
 * ones. PURE: no state lives on the server — the session is a URL flag plus
 * the page's own rows, so "next" is recomputed from them after every refresh.
 * The logged exercise is a done row by then, which is why the first remaining
 * row of the walk is the answer.
 */
import { t } from '$lib/i18n/catalog';

type Walkable = { exercise: { id: number }; kind: 'done' | 'todo' | 'picked' };

/** What a session walks, in order: the to-do rows, then the picked ones. */
export function sessionWalk<R extends Walkable>(rows: readonly R[]): R[] {
	return [...rows.filter((r) => r.kind === 'todo'), ...rows.filter((r) => r.kind === 'picked')];
}

/** The first of the walk that is neither open nor skipped. */
export function nextInSession<R extends { exercise: { id: number } }>(
	walk: readonly R[],
	skipped: ReadonlySet<number>,
	current: number | null
): R | null {
	return walk.find((r) => r.exercise.id !== current && !skipped.has(r.exercise.id)) ?? null;
}

/**
 * The Session done card's second line (its title says "Session done"):
 * "3 exercises, 25 min", or "Nothing logged" when the session logged none.
 */
export function sessionSummary(count: number, seconds: number): string {
	const w = t().today.session;
	if (count === 0) return w.nothingLogged;
	return w.summary(count, Math.round(seconds / 60));
}
