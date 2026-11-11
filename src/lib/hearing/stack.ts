/**
 * Result B's stack: every judged tap of a round under the circle it was for,
 * left or right by how early or late it was, taps on one circle stacked
 * downward. PURE geometry; the component draws it. Spec: "Phase 1b", 6.
 */
import { SPOT_ON_S } from './judge';

/** Rows a circle's taps stack into before starting again at the top. */
export const STACK_ROWS = 10;
/** A tap further off than this (in beats) is drawn at this distance: it stays under its circle. */
export const STACK_CLAMP_BEATS = 0.45;

export interface StackDot {
	pos: number;
	/** Beats from the circle, + = late, clamped. */
	dx: number;
	row: number;
	state: 'spot' | 'close';
}

export function stackDots(
	beats: { pos: number; offset: number | null }[],
	beatS: number
): StackDot[] {
	const byPos = new Map<number, number[]>();
	for (const b of beats) {
		if (b.offset === null) continue;
		const list = byPos.get(b.pos) ?? [];
		list.push(b.offset);
		byPos.set(b.pos, list);
	}
	const dots: StackDot[] = [];
	for (const [pos, offsets] of byPos) {
		offsets
			.sort((a, b) => a - b)
			.forEach((off, i) => {
				const dx = Math.max(-STACK_CLAMP_BEATS, Math.min(STACK_CLAMP_BEATS, off / beatS));
				dots.push({
					pos,
					dx,
					row: i % STACK_ROWS,
					state: Math.abs(off) <= SPOT_ON_S + 1e-9 ? 'spot' : 'close'
				});
			});
	}
	return dots;
}

/** The most rows any circle uses: the stack's height. At least one. */
export function stackDepth(dots: StackDot[]): number {
	return Math.max(1, ...dots.map((d) => d.row + 1));
}
