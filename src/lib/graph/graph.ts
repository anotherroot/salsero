/**
 * The figure graph: which figures can follow which, derived from the handholds
 * each one starts and ends at.
 *
 * PURE and client-safe. No database, no DOM, no `Date.now()`, and — like
 * `day/` and `urgency/` — no idea that dances exist: the data-access layer
 * scopes to one dance before building a `Graph`.
 *
 * Nothing here is stored. "What follows this figure" is recomputed per request
 * for the same reason urgency is: a cached answer is a second source of truth
 * that goes stale the moment a tag is edited.
 *
 * An UNTAGGED figure reads as neutral on both sides. That is what lets the
 * feature ship without a backfill: a repertoire nobody has tagged is one big
 * hub, which is honest for casino — most figures really do run open → open —
 * and it means the drill behaves exactly as it did before any tagging began.
 */

export interface GraphFigure {
	id: number;
	/** Position ids the figure can start from. Empty means the neutral one. */
	starts: number[];
	/** Where it leaves the hands. Null means the neutral one. */
	end: number | null;
	/** How many 8-counts it takes. */
	eights: number;
}

export interface Graph {
	/** The dance's neutral position id: what an untagged figure resolves to. */
	neutral: number;
	figures: GraphFigure[];
}

export function startsOf(g: Graph, f: GraphFigure): number[] {
	return f.starts.length > 0 ? f.starts : [g.neutral];
}

export function endOf(g: Graph, f: GraphFigure): number {
	return f.end ?? g.neutral;
}

export function figureById(g: Graph, id: number): GraphFigure | null {
	return g.figures.find((f) => f.id === id) ?? null;
}

/** Figures that can be danced from this position, in `g.figures` order. */
export function figuresFrom(g: Graph, positionId: number): number[] {
	return g.figures.filter((f) => startsOf(g, f).includes(positionId)).map((f) => f.id);
}

/** Figures that leave the hands at this position. */
export function figuresTo(g: Graph, positionId: number): number[] {
	return g.figures.filter((f) => endOf(g, f) === positionId).map((f) => f.id);
}

/** What can come after this figure. The figure page's "Leads to". */
export function follows(g: Graph, figureId: number): number[] {
	const f = figureById(g, figureId);
	return f ? figuresFrom(g, endOf(g, f)) : [];
}

/** What can come before it. The figure page's "Follows from". */
export function precedes(g: Graph, figureId: number): number[] {
	const f = figureById(g, figureId);
	if (!f) return [];
	const entries = new Set(startsOf(g, f));
	return g.figures.filter((o) => entries.has(endOf(g, o))).map((o) => o.id);
}

export interface PositionCount {
	id: number;
	/** Figures ending here. */
	inCount: number;
	/** Figures startable here. */
	outCount: number;
	/** Reachable but not leaveable — the walk has to reset out of it. */
	deadEnd: boolean;
	/** Leaveable but unreachable — nothing you know gets you here. */
	orphan: boolean;
	/** Neither side. Not a fault, just a position nothing uses yet. */
	unused: boolean;
}

/**
 * The gap report: how many figures enter and leave each position.
 *
 * This is the "what should I learn next" answer, which is why a dead end and an
 * orphan are named separately — one is a corner you get stuck in, the other is
 * a corner you can never reach.
 */
export function positionCounts(g: Graph, positionIds: number[]): PositionCount[] {
	return positionIds.map((id) => {
		const inCount = figuresTo(g, id).length;
		const outCount = figuresFrom(g, id).length;
		return {
			id,
			inCount,
			outCount,
			deadEnd: inCount > 0 && outCount === 0,
			orphan: outCount > 0 && inCount === 0,
			unused: inCount === 0 && outCount === 0
		};
	});
}

/** Positions you can get into but not out of. */
export function deadEnds(g: Graph, positionIds: number[]): number[] {
	return positionCounts(g, positionIds)
		.filter((c) => c.deadEnd)
		.map((c) => c.id);
}

/** Positions you could leave, if anything you knew got you there. */
export function orphans(g: Graph, positionIds: number[]): number[] {
	return positionCounts(g, positionIds)
		.filter((c) => c.orphan)
		.map((c) => c.id);
}
