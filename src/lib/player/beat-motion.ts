/**
 * The player's count on the beat (spec 2026-11-10-motion-round-1, "The player
 * on the beat"). PURE: the stage reads the playhead every frame and asks here
 * what the step it just saw should look like. Only a plain step forward moves:
 * a seek, a jump, a loop restart, a pause or a count-off change the count at
 * once, still.
 */

export type StepMotion = 'none' | 'push' | 'strong' | 'disc';

/**
 * How big a count starts before it settles to its size: a push, the 5's harder
 * one, the 1's hardest. Every count is largest on its beat; the 1 once grew in
 * from .8 and felt late.
 */
export const PUSH = { push: 1.045, strong: 1.09, disc: 1.12 } as const;

export function stepMotion(
	prev: number,
	index: number,
	count: number | null,
	paused: boolean,
	off: boolean
): StepMotion {
	if (index !== prev + 1 || paused || off || count === null) return 'none';
	if (count === 1) return 'disc';
	if (count === 5) return 'strong';
	return 'push';
}

/** A push lasts 85 % of a step (the last one seen, or 180 BPM's), so it is gone before the next. */
export function beatLife(stepMs: number | null): number {
	const step = Math.min(1000, Math.max(150, stepMs ?? 333));
	return step * 0.85;
}

/** The call changes to what Next said: Next rises into it. Any other change of call is a jump. */
export function callMoves(
	prev: { now: string | null; next: string | null },
	now: string | null
): boolean {
	return now !== null && now !== prev.now && now === prev.next;
}
