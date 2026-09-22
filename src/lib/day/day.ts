/**
 * When "today" rolls over — as a pure function.
 *
 * The clock is an ARGUMENT, exactly as it is in `src/lib/urgency/`. That is what
 * makes a day boundary testable across a DST transition without waiting for
 * October, and it is why this lives here rather than being computed in SQL with
 * `AT TIME ZONE`: a user-supplied zone string never has to reach the database at
 * request time.
 *
 * The zone comes from `users.timezone` rather than a fixed `APP_TZ`. The app is
 * single-user today, so a constant would have worked — but the column costs one
 * `text` and removes a whole class of "why is my session on yesterday" bug from
 * the day someone else logs in.
 */

/** What a new user gets. Also the backfill value in migration 0002. */
export const DEFAULT_TIMEZONE = 'Europe/Ljubljana';

/**
 * `Intl` is the only IANA database in the runtime, and it is authoritative:
 * it knows every historical DST rule, which hand-rolled offset arithmetic does
 * not. An unknown zone makes the constructor throw `RangeError`.
 */
function partsIn(
	timeZone: string,
	at: Date,
	options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }
): Record<string, string> {
	let formatter: Intl.DateTimeFormat;
	try {
		formatter = new Intl.DateTimeFormat('en-US', { timeZone, ...options });
	} catch {
		// Named, rather than letting an opaque ICU RangeError surface as a 500.
		// The only way to get here is a hand-edited `users.timezone`.
		throw new Error(`Unknown IANA time zone: ${JSON.stringify(timeZone)}`);
	}

	const out: Record<string, string> = {};
	for (const p of formatter.formatToParts(at)) out[p.type] = p.value;
	return out;
}

/**
 * The local calendar day containing `now`, as `YYYY-MM-DD`.
 *
 * `dayStartHour` exists so moving the rollover to 4am — for people who train
 * late and think of 1am as "still tonight" — is a one-constant change rather
 * than a rewrite. It shifts the INSTANT backwards before the zone conversion,
 * so an hour lost or repeated to DST is handled by the zone rules rather than
 * by arithmetic here.
 *
 * The parts are assembled by hand instead of trusting a locale to emit
 * `YYYY-MM-DD`: `en-CA` happens to, but that is an ICU data detail, and the
 * value goes straight into a `date` column.
 */
export function localDay(now: number, timeZone: string, dayStartHour = 0): string {
	if (!Number.isFinite(now)) throw new TypeError(`localDay needs a finite epoch, got ${now}`);

	const at = new Date(now - dayStartHour * 3_600_000);
	const { year, month, day } = partsIn(timeZone, at);
	return `${year}-${month}-${day}`;
}

/**
 * The wall-clock time of an instant, `HH:MM`, in the user's own zone.
 *
 * The SAME zone `localDay` uses, deliberately. A set logged at 00:30 is filed
 * under a day that zone chose, so rendering it in the device's zone could print
 * a time contradicting the heading it sits beneath — and it would also differ
 * between the server render and the client one.
 *
 * `hourCycle: 'h23'` rather than a locale default: this is a timestamp in a
 * list, and `12:05 AM` sorts and scans worse than `00:05`.
 */
export function timeOfDay(at: number, timeZone: string): string {
	if (!Number.isFinite(at)) throw new TypeError(`timeOfDay needs a finite epoch, got ${at}`);

	const { hour, minute } = partsIn(timeZone, new Date(at), {
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	});
	return `${hour}:${minute}`;
}

/** Whether a string is a zone `localDay` will accept. For validating input. */
export function isValidTimeZone(timeZone: string): boolean {
	try {
		partsIn(timeZone, new Date(0));
		return true;
	} catch {
		return false;
	}
}

/** `YYYY-MM-DD`, the shape `localDay` emits and the `?day=` parameter carries. */
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Is this a real calendar day in the stored format?
 *
 * Shape AND validity: `2026-02-31` matches the pattern and is not a date. The
 * round-trip through `Date` catches it, because JS rolls the overflow forward
 * to March and the string no longer matches itself.
 */
export function isValidDay(day: string): boolean {
	if (!DAY_RE.test(day)) return false;
	const t = Date.parse(`${day}T00:00:00Z`);
	if (Number.isNaN(t)) return false;
	return new Date(t).toISOString().slice(0, 10) === day;
}

/**
 * Move a calendar day by whole days.
 *
 * Arithmetic in UTC on purpose. These are plain calendar labels, not instants —
 * shifting them through a zone would land on 23:00 the previous day on a DST
 * boundary and page back two days instead of one.
 */
export function shiftDay(day: string, delta: number): string {
	const t = Date.parse(`${day}T00:00:00Z`);
	if (Number.isNaN(t)) return day;
	return new Date(t + delta * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Whole calendar days from `from` to `to`, positive when `to` is later.
 *
 * UTC arithmetic for the same reason as `shiftDay`: these are calendar labels,
 * not instants. Counting them through a zone would make the gap either side of
 * a DST boundary 0 or 2 days depending on which way the clock went, and the
 * answer "you last did this 6 days ago" would be wrong twice a year.
 *
 * An unparseable day gives 0 rather than NaN — a gap label is decoration, and
 * `NaN days` on screen is worse than no label.
 */
export function daysBetween(from: string, to: string): number {
	const a = Date.parse(`${from}T00:00:00Z`);
	const b = Date.parse(`${to}T00:00:00Z`);
	if (Number.isNaN(a) || Number.isNaN(b)) return 0;
	return Math.round((b - a) / 86_400_000);
}

/**
 * A duration in words: `1h 12m`, `12m`, `<1m`.
 *
 * Not `HH:MM` — at a glance "1h 12m" cannot be misread as a clock time, which
 * `1:12` sitting next to a date very much can.
 */
export function formatSpan(ms: number): string {
	const minutes = Math.floor(ms / 60_000);
	if (minutes < 1) return '<1m';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * The instant of 12:00 local time on a calendar day.
 *
 * Used when back-filling a set on a past day: the real time is unknown, and
 * noon is the one wall-clock time that can never land on a neighbouring day,
 * whichever way DST moved. Found by reading the zone's own clock at a first
 * guess and correcting by the difference — the offset cannot change between
 * the guess and noon, because DST transitions happen in the small hours.
 */
export function noonOf(day: string, timeZone: string): number {
	const guess = Date.parse(`${day}T12:00:00Z`);
	const [h, m] = timeOfDay(guess, timeZone).split(':').map(Number);
	return guess - ((h - 12) * 60 + m) * 60_000;
}
