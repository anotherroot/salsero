/**
 * How long the player's own sound (the voice count, the clave) takes to reach
 * the ear. Bluetooth headphones add ~150–300 ms; a wired pair or the speaker
 * ~10–40 ms. The song needs nothing: the browser already holds a media
 * element's `currentTime` back by it, so the music and the screen agree. So
 * with a song the voice and the clave start early by this much; count only,
 * the screen waits by it (`attach.ts`).
 *
 * Two parts: what the phone reports (the AudioContext's own latencies, read
 * while it plays, so a pair connected mid-run counts, and held still by
 * `steadyDelay`) and the person's own correction on top, for a phone that
 * reports wrong. The correction belongs to the phone and its headphones, not
 * to the account: it lives in this browser. Every storage access is wrapped:
 * private-mode Safari throws on any touch.
 */

export const DELAY_STEP_MS = 10;
/** The whole delay the person can set: 0 to most of a second. */
export const DELAY_MAX_MS = 800;

/** Not `sound.delayMs`: that one (2026-11-10, a few hours) moved the screen with a song too. */
const KEY = 'sound.correctionMs';

/** Readings kept: ~1 s at the player's 25 ms tick. */
const WINDOW = 40;
/** A held value moves only for a change this big: the wobble is ±10–20 ms. */
const MOVE_MS = 20;

/**
 * What the phone reports, held still. The raw number wobbles by ±10–20 ms as
 * the output buffer fills and drains; the clave must not wander with it, and
 * the Voice layer's number must not flicker. The middle of the last second,
 * to 10 ms, and only a move of 20 ms or more replaces it — a pair of
 * headphones connecting (~30 → ~250 ms) shows within half a second.
 */
export function steadyDelay() {
	const readings: number[] = [];
	let held: number | null = null;
	return {
		read(ms: number): number {
			readings.push(ms);
			if (readings.length > WINDOW) readings.shift();
			const sorted = [...readings].sort((a, b) => a - b);
			const middle = sorted[Math.floor(sorted.length / 2)];
			const rounded = Math.round(middle / DELAY_STEP_MS) * DELAY_STEP_MS;
			if (held === null || Math.abs(rounded - held) >= MOVE_MS) held = rounded;
			return held;
		},
		get ms(): number {
			return held ?? 0;
		}
	};
}

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

/** The whole delay in ms: never below 0, never past the maximum. */
export function totalDelayMs(reportedMs: number, correctionMs: number): number {
	return Math.min(DELAY_MAX_MS, Math.max(0, reportedMs + correctionMs));
}

/** The correction that makes the whole delay `totalMs`, given what the phone reports now. */
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
