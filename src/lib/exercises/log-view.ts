/**
 * What the log popup shows: the footer's buttons, the range check on Minutes
 * and Reps, the star rating, the "last time" line. PURE, client-safe.
 */
import { lastDoneLabel } from '$lib/format';
import type { LastSet } from '$lib/types';

export type FooterInput = {
	session: { next: string | null; ended: boolean } | null;
	justLogged: boolean;
	busy: boolean;
	playing: boolean;
	backfill: boolean;
	/** Outside a session: the name Next goes to after a log. */
	follow?: string | null;
};
export type MainState = 'log' | 'saving' | 'disabled' | 'logged';
export interface FooterView {
	skip: boolean;
	main: { state: MainState; label: string } | null;
	hint: string | null;
	next: string | null;
	done: boolean;
}

export function footerFor(i: FooterInput): FooterView {
	const s = i.session;
	const done = s !== null && (s.ended || (i.justLogged && s.next === null));
	let main: FooterView['main'];
	let hint: string | null = null;
	if (i.busy) main = { state: 'saving', label: 'Saving…' };
	else if (i.playing) {
		main = { state: 'disabled', label: 'Log set' };
		hint = 'Stop the count to log it.';
	} else if (i.justLogged) main = { state: 'logged', label: 'Logged' };
	else main = { state: 'log', label: i.backfill ? 'Add set to this day' : 'Log set' };
	if (done && i.justLogged) main = null;
	return {
		skip: s !== null && !i.justLogged && !s.ended,
		main,
		hint,
		next: s
			? i.justLogged && !s.ended && s.next !== null
				? `Next: ${s.next}`
				: null
			: i.justLogged && i.follow
				? `Next: ${i.follow}`
				: null,
		done
	};
}

/** The error under Minutes or Reps: empty or an integer 0..max is fine. */
export function rangeError(value: string, max: number): string | null {
	if (value === '') return null;
	if (/^\d+$/.test(value) && Number(value) <= max) return null;
	return `0–${max}`;
}

/** Tapping the rating you already have clears it. */
export function nextRating(current: number | null, tapped: number): number | null {
	return current === tapped ? null : tapped;
}

/** The "Last time" line's parts; null means "First time.". */
export function lastTimeParts(
	last: LastSet | null
): { when: string; rating: number | null; note: string | null } | null {
	if (!last) return null;
	return {
		when: `Last time: ${lastDoneLabel(last.daysAgo)}`,
		rating: last.rating,
		note: last.note
	};
}
