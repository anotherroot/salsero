/**
 * The app's motion vocabulary (spec 2026-11-10-motion-round-1): three
 * durations and three easings, the same as the CSS's `--motion-*` and
 * `--ease-*` (layout.css). Nothing waits on motion: an animation is only ever
 * drawn over a change that has already happened.
 */

export const MS = { short: 150, medium: 260, long: 380 } as const;

/** Things moving into place. */
export const ARRIVE = 'cubic-bezier(0.2, 0, 0, 1)';
/** A small overshoot: checks, pops, a press let go. */
export const SETTLE = 'cubic-bezier(0.3, 1.35, 0.6, 1)';
/** Things going away. */
export const LEAVE = 'cubic-bezier(0.4, 0, 1, 1)';

/** Reduced motion asked for. False where there is no `matchMedia` (the server, a spec). */
export function reducedMotion(): boolean {
	return (
		typeof globalThis.matchMedia === 'function' &&
		globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

/**
 * `el.animate`, unless reduced motion is asked for (or there is no Web
 * Animations): then nothing, and null. Arrives unless told otherwise.
 */
export function play(
	el: Element,
	frames: Keyframe[],
	opts: KeyframeAnimationOptions
): Animation | null {
	if (reducedMotion() || typeof el.animate !== 'function') return null;
	return el.animate(frames, { easing: ARRIVE, ...opts });
}
