/**
 * PURE: the seek bar's maths — where the user's 1s sit on it, where a pointer
 * lands, and what each key does. Client-safe. Times are in seconds.
 */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Each time inside the song as a percent along it; times outside are dropped. */
export function tickPercents(times: number[], duration: number): number[] {
	if (!(duration > 0)) return [];
	return times.filter((t) => t >= 0 && t <= duration).map((t) => (t / duration) * 100);
}

/** How far along a track (from `left`, `width` wide) the pointer at `x` is, 0–1. */
export function seekFraction(x: number, left: number, width: number): number {
	if (!(width > 0)) return 0;
	return clamp((x - left) / width, 0, 1);
}

const STEP: Record<string, number> = {
	ArrowLeft: -5,
	ArrowDown: -5,
	ArrowRight: 5,
	ArrowUp: 5,
	PageDown: -30,
	PageUp: 30
};

/** Where a key moves the playhead from `value`, or null for a key the bar ignores. */
export function seekKey(key: string, value: number, duration: number): number | null {
	const end = Math.max(0, duration);
	if (key === 'Home') return 0;
	if (key === 'End') return end;
	const step = STEP[key];
	return step === undefined ? null : clamp(value + step, 0, end);
}
