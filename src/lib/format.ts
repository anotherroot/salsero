/**
 * Display strings shared by several screens. Client-safe, pure. The words come
 * from the current language's catalog (`t().format`), read at call time.
 */
import { t } from '$lib/i18n/catalog';
import type { DayParts } from '$lib/i18n/en/format';
import { feelOf, feelWord } from '$lib/schedule/feel';

/**
 * English only: "1 slot", "4 slots". A Slovenian count needs `slCount`
 * (`$lib/i18n/plural`); new words go in a catalog, where `en/*` uses this.
 */
export { plural } from '$lib/i18n/en/plural';

/** The first letter in upper case: "danes" → "Danes", at the start of a label. */
export function firstUpper(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export function lastDoneLabel(daysAgo: number | null): string {
	const f = t().format;
	if (daysAgo === null) return f.neverDone;
	if (daysAgo === 0) return firstUpper(f.today);
	if (daysAgo === 1) return firstUpper(f.yesterday);
	return firstUpper(f.daysAgo(daysAgo));
}

export function setSummary(s: {
	durationS: number | null;
	reps: number | null;
	rating: number | null;
}): string {
	const f = t().format;
	const parts: string[] = [];
	// A logged set that ran under 30 s must not round down to "0 min" — match
	// `minutesFrom`'s floor of 1 for anything above zero.
	if (s.durationS !== null) {
		const min = s.durationS > 0 ? Math.max(1, Math.round(s.durationS / 60)) : 0;
		parts.push(f.minutes(min));
	}
	if (s.reps !== null) parts.push(f.reps(s.reps));
	const feel = feelOf(s.rating);
	if (feel !== null) parts.push(feelWord(feel));
	return parts.join(' · ');
}

/** A day's parts, read in UTC because a day label is not an instant. */
function partsOf(day: string): DayParts {
	const d = new Date(`${day}T12:00:00Z`);
	return {
		weekday: d.getUTCDay(),
		date: d.getUTCDate(),
		month: d.getUTCMonth(),
		year: d.getUTCFullYear()
	};
}

/**
 * `2026-09-22` → `Tue 22 Sep` ("tor, 22. sep."). Built by hand rather than with
 * `toLocaleDateString`: ICU versions disagree ("Sep" vs "Sept"), and the
 * server and browser render the same header, so they must agree exactly or
 * hydration flickers.
 */
export function dayLabel(day: string): string {
	return t().format.dayLabel(partsOf(day));
}

/**
 * The day of a class, as Today shows it beside "Lesson": `Tue 28 Oct`, with the
 * year added only when it is not `today`'s — classes are weekly, so the weekday
 * is what tells two apart.
 */
export function classDayLabel(day: string, today: string): string {
	return day.slice(0, 4) === today.slice(0, 4)
		? dayLabel(day)
		: `${dayLabel(day)} ${day.slice(0, 4)}`;
}

/** `2026-09-22` → `22 Sep 2026` ("22. sep. 2026"). Same reasoning as `dayLabel`. */
export function dateLabel(day: string): string {
	return t().format.dateLabel(partsOf(day));
}

/**
 * Bytes as a short human size: `0 MB`, `740 MB`, `1.2 GB` ("1,2 GB"). Lesson
 * videos run to a gigabyte, so rounding everything to whole megabytes (as the
 * figure page once did inline) stops saying anything useful.
 */
export function byteSize(bytes: number): string {
	const mb = bytes / 1024 / 1024;
	if (mb < 1024) return `${bytes > 0 && mb < 1 ? '<1' : Math.round(mb)} MB`;
	return `${t().common.decimal(mb / 1024, 1)} GB`;
}

/** A song position in seconds as `m:ss`. */
export function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** `2026-10-31` → `Saturday, 31 October`. Built by hand, like `dayLabel`. */
export function longDayLabel(day: string): string {
	return t().format.longDay(partsOf(day));
}

/**
 * `2026-10-13` → `Tuesday 13 October`: a class's day on a row, as the boards
 * write it (no comma in English: that is Today's band, `longDayLabel`).
 */
export function weekdayDayMonth(day: string): string {
	return t().format.weekdayDayMonth(partsOf(day));
}

/** `2026-11-08` → `Sunday` ("nedelja"). */
export function weekdayLong(day: string): string {
	return t().format.weekdays[partsOf(day).weekday];
}

/**
 * A month heading in a picker of lessons: `November`, with the year only when
 * it is not `today`'s (`December 2025`), as `classDayLabel` does for a day.
 */
export function monthHeading(day: string, today: string): string {
	const p = partsOf(day);
	return day.slice(0, 4) === today.slice(0, 4) ? t().format.months[p.month] : monthLabel(day);
}

/** `2026-10-26` → `26 Oct`. Built by hand, like `dayLabel`. */
export function dayMonth(day: string): string {
	return t().format.dayMonth(partsOf(day));
}

/** `2026-10-28` → `28 October 2026`. Built by hand, like `dayLabel`. */
export function fullDateLabel(day: string): string {
	return t().format.fullDate(partsOf(day));
}

/** `2026-10-28` → `October 2026`. */
export function monthLabel(day: string): string {
	return t().format.monthYear(partsOf(day));
}

/** `2026-10-28` → `Wed`. */
export function weekdayShort(day: string): string {
	return t().format.weekdaysShort[partsOf(day).weekday];
}

/**
 * "5 min ago", from two epoch-ms instants: how long since someone changed
 * something ("Edited by Ana · 10 min ago", History, the clash sheet).
 */
export function agoText(at: number, now: number): string {
	const f = t().format;
	const min = Math.floor(Math.max(0, now - at) / 60_000);
	if (min < 1) return f.justNow;
	if (min < 60) return f.minutesAgo(min);
	const h = Math.floor(min / 60);
	if (h < 24) return f.hoursAgo(h);
	const d = Math.floor(h / 24);
	return d === 1 ? f.yesterday : f.daysAgo(d);
}
