/** The one page's words: the band's subtitle, the sheet's, the toasts and the pinned bar. PURE, client-safe. */
import { clock, dayLabel, weekdayDayMonth } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { learningWords } from '$lib/schedule/comes-back';
import { backWords } from '$lib/schedule/words';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** "Drill · learning · 3:20", "Drill · warm-up · 6:30". */
export function bandSubtitle(i: {
	label: string;
	warmup: boolean;
	learning: boolean;
	seconds: number;
}): string {
	const w = t().exercise.done;
	return [i.label, i.warmup ? w.warmup : null, i.learning ? w.learning : null, clock(i.seconds)]
		.filter((p) => p !== null)
		.join(' · ');
}

/** The sheet's muted line: the time, the learning progress, or a past day's name and date. */
export function doneSubtitle(i: {
	seconds: number | null;
	learning: { good: number; of: 3 | 5 } | null;
	day: string | null;
	name: string;
}): string {
	if (i.day !== null) return `${i.name} · ${weekdayDayMonth(i.day)}`;
	if (i.learning) return learningWords(i.learning);
	return i.seconds === null ? '' : clock(i.seconds);
}

/** "Saved · back in 12 days", "Saved · back tomorrow". */
export function savedMessage(backDays: number): string {
	return t().exercise.done.saved(lower(backWords(backDays)));
}

/** "Added to Thu 5 Nov". */
export function addedMessage(day: string): string {
	return t().exercise.done.added(dayLabel(day));
}

/** The pinned bar: Done, or Done today once the day has an entry. */
export function doneBar(i: { doneToday: boolean }): {
	label: string;
	kind: 'primary' | 'done-soft';
} {
	return {
		label: i.doneToday ? t().exercise.done.doneToday : t().exercise.log.done,
		kind: i.doneToday ? 'done-soft' : 'primary'
	};
}
