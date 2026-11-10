/**
 * How long the sound takes to reach the ear, so the count on screen can wait
 * for it. Bluetooth headphones add ~150–300 ms; a wired pair or the speaker
 * almost nothing. The song and the clave travel the same way and arrive
 * together, so only the screen is early, and only the screen waits.
 *
 * Two parts: what the phone reports (the AudioContext's own latencies, read
 * while it plays, so a pair connected mid-run counts) and the person's own
 * correction on top, for a phone that reports wrong. The correction belongs to
 * the phone and its headphones, not to the account: it lives in this browser.
 * Every storage access is wrapped: private-mode Safari throws on any touch.
 */

export const DELAY_STEP_MS = 10;
/** The whole wait the person can set: 0 (the screen as it was) to most of a second. */
export const DELAY_MAX_MS = 800;

const KEY = 'sound.delayMs';

interface Latencies {
	outputLatency?: number;
	baseLatency?: number;
}

const seconds = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * What the phone says its sound takes, in ms. `baseLatency` is the browser's
 * own buffer, `outputLatency` the system's from there to the ear; a browser
 * that knows neither (older Safari) says 0, and the correction carries it.
 */
export function reportedDelayMs(ctx: Latencies | null): number {
	if (!ctx) return 0;
	return Math.round((seconds(ctx.baseLatency) + seconds(ctx.outputLatency)) * 1000);
}

/** The count's whole wait in ms: never below 0, never past the maximum. */
export function totalDelayMs(reportedMs: number, correctionMs: number): number {
	return Math.min(DELAY_MAX_MS, Math.max(0, reportedMs + correctionMs));
}

/** The correction that makes the whole wait `totalMs`, given what the phone reports now. */
export function correctionFor(totalMs: number, reportedMs: number): number {
	return totalDelayMs(totalMs, 0) - reportedMs;
}

export function parseDelayCorrection(raw: string | null): number {
	const n = raw === null ? NaN : Number(raw);
	if (!Number.isFinite(n)) return 0;
	return Math.max(-DELAY_MAX_MS, Math.min(DELAY_MAX_MS, Math.round(n)));
}

export function loadDelayCorrection(): number {
	try {
		return parseDelayCorrection(localStorage.getItem(KEY));
	} catch {
		return 0;
	}
}

export function saveDelayCorrection(ms: number): void {
	try {
		localStorage.setItem(KEY, String(parseDelayCorrection(String(ms))));
	} catch {
		// Private mode or storage full: the correction holds for this run only.
	}
}
