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
	if (s.durationS !== null) parts.push(`${Math.round(s.durationS / 60)} min`);
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

/** `2026-09-22` → `22 Sep 2026`. Same reasoning as `dayLabel`. */
export function dateLabel(day: string): string {
	const d = new Date(`${day}T12:00:00Z`);
	return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** A song position in seconds as `m:ss`. */
export function clock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
