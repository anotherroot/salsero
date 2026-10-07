/**
 * The arithmetic of tapping a progress bar. DOM-free, like `drag.ts`: the
 * component measures the bar and feeds the pointer's x in.
 */

/**
 * The song time under the pointer: `x` within a bar `width` wide starting at
 * `left`, clamped to the bar so a drag past either end pins to 0 or `duration`.
 * Zero when the duration is not known yet (metadata still loading).
 */
export function seekTime(x: number, left: number, width: number, duration: number): number {
	if (!(width > 0) || !Number.isFinite(duration) || duration <= 0) return 0;
	return Math.min(1, Math.max(0, (x - left) / width)) * duration;
}
