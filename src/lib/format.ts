/** Display strings shared by several screens. Client-safe, pure. */

export function lastDoneLabel(daysAgo: number | null): string {
	if (daysAgo === null) return 'Never done';
	if (daysAgo === 0) return 'Today';
	if (daysAgo === 1) return 'Yesterday';
	return `${daysAgo} days ago`;
}

export function setSummary(s: {
	durationS: number | null;
	reps: number | null;
	rating: number | null;
}): string {
	const parts: string[] = [];
	// A logged set that ran under 30 s must not round down to "0 min" — match
	// `minutesFrom`'s floor of 1 for anything above zero.
	if (s.durationS !== null) {
		const min = s.durationS > 0 ? Math.max(1, Math.round(s.durationS / 60)) : 0;
		parts.push(`${min} min`);
	}
	if (s.reps !== null) parts.push(`${s.reps} reps`);
	if (s.rating !== null) parts.push(`${'★'.repeat(s.rating)}`);
	return parts.join(' · ');
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * `2026-09-22` → `Tue 22 Sep`. Built by hand rather than with
 * `toLocaleDateString`: ICU versions disagree ("Sep" vs "Sept"), and the
 * server and browser render the same header, so they must agree exactly or
 * hydration flickers. Read in UTC because a day label is not an instant.
 */
export function dayLabel(day: string): string {
	const d = new Date(`${day}T12:00:00Z`);
	return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
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

/** `2026-09-22` → `22 Sep 2026`. Same reasoning as `dayLabel`. */
export function dateLabel(day: string): string {
	const d = new Date(`${day}T12:00:00Z`);
	return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Bytes as a short human size: `0 MB`, `740 MB`, `1.2 GB`. Lesson videos run to
 * a gigabyte, so rounding everything to whole megabytes (as the figure page
 * once did inline) stops saying anything useful.
 */
export function byteSize(bytes: number): string {
	const mb = bytes / 1024 / 1024;
	if (mb < 1024) return `${bytes > 0 && mb < 1 ? '<1' : Math.round(mb)} MB`;
	return `${(mb / 1024).toFixed(1)} GB`;
}

/** A song position in seconds as `m:ss`. */
export function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const LONG_WEEKDAYS = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
];
const LONG_MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

/** `2026-10-31` → `Saturday, 31 October`. Built by hand, like `dayLabel`. */
export function longDayLabel(day: string): string {
	const d = new Date(`${day}T12:00:00Z`);
	return `${LONG_WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${LONG_MONTHS[d.getUTCMonth()]}`;
}

/** `2026-10-26` → `26 Oct`. Built by hand, like `dayLabel`. */
export function dayMonth(day: string): string {
	const d = new Date(`${day}T12:00:00Z`);
	return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** `2026-10-28` → `28 October 2026`. Built by hand, like `dayLabel`. */
export function fullDateLabel(day: string): string {
	const d = new Date(`${day}T12:00:00Z`);
	return `${d.getUTCDate()} ${LONG_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `2026-10-28` → `October 2026`. */
export function monthLabel(day: string): string {
	const d = new Date(`${day}T12:00:00Z`);
	return `${LONG_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `2026-10-28` → `Wed`. */
export function weekdayShort(day: string): string {
	return WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()];
}

/** "1 slot", "4 slots". */
export function plural(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

/**
 * "5 min ago", from two epoch-ms instants: how long since someone changed
 * something ("Edited by Ana · 10 min ago", History, the clash sheet).
 */
export function agoText(at: number, now: number): string {
	const min = Math.floor(Math.max(0, now - at) / 60_000);
	if (min < 1) return 'just now';
	if (min < 60) return `${min} min ago`;
	const h = Math.floor(min / 60);
	if (h < 24) return `${h} h ago`;
	const d = Math.floor(h / 24);
	return d === 1 ? 'yesterday' : `${d} days ago`;
}
