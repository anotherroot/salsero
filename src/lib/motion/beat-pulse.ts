import { beatLife, leadMotion, pushScale, stepMotion } from '$lib/player/beat-motion';
import { play } from './motion';

/**
 * The count's push on each beat, for a digit read every animation frame from
 * the playhead (StageCount, RunLayer's strip). It starts in the same frame the
 * digit changes, so it follows the audio clock; it never runs a timer of its own.
 */

/** The last plain step's length in ms, from any count on screen (the call's rise reads it). */
let lastStep: number | null = null;
export const stepMs = (): number | null => lastStep;

export function beatPulse() {
	let prev = -1;
	let at: number | null = null;
	let running: Animation | null = null;

	/**
	 * Call every frame with the playhead's beat; it acts only when the beat changes.
	 * `strength`: a lead's beat (`leadLook`), pushing that hard, the dash too.
	 */
	return (
		el: Element | undefined,
		index: number,
		count: number | null,
		paused: boolean,
		off: boolean,
		strength?: number
	): void => {
		if (index === prev) return;
		const now = performance.now();
		if (index === prev + 1 && at !== null) lastStep = now - at;
		const kind =
			strength === undefined
				? stepMotion(prev, index, count, paused, off)
				: leadMotion(prev, index, paused, strength);
		prev = index;
		at = now;
		if (kind === 'none' || !el) return;
		running?.cancel();
		const duration = beatLife(lastStep);
		running = play(el, [{ transform: `scale(${pushScale(strength)})` }, { transform: 'none' }], {
			duration
		});
	};
}
