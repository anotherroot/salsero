/**
 * What a keyed list's change looks like as motion (FLIP: first, last, invert,
 * play). PURE: the boxes come from `flip.svelte.ts`, which measures them.
 * Tops are relative to the list's own top, so a scroll never counts as a move.
 */

export type Box = { top: number; height: number };

export type FlipPlan = {
	/** Rows in both: how far each must start from where it is now (before − after). */
	moves: { key: string; dy: number }[];
	/** New rows. */
	entering: string[];
	/** Rows gone. */
	leaving: string[];
};

/** Under this a move is rounding or a hairline, not a move. */
const STILL = 0.5;

export function flipPlan(before: Map<string, Box>, after: Map<string, Box>): FlipPlan {
	const moves: FlipPlan['moves'] = [];
	const entering: string[] = [];
	for (const [key, box] of after) {
		const was = before.get(key);
		if (!was) entering.push(key);
		else if (Math.abs(was.top - box.top) >= STILL) moves.push({ key, dy: was.top - box.top });
	}
	const leaving = [...before.keys()].filter((key) => !after.has(key));
	return { moves, entering, leaving };
}
