/**
 * The map: where each position's pill sits on the Positions map, how big it
 * is, and what goes in the tray under it.
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
 * Each position is a pill: a rounded box holding its name, on one line or two
 * (`pillLines`), sized from the name (`pillSize`). A dead end's or orphan's
 * word sits on a line under the pill (`markBox` at `markY`), and a twinned
 * position's (ruling 16: twins are one node) "Twins" on the line after that
 * (`twinsBox` at `twinsY`). The pill and its lines are one outline, and the
 * layout keeps every outline clear of every other and inside the frame.
 *
 * The layout: Fruchterman–Reingold over the drawn positions, `steps` (400)
 * steps from a circle in folded-name order (ideal spacing half the classic
 * √(area/n): names need the frame's room more than the springs do), then
 * passes that push outlines apart until nothing touches — usually well under
 * the brief's 60; the cap is 600 (`MAX_PASSES`), and `onStats` says how many
 * it took and whether it settled. The frame is portrait (`mapSize`), the
 * phone's shape. A name is at most `LABEL_MAX` characters (`mapLabel` cuts a
 * longer one), so the widest pill is 344 px and fits the narrowest frame.
 */
import { fold } from '$lib/fold';
import { map as enMap } from '$lib/i18n/en/map';
import { map as slMap } from '$lib/i18n/sl/map';
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
	/** The pill's centre. */
	x: number;
	y: number;
	/** The pill's size (`pillSize`). */
	w: number;
	h: number;
	/** The name in the pill: `mapLabel`'s, split by `pillLines`. */
	lines: string[];
	mark: 'dead end' | 'orphan' | null;
	/**
	 * The centre of the mark word's line (`markBox`), right under the pill:
	 * `y + h / 2 + LINE_GAP + LINE_HEIGHT / 2`. Null without a mark.
	 */
	markY: number | null;
	twins: boolean;
	/**
	 * The centre of the Twins line (`twinsBox`): under the pill, or under the
	 * mark's line when there is one. Null unless `twins`.
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

/** The pill's name, in px. */
export const PILL_FONT = 13;
/** The pill's estimate: 7.6 px a character of its widest line, and 40 for the dot and the ends. */
const PILL_CHAR = 7.6;
const PILL_PAD = 40;
/** A pill's height: one line, or two. */
const PILL_ONE = 32;
const PILL_TWO = 46;
/** A name longer than this goes on two lines, when it has a space to split at. */
const PILL_SPLIT = 16;
/** A line under the pill (the mark word, Twins): 14 px high, 2 px below what is above it. */
export const LINE_HEIGHT = 14;
const LINE_GAP = 2;
/**
 * The longest name the map shows whole: past it the page cuts the name to
 * `LABEL_MAX - 1` characters and an ellipsis (`mapLabel`), so no pill is wider
 * than 344 px and every one fits the narrowest frame.
 */
export const LABEL_MAX = 40;
/**
 * A dead end's or orphan's word, in capitals on a line under its pill (the
 * page's 10.5 px with tracking): about 8 px a character.
 */
export const MARK_CHAR = 8;
/** Kept clear inside the frame's edge. */
const PAD = 4;
/**
 * The push passes act on two outlines closer than TOUCH and part them to AIR.
 * The slack between the two is what lets the passes settle instead of
 * creeping towards zero forever.
 */
const TOUCH = 1;
const AIR = 4;
export const MAX_PASSES = 600;

/** 1 + figures, capped at 6. */
export function edgeWidth(figures: number): number {
	return Math.min(6, 1 + figures);
}

/** The name as the map writes it: whole up to `LABEL_MAX` characters, else cut with an ellipsis. */
export function mapLabel(name: string): string {
	const chars = [...name];
	return chars.length <= LABEL_MAX ? name : chars.slice(0, LABEL_MAX - 1).join('') + '…';
}

const length = (s: string) => [...s].length;

/**
 * The pill's lines: the name on one, or, when it is longer than 16 characters
 * and has a space, on two split at the space that makes the longer line
 * shortest (the first such space on a tie).
 */
export function pillLines(name: string): string[] {
	if (length(name) <= PILL_SPLIT) return [name];
	const words = name.split(/\s+/).filter(Boolean);
	if (words.length < 2) return [name];
	let best: string[] = [name];
	let longest = Infinity;
	for (let i = 1; i < words.length; i++) {
		const two = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
		const m = Math.max(length(two[0]), length(two[1]));
		if (m < longest) {
			longest = m;
			best = two;
		}
	}
	return best;
}

/** A pill's size: its widest line at 7.6 px a character, and 40; 32 high, or 46 for two lines. */
export function pillSize(lines: string[]): { w: number; h: number } {
	const widest = Math.max(0, ...lines.map(length));
	return {
		w: Math.round((widest * PILL_CHAR + PILL_PAD) * 10) / 10,
		h: lines.length > 1 ? PILL_TWO : PILL_ONE
	};
}

/**
 * A line's width for a word the page draws in the reader's language: the
 * longest of the catalogs' (the layout is the same for every reader),
 * `MARK_CHAR` a character.
 */
const wordWidth = (pick: (m: typeof enMap) => string) =>
	Math.max(...[enMap, slMap].map((m) => [...pick(m)].length)) * MARK_CHAR;

/** The Twins line's width, at the mark's size. */
const TWINS_WIDTH = wordWidth((m) => m.twins);
const MARK_WIDTH = {
	'dead end': wordWidth((m) => m.mark.deadEnd),
	orphan: wordWidth((m) => m.mark.orphan)
};

/** The box the Twins line takes (`MapNode.twinsY`), centred on (x, y). */
export function twinsBox(x: number, y: number): { x0: number; y0: number; x1: number; y1: number } {
	return {
		x0: x - TWINS_WIDTH / 2,
		y0: y - LINE_HEIGHT / 2,
		x1: x + TWINS_WIDTH / 2,
		y1: y + LINE_HEIGHT / 2
	};
}

/** The width a mark word takes, in the longest of the languages. */
function markWidth(mark: 'dead end' | 'orphan' | null): number {
	return mark ? MARK_WIDTH[mark] : 0;
}

/** The box a mark word takes on its own line (`MapNode.markY`), centred on (x, y). */
export function markBox(
	mark: 'dead end' | 'orphan',
	x: number,
	y: number
): { x0: number; y0: number; x1: number; y1: number } {
	const w = markWidth(mark);
	return { x0: x - w / 2, y0: y - LINE_HEIGHT / 2, x1: x + w / 2, y1: y + LINE_HEIGHT / 2 };
}

/** The room a position takes in the frame: about 160 × 160 px, a pill and its arrows. */
const AREA = 160 * 160;

/**
 * The frame for n drawn positions: portrait, 7 wide to 10 high (the phone's
 * shape, between the floating title and the tray; the desktop's map column
 * beside its panel is about as tall), about `AREA` a position, and never
 * under 360 across. The page fits the view to it and pinch-zooms it.
 * Nothing drawn: 0.
 */
export function mapSize(n: number): { width: number; height: number } {
	if (n === 0) return { width: 0, height: 0 };
	const width = Math.max(360, Math.ceil(Math.sqrt((n * AREA * 7) / 10)));
	return { width, height: Math.ceil((width * 10) / 7) };
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
 * The drawn positions as the layout moves them: pill centres in `x`/`y`, and
 * the outline each one takes around its centre (the pill, and the lines
 * under it). Typed arrays and plain loops: the layout runs about a million
 * pair checks, and `Math.hypot` or closures there cost tens of milliseconds.
 */
interface Bodies {
	n: number;
	width: number;
	height: number;
	x: Float64Array;
	y: Float64Array;
	/** Half the outline's width: the pill or a line under it, whichever is wider. */
	half: Float64Array;
	/** From the centre up to the outline's top: half the pill's height. */
	up: Float64Array;
	/** The outline's height: the pill, then a dead end's or orphan's word, then Twins. */
	tall: Float64Array;
}

/** Keeps a body inside the frame, lines and all. */
function clamp(b: Bodies, i: number) {
	const x0 = b.half[i] + PAD;
	const x1 = b.width - b.half[i] - PAD;
	b.x[i] = x0 > x1 ? b.width / 2 : Math.min(x1, Math.max(x0, b.x[i]));
	const y0 = b.up[i] + PAD;
	const y1 = b.height - (b.tall[i] - b.up[i]) - PAD;
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

/**
 * Which of two outlines is the upper one: the higher top, the lower index on
 * a tie. An outline is not centred on its pill (the lines hang under it), so
 * the tops decide, not the centres.
 */
function upper(b: Bodies, i: number, j: number): number {
	const ti = b.y[i] - b.up[i];
	const tj = b.y[j] - b.up[j];
	return ti < tj || (ti === tj && i < j) ? i : j;
}

/** How far two outlines overlap top to bottom: the upper one's bottom less the lower one's top. */
function overlapY(b: Bodies, hi: number, lo: number): number {
	return b.y[hi] - b.up[hi] + b.tall[hi] - (b.y[lo] - b.up[lo]);
}

/**
 * Parts whatever still touches: two outlines closer than TOUCH both ways. A
 * body moves as one piece, pill and lines together, along the shallower
 * overlap of the two outlines. Until nothing touches, or the cap.
 */
function pushApart(b: Bodies): MapStats {
	const { n, x, y, half } = b;
	for (let pass = 0; pass < MAX_PASSES; pass++) {
		let pushed = false;
		for (let i = 0; i < n; i++)
			for (let j = i + 1; j < n; j++) {
				const ox = half[i] + half[j] - Math.abs(x[i] - x[j]);
				if (ox <= -TOUCH) continue;
				const hi = upper(b, i, j);
				const oy = overlapY(b, hi, hi === i ? j : i);
				if (oy <= -TOUCH) continue;
				pushed = true;
				// Two too wide to sit side by side in the frame go one above the other,
				// whichever overlap is shallower: the frame would only push them back.
				const side = 2 * (half[i] + half[j]) + 2 * PAD + AIR <= b.width;
				if (oy <= ox || !side) {
					const s = hi === i ? -1 : 1;
					y[i] += (s * (oy + AIR)) / 2;
					y[j] -= (s * (oy + AIR)) / 2;
				} else {
					const s = x[i] < x[j] || (x[i] === x[j] && i < j) ? -1 : 1;
					x[i] += (s * (ox + AIR)) / 2;
					x[j] -= (s * (ox + AIR)) / 2;
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
	const lines = drawn.map((p) => pillLines(mapLabel(p.name)));
	const pills = lines.map(pillSize);
	// A dead end or orphan writes its word on a line under its pill.
	const marks = drawn.map((p) => {
		const g = gapsOf(p);
		return g.deadEnd ? ('dead end' as const) : g.orphan ? ('orphan' as const) : null;
	});
	// A twinned one writes Twins on the line after that.
	const twinned = drawn.map((p) => p.twins ?? false);
	const under = marks.map((m, i) => (m ? 1 : 0) + (twinned[i] ? 1 : 0));
	const b: Bodies = {
		n,
		width,
		height,
		x: new Float64Array(n),
		y: new Float64Array(n),
		half: Float64Array.from(
			pills,
			(p, i) => Math.max(p.w, markWidth(marks[i]), twinned[i] ? TWINS_WIDTH : 0) / 2
		),
		up: Float64Array.from(pills, (p) => p.h / 2),
		tall: Float64Array.from(pills, (p, i) => p.h + under[i] * (LINE_GAP + LINE_HEIGHT))
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
		const x = round(b.x[i]);
		const y = round(b.y[i]);
		const { w, h } = pills[i];
		// The first line's centre under the pill; each next one a gap and a line further.
		const first = round(y + h / 2 + LINE_GAP + LINE_HEIGHT / 2);
		const markY = marks[i] ? first : null;
		return {
			id: p.id,
			x,
			y,
			w,
			h,
			lines: lines[i],
			mark: marks[i],
			markY,
			twins: twinned[i],
			twinsY: twinned[i] ? (markY === null ? first : round(markY + LINE_GAP + LINE_HEIGHT)) : null
		};
	});
	const drawnEdges = edges
		.filter((e) => index.has(e.from) && index.has(e.to))
		.map((e) => ({ from: e.from, to: e.to, width: edgeWidth(e.figures) }));
	return { width, height, nodes, edges: drawnEdges, tray };
}
