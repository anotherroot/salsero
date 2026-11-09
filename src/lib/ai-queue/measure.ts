/**
 * The video sections experiment's measure (AI connector plan 3). PURE.
 * The AI's sections on a video against the person's own: pairs by largest
 * overlap first (over the union, at least 0.3), each section in at most one
 * pair; a pair is close when both ends are within the tolerance. What is left
 * of the person's is missed, what is left of the AI's is extra.
 */
export type Span = { startMs: number; endMs: number; label?: string | null };

export type Comparison = {
	pairs: { mine: Span; ai: Span; startDeltaMs: number; endDeltaMs: number; close: boolean }[];
	missed: Span[];
	extra: Span[];
};

const MIN_OVERLAP = 0.3;

function overlapOverUnion(a: Span, b: Span): number {
	const inter = Math.min(a.endMs, b.endMs) - Math.max(a.startMs, b.startMs);
	if (inter <= 0) return 0;
	return inter / (Math.max(a.endMs, b.endMs) - Math.min(a.startMs, b.startMs));
}

export function compareSections(mine: Span[], ai: Span[], toleranceMs = 2000): Comparison {
	const candidates = mine
		.flatMap((m, i) => ai.map((a, j) => ({ i, j, score: overlapOverUnion(m, a) })))
		.filter((c) => c.score >= MIN_OVERLAP)
		.sort((x, y) => y.score - x.score);
	const usedMine = new Set<number>();
	const usedAi = new Set<number>();
	const pairs: Comparison['pairs'] = [];
	for (const c of candidates) {
		if (usedMine.has(c.i) || usedAi.has(c.j)) continue;
		usedMine.add(c.i);
		usedAi.add(c.j);
		const m = mine[c.i];
		const a = ai[c.j];
		const startDeltaMs = a.startMs - m.startMs;
		const endDeltaMs = a.endMs - m.endMs;
		pairs.push({
			mine: m,
			ai: a,
			startDeltaMs,
			endDeltaMs,
			close: Math.abs(startDeltaMs) <= toleranceMs && Math.abs(endDeltaMs) <= toleranceMs
		});
	}
	pairs.sort((x, y) => x.mine.startMs - y.mine.startMs);
	return {
		pairs,
		missed: mine.filter((_, i) => !usedMine.has(i)),
		extra: ai.filter((_, j) => !usedAi.has(j))
	};
}
