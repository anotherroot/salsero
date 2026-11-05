/**
 * The figure graph: which figures can follow which, derived from the handholds
 * each one starts and ends in.
 *
 * PURE and client-safe. No database, no DOM, no `Date.now()`, and — like
 * `day/` and `schedule/` — no idea that dances exist: the data-access layer
 * scopes to one dance before building a `Graph`.
 *
 * Nothing here is stored. "What follows this figure" is recomputed per request
 * for the same reason the schedule is: a cached answer is a second source of truth
 * that goes stale the moment a tag is edited.
 *
 * An UNTAGGED SIDE FITS ANYTHING. Positions are optional: a figure with no
 * starts can follow anything, and a figure with no ends can be followed by
 * anything. A person who never adds a position sees no break anywhere, and a
 * routine plays exactly as it did before any tagging began. `meet` is the one
 * rule for "can these hands meet"; everything that compares positions — here,
 * in `routines/`, the picker and the player — goes through it.
 *
 * The ids are whatever the data layer hands over: one id per position family,
 * so a person's figures and a group's figures meet on the same hold, and one
 * per set of a person's twinned positions (ruling 16).
 */
import { nextCount } from './timing';

export interface GraphFigure {
	id: number;
	/** Position ids the figure can start from. Empty: it can follow anything. */
	starts: number[];
	/** Position ids it can leave the hands in. Empty: anything can follow it. */
	ends: number[];
	/**
	 * The count it begins on, 1..8. Always resolved — the data layer turns a
	 * null column into 1 before building the graph, so nothing here guesses.
	 */
	start: number;
	/** How many counts it takes. Resolved the same way; null reads as 8. */
	length: number;
}

/** A position as the graph names it. Carried, not read, by the pure code here. */
export interface GraphPosition {
	id: number;
	name: string;
	styleTag: string | null;
	/** It stands for twins (Same as…) of the person's, read as one hold (ruling 16). */
	twins: boolean;
}

export interface Graph {
	figures: GraphFigure[];
	positions: GraphPosition[];
}

/**
 * Whether two sides of a seam can meet: either side has no position (it fits
 * anywhere), or they share one.
 */
export function meet(a: readonly number[], b: readonly number[]): boolean {
	if (a.length === 0 || b.length === 0) return true;
	return a.some((p) => b.includes(p));
}

/** Whether `b` can be danced straight after `a`. */
export function fitsAfter(a: GraphFigure, b: GraphFigure): boolean {
	return meet(a.ends, b.starts);
}

/** The same positions, whatever the order or repeats. `[]` equals `[]`. */
export function sameSet(a: readonly number[], b: readonly number[]): boolean {
	const x = new Set(a);
	const y = new Set(b);
	return x.size === y.size && [...x].every((p) => y.has(p));
}

export function figureById(g: Graph, id: number): GraphFigure | null {
	return g.figures.find((f) => f.id === id) ?? null;
}

/** The count the figure leaves the next one to begin on. */
export function nextCountOf(f: GraphFigure): number {
	return nextCount(f.start, f.length);
}

/**
 * Figures TAGGED to start from this position, in `g.figures` order. A figure
 * with no starts fits here too, but it is not "from" here: the position's page
 * and the gap report count what names it.
 */
export function figuresFrom(g: Graph, positionId: number): number[] {
	return g.figures.filter((f) => f.starts.includes(positionId)).map((f) => f.id);
}

/** Figures tagged to leave the hands at this position. */
export function figuresTo(g: Graph, positionId: number): number[] {
	return g.figures.filter((f) => f.ends.includes(positionId)).map((f) => f.id);
}

/**
 * What can come after this figure. The figure page's "Leads to".
 *
 * A figure appears in its OWN result whenever it fits after itself — which
 * every figure with an empty side does. That is right here: this module
 * answers reachability, and "can I dance that again right now" is genuinely
 * yes. Suppressing an immediate repeat is the CALLER's decision, and the
 * figure page makes it: it drops itself from its own lists.
 */
export function follows(g: Graph, figureId: number): number[] {
	const f = figureById(g, figureId);
	return f ? g.figures.filter((o) => fitsAfter(f, o)).map((o) => o.id) : [];
}

/** What can come before it. The figure page's "Follows from". Self-inclusive, for the reason `follows` explains. */
export function precedes(g: Graph, figureId: number): number[] {
	const f = figureById(g, figureId);
	return f ? g.figures.filter((o) => fitsAfter(o, f)).map((o) => o.id) : [];
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
	/** Has figures, but cut off from the main part of the repertoire. */
	island: boolean;
	/** Neither side. Not a fault, just a position nothing uses yet. */
	unused: boolean;
}

/**
 * Which part of the repertoire each position is in, and which part is the main
 * one. Positions are joined by figures, each start to each end, undirected. The
 * main part has the most figures through it; ties go to more positions, then
 * the lowest position id. `size` is how many positions each part holds. Null
 * when no figure names a position at all.
 */
function parts(
	g: Graph
): { partOf: Map<number, number>; size: Map<number, number>; main: number } | null {
	const parent = new Map<number, number>();
	const find = (p: number): number => {
		let r = p;
		while (parent.get(r) !== r) r = parent.get(r)!;
		parent.set(p, r);
		return r;
	};
	const add = (p: number) => {
		if (!parent.has(p)) parent.set(p, p);
	};
	for (const f of g.figures) {
		for (const p of [...f.starts, ...f.ends]) add(p);
		for (const s of f.starts) for (const e of f.ends) parent.set(find(s), find(e));
	}
	if (parent.size === 0) return null;

	const partOf = new Map<number, number>();
	const stats = new Map<number, { figures: number; positions: number; lowest: number }>();
	for (const p of parent.keys()) {
		const root = find(p);
		partOf.set(p, root);
		const s = stats.get(root) ?? { figures: 0, positions: 0, lowest: p };
		s.positions++;
		s.lowest = Math.min(s.lowest, p);
		stats.set(root, s);
	}
	for (const f of g.figures) {
		const roots = new Set([...f.starts, ...f.ends].map((p) => partOf.get(p)!));
		for (const r of roots) stats.get(r)!.figures++;
	}
	let main: number | null = null;
	for (const [root, s] of stats) {
		const m = main === null ? null : stats.get(main)!;
		if (
			m === null ||
			s.figures > m.figures ||
			(s.figures === m.figures && s.positions > m.positions) ||
			(s.figures === m.figures && s.positions === m.positions && s.lowest < m.lowest)
		)
			main = root;
	}
	const size = new Map([...stats].map(([root, s]) => [root, s.positions]));
	return { partOf, size, main: main! };
}

function isIsland(p: NonNullable<ReturnType<typeof parts>>, id: number): boolean {
	const part = p.partOf.get(id);
	return part !== undefined && part !== p.main && (p.size.get(part) ?? 0) >= 2;
}

/**
 * The gap report: how many figures enter and leave each position.
 *
 * This is the "what should I learn next" answer, which is why a dead end, an
 * orphan and an island are named separately — one is a corner you get stuck
 * in, one a corner you can never reach, one a corner cut off from the rest.
 *
 * An island is a position in a part of two or more positions that is not the
 * main part. A part of ONE position is never an island: it already reads as a
 * dead end, an orphan or unused, and a second word for it says nothing more.
 */
export function positionCounts(g: Graph, positionIds: number[]): PositionCount[] {
	const p = parts(g);
	return positionIds.map((id) => {
		const inCount = figuresTo(g, id).length;
		const outCount = figuresFrom(g, id).length;
		const used = inCount > 0 || outCount > 0;
		return {
			id,
			inCount,
			outCount,
			deadEnd: inCount > 0 && outCount === 0,
			orphan: outCount > 0 && inCount === 0,
			island: used && p !== null && isIsland(p, id),
			unused: !used
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

/** The figures missing a side, in `g.figures` order: none at all, only a start, only an end. */
export function noPosition(g: Graph): { none: number[]; onlyStart: number[]; onlyEnd: number[] } {
	const out = { none: [] as number[], onlyStart: [] as number[], onlyEnd: [] as number[] };
	for (const f of g.figures) {
		const s = f.starts.length > 0;
		const e = f.ends.length > 0;
		if (!s && !e) out.none.push(f.id);
		else if (s && !e) out.onlyStart.push(f.id);
		else if (!s && e) out.onlyEnd.push(f.id);
	}
	return out;
}

/** How many figures have a position on either side, of all of them. */
export function taggedCount(g: Graph): { done: number; total: number } {
	const done = g.figures.filter((f) => f.starts.length > 0 || f.ends.length > 0).length;
	return { done, total: g.figures.length };
}
