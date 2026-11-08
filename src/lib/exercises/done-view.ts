/** The one page's words: the band's subtitle, the sheet's, the toasts and the pinned bar. PURE, client-safe. */
import { clock, dayLabel, weekdayDayMonth } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { learningWords } from '$lib/schedule/comes-back';
import { backWords } from '$lib/schedule/words';
import type { RunPlace } from './run';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * "Drill · learning · 3:20", "Drill · warm-up · 6:30"; in a run the place before
 * the time: "Drill · 3 of 7 · 4:12".
 */
export function bandSubtitle(i: {
	label: string;
	warmup: boolean;
	learning: boolean;
	seconds: number;
	place?: RunPlace | null;
}): string {
	const w = t().exercise.done;
	return [
		i.label,
		i.warmup ? w.warmup : null,
		i.learning ? w.learning : null,
		i.place ? w.place(i.place.at, i.place.of) : null,
		clock(i.seconds)
	]
		.filter((p) => p !== null)
		.join(' · ');
}

/**
 * The sheet's muted line: the time, the learning progress, or a past day's name
 * and date. In a run, " · Next: <name>" after the time or the learning words
 * (none on the last).
 */
export function doneSubtitle(i: {
	seconds: number | null;
	learning: { good: number; of: 3 | 5 } | null;
	day: string | null;
	name: string;
	next?: string | null;
}): string {
	if (i.day !== null) return `${i.name} · ${weekdayDayMonth(i.day)}`;
	const lead = i.learning ? learningWords(i.learning) : i.seconds === null ? '' : clock(i.seconds);
	if (!i.next) return lead;
	const next = t().exercise.done.next(i.next);
	return lead ? `${lead} · ${next}` : next;
}

/** "Saved · back in 12 days", "Saved · back tomorrow". */
export function savedMessage(backDays: number): string {
	return t().exercise.done.saved(lower(backWords(backDays)));
}

/** "Added to Thu 5 Nov". */
export function addedMessage(day: string): string {
	return t().exercise.done.added(dayLabel(day));
}

/**
 * The pinned bar: Done, or Done today once the day has an entry. A fixed rhythm
 * in a run, not done today: the green Done · next, which saves and goes on.
 */
export function doneBar(i: { doneToday: boolean; fixedInRun?: boolean }): {
	label: string;
	kind: 'primary' | 'done-soft' | 'done';
} {
	const w = t().exercise.done;
	if (i.fixedInRun && !i.doneToday) return { label: w.doneNext, kind: 'done' };
	return {
		label: i.doneToday ? w.doneToday : t().exercise.log.done,
		kind: i.doneToday ? 'done-soft' : 'primary'
	};
}
