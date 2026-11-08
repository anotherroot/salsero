/**
 * What the log popup shows: the footer's buttons, the range check on Minutes
 * and Reps, the star rating, the "last time" line. PURE, client-safe.
 */
import { lastDoneLabel } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import type { LastSet } from '$lib/types';

export type FooterInput = {
	session: { next: string | null; ended: boolean } | null;
	justLogged: boolean;
	busy: boolean;
	playing: boolean;
	backfill: boolean;
	/** Outside a session: the name Next goes to after a log. */
	follow?: string | null;
	/** A face is picked (always true for a type with no rating). */
	rated: boolean;
	/** The simple log popup (Follow my class, Practise and keep my own): the button says Done. */
	simple?: boolean;
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
	const w = t().exercise.log;
	const s = i.session;
	const logLabel = i.simple ? w.done : w.logSet;
	const done = s !== null && (s.ended || (i.justLogged && s.next === null));
	let main: FooterView['main'];
	let hint: string | null = null;
	if (i.busy) main = { state: 'saving', label: w.saving };
	else if (i.playing) {
		main = { state: 'disabled', label: logLabel };
		hint = w.stopToLog;
	} else if (i.justLogged) main = { state: 'logged', label: w.logged };
	else if (!i.rated) {
		main = { state: 'disabled', label: i.backfill ? w.addToDay : logLabel };
		hint = w.pickFeel;
	} else main = { state: 'log', label: i.backfill ? w.addToDay : logLabel };
	if (done && i.justLogged) main = null;
	return {
		skip: s !== null && !i.justLogged && !s.ended,
		main,
		hint,
		next: s
			? i.justLogged && !s.ended && s.next !== null
				? w.next(s.next)
				: null
			: i.justLogged && i.follow
				? w.next(i.follow)
				: null,
		done
	};
}

/**
 * The log form's fields at this level: the simple popup is the four faces
 * alone (no minutes, reps or note); the type's own list otherwise.
 */
export function fieldsShown<F extends string>(simple: boolean, fields: readonly F[]): F[] {
	return fields.filter((f) => !simple || f === 'rating');
}

/** The error under Minutes or Reps: empty or an integer 0..max is fine. */
export function rangeError(value: string, max: number): string | null {
	if (value === '') return null;
	if (/^\d+$/.test(value) && Number(value) <= max) return null;
	return t().exercise.log.range(max);
}

/** The "Last time" line's parts; null means "First time.". */
export function lastTimeParts(
	last: LastSet | null
): { when: string; rating: number | null; note: string | null } | null {
	if (!last) return null;
	return {
		when: t().exercise.log.lastTime(lastDoneLabel(last.daysAgo)),
		rating: last.rating,
		note: last.note
	};
}
