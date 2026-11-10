import { PUSH, beatLife, stepMotion } from '$lib/player/beat-motion';
import { SETTLE, play } from './motion';

/**
 * The count's push on each beat, for a digit read every animation frame from
 * the playhead (StageCount, RunLayer's strip). It starts in the same frame the
 * digit changes, so it follows the audio clock; it never runs a timer of its own.
 */

/** The last plain step's length in ms, from any count on screen (the call's rise reads it). */
let lastStep: number | null = null;
export const stepMs = (): number | null => lastStep;

export function beatPulse(o: { disc: boolean }) {
	let prev = -1;
	let at: number | null = null;
	let running: Animation | null = null;

	/** Call every frame with the playhead's beat; it acts only when the beat changes. */
	return (
		el: Element | undefined,
		index: number,
		count: number | null,
		paused: boolean,
		off: boolean
	): void => {
		if (index === prev) return;
		const now = performance.now();
		if (index === prev + 1 && at !== null) lastStep = now - at;
		const kind = stepMotion(prev, index, count, paused, off);
		prev = index;
		at = now;
		if (kind === 'none' || !el) return;
		running?.cancel();
		const duration = beatLife(lastStep);
		running =
			kind === 'disc' && o.disc
				? play(el, [{ transform: `scale(${PUSH.disc})` }, { transform: 'none' }], {
						duration,
						easing: SETTLE
					})
				: play(
						el,
						[
							{ transform: `scale(${kind === 'strong' ? PUSH.strong : PUSH.push})` },
							{ transform: 'none' }
						],
						{ duration }
					);
	};
}
