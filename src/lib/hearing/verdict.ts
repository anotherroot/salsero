/**
 * The one thing to work on, from every counted beat of a round: the target
 * position you were furthest off on (past 60 ms), else the one missed most,
 * else all on time. PURE. Spec: "Phase 1b", 6.
 */

const OFF_MS = 60;

export type Verdict =
	| { kind: 'late' | 'early'; pos: number; ms: number }
	| { kind: 'missed'; pos: number; misses: number; of: number }
	| { kind: 'onTime' };

export function verdictOf(
	beats: { pos: number; offset: number | null }[],
	positions: number[]
): Verdict {
	let off: { pos: number; mean: number } | null = null;
	let missed: { pos: number; misses: number; of: number } | null = null;
	for (const pos of positions) {
		const mine = beats.filter((b) => b.pos === pos);
		const hits = mine.filter((b) => b.offset !== null);
		if (hits.length) {
			const mean = (hits.reduce((s, b) => s + (b.offset ?? 0), 0) / hits.length) * 1000;
			if (Math.abs(mean) > OFF_MS && (!off || Math.abs(mean) > Math.abs(off.mean)))
				off = { pos, mean };
		}
		const misses = mine.length - hits.length;
		if (misses > 0 && (!missed || misses > missed.misses))
			missed = { pos, misses, of: mine.length };
	}
	if (off)
		return {
			kind: off.mean > 0 ? 'late' : 'early',
			pos: off.pos,
			ms: Math.round(Math.abs(off.mean))
		};
	if (missed) return { kind: 'missed', ...missed };
	return { kind: 'onTime' };
}
