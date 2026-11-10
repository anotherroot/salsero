/**
 * How long after hearing a beat this person's tap lands on this phone: the
 * finger and the touch screen, on top of the sound's own delay (which
 * `sound-delay.ts` already takes care of). Measured once by tapping with a
 * count, kept in this browser like the sound delay correction. PURE apart
 * from the two storage calls, each wrapped (private-mode storage throws).
 */

/** Taps in a check. */
export const CHECK_TAPS = 16;
/** The check's tempo: slow enough that a tap never sits between two beats. */
export const CHECK_BPM = 100;
/** Taps the result is read from: the last ones, once the person has settled. */
const READ_TAPS = 12;
/** A tap this far from the middle is a slip, not the person's delay. */
const SLIP_MS = 150;
/** Fewer steady taps than this, or a wider spread, and the check asks again. */
const MIN_STEADY = 9;
const MAX_SPREAD_MS = 160;
const MAX_MS = 300;
const KEY = 'hearing.tapDelayMs';

function median(xs: number[]): number {
	const s = [...xs].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** The delay from each tap's distance to its beat (ms, + = after), or null before twelve taps. */
export function tapDelayFrom(offsetsMs: number[]): { ms: number; uneven: boolean } | null {
	if (offsetsMs.length < READ_TAPS) return null;
	const last = offsetsMs.slice(-READ_TAPS);
	const middle = median(last);
	const steady = last.filter((x) => Math.abs(x - middle) <= SLIP_MS);
	const uneven =
		steady.length < MIN_STEADY || Math.max(...steady) - Math.min(...steady) > MAX_SPREAD_MS;
	const ms = Math.min(MAX_MS, Math.max(0, Math.round(median(steady) / 5) * 5));
	return { ms, uneven };
}

/**
 * A tap's place in the song, in song seconds: the song time when the handler
 * ran, less the time since the touch (`lagMs`) and the person's tap delay, both
 * real milliseconds, which pass `rate` song seconds each.
 */
export function tapSongTime(
	songNow: number,
	lagMs: number,
	tapDelayMs: number,
	rate: number
): number {
	return songNow - ((lagMs + tapDelayMs) / 1000) * rate;
}

/** The checked delay, or null when this browser was never checked. */
export function loadTapDelay(): number | null {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw === null) return null;
		const n = Number(raw);
		return Number.isFinite(n) && n >= 0 && n <= MAX_MS ? Math.round(n) : null;
	} catch {
		return null;
	}
}

export function saveTapDelay(ms: number): void {
	try {
		localStorage.setItem(KEY, String(Math.min(MAX_MS, Math.max(0, Math.round(ms)))));
	} catch {
		// Private mode or storage full: the delay holds for this visit only.
	}
}
