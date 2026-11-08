/**
 * The map: where each position sits on the Positions map, how big it is, and
 * what goes in the tray under it.
 *
 * PURE and client-safe: no DOM, no randomness, no clock. The same input gives
 * the same layout, whatever order its positions and edges come in, so the map
 * never jumps between visits.
 *
 * Only the main part of the repertoire is drawn (ruling 13, the gap report's
 * `positionCounts` in `graph/graph.ts`): positions with no figures go to
 * `tray.unused`, positions in an island to `tray.islands`. A part of ONE
 * position is never an island, so it is drawn, wherever the forces leave it.
 *
 * The layout: Fruchterman–Reingold over the drawn positions, `steps` (400)
 * steps from a circle in folded-name order (ideal spacing half the classic
 * √(area/n): names need the frame's room more than the springs do), then
 * passes that push circles and label boxes apart until nothing touches —
 * usually well under the brief's 60; the cap is 600 (`MAX_PASSES`), and
 * `onStats` says how many it took and whether it settled. Every node, circle
 * and label stays inside the frame: a label is at most `LABEL_MAX` characters
 * (280 px, the page cuts a longer name with `mapLabel`), and the smallest frame
 * is 360 px. A dead end's or orphan's label has a second line, its word
 * (`markBox` at `markY`), and a twinned position's (ruling 16: twins are one
 * node) a line after that, "Twins" (`twinsBox` at `twinsY`); the layout keeps
 * every line clear.
 */
import { fold } from '$lib/fold';
import { TWINS_CHIP } from '$lib/clones/twins';
import { t } from '$lib/i18n/catalog';
import { positionCounts, type Graph, type GraphFigure } from '$lib/graph/graph';

/** What the gap report says of a position (`positionCounts`). */
export interface MapGaps {
	deadEnd: boolean;
	orphan: boolean;
	island: boolean;
}

export interface MapPosition {
	id: number;
	name: string;
	styleTag: string | null;
	/** Figures through it: starting or ending here. 0 sends it to `tray.unused`. */
	figures: number;
	/** It stands for twinned positions (Same as…), drawn as one node with a Twins line. */
	twins?: boolean;
	/**
	 * The gap report's verdict. `mapInputOf` fills it from the graph, and the
	 * map trusts it; without it, the map works it out from `edges`, which
	 * cannot see a figure with only one side tagged.
	 */
	gaps?: MapGaps;
}

export interface MapInput {
	positions: MapPosition[];
	/** Figures starting at `from` and ending at `to`. `from === to` is a loop. */
	edges: { from: number; to: number; figures: number }[];
}

export interface MapNode {
	id: number;
	x: number;
	y: number;
	r: number;
	/** The centre of the name's box (`labelBox`): text-anchor middle, baseline central. */
	labelX: number;
	labelY: number;
	mark: MapMark | null;
	/**
	 * The centre of the mark word's line (`markBox`), right under the name's:
	 * `labelY + LABEL_HEIGHT`. Null without a mark.
	 */
	markY: number | null;
	twins: boolean;
	/**
	 * The centre of the Twins line (`twinsBox`): under the name's, or under the
	 * mark's when there is one. Null unless `twins`.
	 */
	twinsY: number | null;
}

export interface MapLayout {
	width: number;
	height: number;
	/** The drawn positions, by folded name, then id. */
	nodes: MapNode[];
	/** Between drawn positions only, loops included; by `from`, then `to`. */
	edges: { from: number; to: number; width: number }[];
	/** Each by folded name, then id. */
	tray: { islands: number[]; unused: number[] };
}

/**
 * How the push passes went: how many ran (the last one found nothing to push
 * when `settled`), or `MAX_PASSES` and not settled, when something may still
 * overlap. For specs and debugging; the page ignores it.
 */
export interface MapStats {
	passes: number;
	settled: boolean;
}

/** The label estimate: 7 px a character, 14 px high. */
export const LABEL_CHAR = 7;
export const LABEL_HEIGHT = 14;
/**
 * The longest name the map shows whole: past it the page cuts the name to
 * `LABEL_MAX - 1` characters and an ellipsis (`mapLabel`), so no label is wider
 * than 280 px and every one fits the smallest frame.
 */
export const LABEL_MAX = 40;
/**
 * A dead end's or orphan's word, in capitals on a second line under its name
 * (the page's 10.5 px with tracking): about 8 px a character.
 */
export const MARK_CHAR = 8;
/** Between a circle's bottom and its label's top. */
const LABEL_GAP = 4;
/** Kept clear inside the frame's edge. */
const PAD = 4;
/**
 * The push passes act on two things closer than TOUCH and part them to AIR.
 * The slack between the two is what lets the passes settle instead of
 * creeping towards zero forever.
 */
const TOUCH = 1;
const AIR = 4;
export const MAX_PASSES = 600;

/** 7 px a character of what `mapLabel` writes: at most 280 px. */
function labelWidth(name: string): number {
	return Math.min([...name].length, LABEL_MAX) * LABEL_CHAR;
}

/** 14 + 4·√figures, capped at 34. */
export function nodeRadius(figures: number): number {
	return Math.min(34, 14 + 4 * Math.sqrt(Math.max(0, figures)));
}

/** 1 + figures, capped at 6. */
export function edgeWidth(figures: number): number {
	return Math.min(6, 1 + figures);
}

/** The name as the map writes it: whole up to `LABEL_MAX` characters, else cut with an ellipsis. */
export function mapLabel(name: string): string {
	const chars = [...name];
	return chars.length <= LABEL_MAX ? name : chars.slice(0, LABEL_MAX - 1).join('') + '…';
}

/** The box a name is estimated to take on the map (`mapLabel`), centred on (x, y). */
export function labelBox(
	name: string,
	x: number,
	y: number
): { x0: number; y0: number; x1: number; y1: number } {
	const w = labelWidth(name);
	return { x0: x - w / 2, y0: y - LABEL_HEIGHT / 2, x1: x + w / 2, y1: y + LABEL_HEIGHT / 2 };
}

/** The Twins line's width: the lists' word, at the mark's size (`MARK_CHAR` a character). */
const TWINS_WIDTH = [...TWINS_CHIP].length * MARK_CHAR;

/** The box the Twins line takes (`MapNode.twinsY`), centred on (x, y). */
export function twinsBox(x: number, y: number): { x0: number; y0: number; x1: number; y1: number } {
	return {
		x0: x - TWINS_WIDTH / 2,
		y0: y - LABEL_HEIGHT / 2,
		x1: x + TWINS_WIDTH / 2,
		y1: y + LABEL_HEIGHT / 2
	};
}

/** A dead end's or orphan's mark: the key; `markWord` is what the map writes. */
export type MapMark = 'dead end' | 'orphan';

/**
 * The mark's word in the reader's language (the list's gap words): "dead end",
 * »slepa ulica«. Read inside the request, so the layout keeps room for the word
 * the page will draw.
 */
export function markWord(mark: MapMark): string {
	const gaps = t().positions.gaps;
	return mark === 'dead end' ? gaps.deadEnd : gaps.orphan;
}

/** The width a mark word takes: `MARK_CHAR` a character. */
function markWidth(mark: MapMark | null): number {
	return mark ? [...markWord(mark)].length * MARK_CHAR : 0;
}

/** The box a mark word takes on its own line (`MapNode.markY`), centred on (x, y). */
export function markBox(
	mark: MapMark,
	x: number,
	y: number
): { x0: number; y0: number; x1: number; y1: number } {
	const w = markWidth(mark);
	return { x0: x - w / 2, y0: y - LABEL_HEIGHT / 2, x1: x + w / 2, y1: y + LABEL_HEIGHT / 2 };
}

/**
 * The frame for n drawn positions: a square of 140·√n, never under 360 — about
 * 140 × 140 px a position, room for a circle and a name of twenty-odd
 * characters. The page scales it to fit and pinch-zooms it. Nothing drawn: 0.
 */
export function mapSize(n: number): { width: number; height: number } {
	if (n === 0) return { width: 0, height: 0 };
	const side = Math.max(360, Math.ceil(140 * Math.sqrt(n)));
	return { width: side, height: side };
}

/** By folded name, then id. */
function byName<T extends { id: number; name: string }>(list: readonly T[]): T[] {
	return list
		.map((p) => ({ p, key: fold(p.name) }))
		.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.p.id - b.p.id))
		.map((e) => e.p);
}

/**
 * The map's input from the viewer's graph: every position of `g`, the figures
 * through it, the figures between each pair, the gap report's verdict, so
 * the tray holds exactly what the gap report calls an island, and whether it
 * stands for twins (the graph merged them, ruling 16).
 */
export function mapInputOf(g: Graph): MapInput {
	const ids = g.positions.map((p) => p.id).sort((a, b) => a - b);
	const counts = new Map(positionCounts(g, ids).map((c) => [c.id, c]));
	const pairs = new Map<string, { from: number; to: number; figures: number }>();
	for (const f of g.figures) {
		for (const from of new Set(f.starts))
			for (const to of new Set(f.ends)) {
				const key = `${from}:${to}`;
				const e = pairs.get(key) ?? { from, to, figures: 0 };
				e.figures++;
				pairs.set(key, e);
			}
	}
	const positions = [...g.positions]
		.sort((a, b) => a.id - b.id)
		.map((p) => {
			const c = counts.get(p.id)!;
			const figures = g.figures.filter((f) => f.starts.includes(p.id) || f.ends.includes(p.id));
			return {
				id: p.id,
				name: p.name,
				styleTag: p.styleTag,
				figures: figures.length,
				twins: p.twins,
				gaps: { deadEnd: c.deadEnd, orphan: c.orphan, island: c.island }
			};
		});
	return { positions, edges: [...pairs.values()].sort((a, b) => a.from - b.from || a.to - b.to) };
}

/** The gap report worked out from the edges alone: one figure per edge figure. */
function gapsFromEdges(
	positions: MapPosition[],
	edges: { from: number; to: number; figures: number }[]
): Map<number, MapGaps> {
	const figures: GraphFigure[] = [];
	for (const e of edges)
		for (let i = 0; i < e.figures; i++)
			figures.push({ id: figures.length + 1, starts: [e.from], ends: [e.to], start: 1, length: 8 });
	const ids = positions.map((p) => p.id);
	const g: Graph = { figures, positions: [] };
	return new Map(
		positionCounts(g, ids).map((c) => [
			c.id,
			{ deadEnd: c.deadEnd, orphan: c.orphan, island: c.island }
		])
	);
}

const round = (v: number) => Math.round(v * 10) / 10;

/**
 * The drawn positions as the layout moves them: centres in `x`/`y`, and what
 * each one takes around its centre. Typed arrays and plain loops: the layout
 * runs about a million pair checks, and `Math.hypot` or closures there cost
 * tens of milliseconds.
 */
interface Bodies {
	n: number;
	width: number;
	height: number;
	x: Float64Array;
	y: Float64Array;
	r: Float64Array;
	/** The label's width: the widest of its lines. */
	w: Float64Array;
	/** The label's height: the name's line, then a dead end's or orphan's word, then Twins. */
	lh: Float64Array;
	/** Half the outline's width: the circle or the label, whichever is wider. */
	half: Float64Array;
	/** The outline's height: circle, gap and label (one line or two). */
	tall: Float64Array;
}

/** Keeps a body inside the frame, label and all. */
function clamp(b: Bodies, i: number) {
	const x0 = b.half[i] + PAD;
	const x1 = b.width - b.half[i] - PAD;
	b.x[i] = x0 > x1 ? b.width / 2 : Math.min(x1, Math.max(x0, b.x[i]));
	const y0 = b.r[i] + PAD;
	const y1 = b.height - (b.tall[i] - b.r[i]) - PAD;
	b.y[i] = y0 > y1 ? b.height / 2 : Math.min(y1, Math.max(y0, b.y[i]));
}

/** Fruchterman–Reingold: every pair repels, every spring pulls, cooling linearly. */
function settle(b: Bodies, springs: Int32Array, steps: number) {
	const { n, x, y } = b;
	const k = 0.5 * Math.sqrt((b.width * b.height) / n);
	const kk = k * k;
	const t0 = b.width / 10;
	const dx = new Float64Array(n);
	const dy = new Float64Array(n);
	for (let s = 0; s < steps; s++) {
		dx.fill(0);
		dy.fill(0);
		for (let i = 0; i < n; i++)
			for (let j = i + 1; j < n; j++) {
				let ux = x[i] - x[j];
				let uy = y[i] - y[j];
				let dd = ux * ux + uy * uy;
				if (dd < 1e-4) {
					// coincident: part them along a fixed direction
					ux = 0.01;
					uy = (i + j) % 2 === 0 ? 0.01 : -0.01;
					dd = ux * ux + uy * uy;
				}
				const f = kk / dd;
				dx[i] += ux * f;
				dy[i] += uy * f;
				dx[j] -= ux * f;
				dy[j] -= uy * f;
			}
		for (let e = 0; e < springs.length; e += 2) {
			const i = springs[e];
			const j = springs[e + 1];
			const ux = x[i] - x[j];
			const uy = y[i] - y[j];
			const f = Math.sqrt(ux * ux + uy * uy) / k;
			dx[i] -= ux * f;
			dy[i] -= uy * f;
			dx[j] += ux * f;
			dy[j] += uy * f;
		}
		const t = t0 * (1 - s / steps);
		for (let i = 0; i < n; i++) {
			const d = Math.sqrt(dx[i] * dx[i] + dy[i] * dy[i]);
			if (d > 0) {
				const m = Math.min(d, t) / d;
				x[i] += dx[i] * m;
				y[i] += dy[i] * m;
			}
			clamp(b, i);
		}
	}
}

/** Whether circle c touches the label of l. */
function circleOnLabel(b: Bodies, c: number, l: number): boolean {
	const top = b.y[l] + b.r[l] + LABEL_GAP;
	const px = Math.max(b.x[l] - b.w[l] / 2, Math.min(b.x[c], b.x[l] + b.w[l] / 2));
	const py = Math.max(top, Math.min(b.y[c], top + b.lh[l]));
	const ux = b.x[c] - px;
	const uy = b.y[c] - py;
	const reach = b.r[c] + TOUCH;
	return ux * ux + uy * uy < reach * reach;
}

/**
 * How far two outlines overlap top to bottom, when `i` is the upper one: an
 * outline runs from its circle's top to its label's last line, so it is not
 * centred on the circle, and two with labels of different heights reach
 * different lengths below their centres.
 */
function overlapY(b: Bodies, i: number, j: number): number {
	const [hi, lo] = b.y[i] <= b.y[j] ? [i, j] : [j, i];
	return b.y[hi] - b.r[hi] + b.tall[hi] - (b.y[lo] - b.r[lo]);
}

/** Whether two bodies touch: two circles, two labels, or a circle on the other's label. */
function touch(b: Bodies, i: number, j: number): boolean {
	const ux = Math.abs(b.x[i] - b.x[j]);
	const uy = Math.abs(b.y[i] - b.y[j]);
	// outlines apart: nothing inside them can touch
	if (ux >= b.half[i] + b.half[j] + TOUCH) return false;
	if (overlapY(b, i, j) <= -TOUCH) return false;
	const reach = b.r[i] + b.r[j] + TOUCH;
	if (ux * ux + uy * uy < reach * reach) return true;
	// labels: each below its circle, one line high or two
	const ti = b.y[i] + b.r[i];
	const tj = b.y[j] + b.r[j];
	if (ux < (b.w[i] + b.w[j]) / 2 + TOUCH && ti < tj + b.lh[j] + TOUCH && tj < ti + b.lh[i] + TOUCH)
		return true;
	return circleOnLabel(b, i, j) || circleOnLabel(b, j, i);
}

/**
 * Parts whatever still touches. A body moves as one piece, circle and label
 * together, so two that touch are parted along the shallower overlap of their
 * outlines: parting circles and labels each their own way ping-pongs when one
 * body's circle sits on another's label. Until nothing touches, or the cap.
 */
function pushApart(b: Bodies): MapStats {
	const { n, x, y } = b;
	for (let pass = 0; pass < MAX_PASSES; pass++) {
		let pushed = false;
		for (let i = 0; i < n; i++)
			for (let j = i + 1; j < n; j++) {
				if (!touch(b, i, j)) continue;
				pushed = true;
				const ox = b.half[i] + b.half[j] - Math.abs(x[i] - x[j]) + AIR;
				const oy = overlapY(b, i, j) + AIR;
				if (oy <= ox) {
					const s = y[i] < y[j] || (y[i] === y[j] && i < j) ? -1 : 1;
					y[i] += (s * oy) / 2;
					y[j] -= (s * oy) / 2;
				} else {
					const s = x[i] < x[j] || (x[i] === x[j] && i < j) ? -1 : 1;
					x[i] += (s * ox) / 2;
					x[j] -= (s * ox) / 2;
				}
			}
		for (let i = 0; i < n; i++) clamp(b, i);
		if (!pushed) return { passes: pass + 1, settled: true };
	}
	return { passes: MAX_PASSES, settled: false };
}

export function layoutMap(
	input: MapInput,
	opts: { steps?: number; onStats?: (stats: MapStats) => void } = {}
): MapLayout {
	const steps = opts.steps ?? 400;
	const positions = byName(input.positions);

	// Duplicate pairs merge; edges with no figures say nothing.
	const merged = new Map<string, { from: number; to: number; figures: number }>();
	for (const e of input.edges) {
		if (e.figures <= 0) continue;
		const key = `${e.from}:${e.to}`;
		const m = merged.get(key) ?? { from: e.from, to: e.to, figures: 0 };
		m.figures += e.figures;
		merged.set(key, m);
	}
	const edges = [...merged.values()].sort((a, b) => a.from - b.from || a.to - b.to);

	const derived = positions.some((p) => !p.gaps) ? gapsFromEdges(positions, edges) : null;
	const gapsOf = (p: MapPosition) => p.gaps ?? derived!.get(p.id)!;

	const drawn: MapPosition[] = [];
	const islands: number[] = [];
	const unused: number[] = [];
	for (const p of positions) {
		if (p.figures <= 0) unused.push(p.id);
		else if (gapsOf(p).island) islands.push(p.id);
		else drawn.push(p);
	}
	const tray = { islands, unused };
	const n = drawn.length;
	const { width, height } = mapSize(n);
	if (n === 0) return { width, height, nodes: [], edges: [], tray };

	const index = new Map(drawn.map((p, i) => [p.id, i]));
	const r = Float64Array.from(drawn, (p) => nodeRadius(p.figures));
	// A dead end or orphan writes its word on a second line, under its name.
	const marks = drawn.map((p) => {
		const g = gapsOf(p);
		return g.deadEnd ? ('dead end' as const) : g.orphan ? ('orphan' as const) : null;
	});
	// A twinned one writes Twins on the line after that.
	const twinned = drawn.map((p) => p.twins ?? false);
	const w = Float64Array.from(drawn, (p, i) =>
		Math.max(labelWidth(p.name), markWidth(marks[i]), twinned[i] ? TWINS_WIDTH : 0)
	);
	const lh = Float64Array.from(
		marks,
		(m, i) => (1 + (m ? 1 : 0) + (twinned[i] ? 1 : 0)) * LABEL_HEIGHT
	);
	const b: Bodies = {
		n,
		width,
		height,
		x: new Float64Array(n),
		y: new Float64Array(n),
		r,
		w,
		lh,
		half: r.map((ri, i) => Math.max(ri, w[i] / 2)),
		tall: r.map((ri, i) => 2 * ri + LABEL_GAP + lh[i])
	};

	// Start: a circle in folded-name order, from the top, clockwise.
	const ring = Math.min(width, height) * 0.35;
	for (let i = 0; i < n; i++) {
		const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
		b.x[i] = n === 1 ? width / 2 : width / 2 + ring * Math.cos(a);
		b.y[i] = n === 1 ? height / 2 : height / 2 + ring * Math.sin(a);
		clamp(b, i);
	}

	// Springs: one per joined pair, either way round; loops pull on nothing.
	const pairs: number[] = [];
	const seen = new Set<number>();
	for (const e of edges) {
		const i = index.get(e.from);
		const j = index.get(e.to);
		if (i === undefined || j === undefined || i === j) continue;
		const [lo, hi] = i < j ? [i, j] : [j, i];
		if (seen.has(lo * n + hi)) continue;
		seen.add(lo * n + hi);
		pairs.push(lo, hi);
	}

	settle(b, Int32Array.from(pairs), steps);
	const stats = pushApart(b);
	opts.onStats?.(stats);

	const nodes: MapNode[] = drawn.map((p, i) => {
		const labelY = round(b.y[i] + r[i] + LABEL_GAP + LABEL_HEIGHT / 2);
		const below = marks[i] ? 2 : 1;
		return {
			id: p.id,
			x: round(b.x[i]),
			y: round(b.y[i]),
			r: r[i],
			labelX: round(b.x[i]),
			labelY,
			mark: marks[i],
			markY: marks[i] ? round(labelY + LABEL_HEIGHT) : null,
			twins: twinned[i],
			twinsY: twinned[i] ? round(labelY + below * LABEL_HEIGHT) : null
		};
	});
	const drawnEdges = edges
		.filter((e) => index.has(e.from) && index.has(e.to))
		.map((e) => ({ from: e.from, to: e.to, width: edgeWidth(e.figures) }));
	return { width, height, nodes, edges: drawnEdges, tray };
}
