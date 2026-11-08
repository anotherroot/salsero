/**
 * The map as the page draws it, on top of `map.ts`'s layout: each type's
 * colour, what a tap on a position lights, and the arrows' curves. PURE and
 * client-safe.
 */

import type { MapLayout } from './map';

/**
 * A type's colour on the map: a fixed theme token per style index, so the four
 * themes (and group mode's navy accent) carry it. No type, or a type the dance
 * no longer has, is muted; so is a dance's fourth style (salsa's Other).
 */
export type MapTone = 'accent' | 'done' | 'warn' | 'muted';

const TONES: MapTone[] = ['accent', 'done', 'warn'];

export const TONE_VAR: Record<MapTone, string> = {
	accent: 'var(--color-accent)',
	done: 'var(--color-done)',
	warn: 'var(--color-warn)',
	muted: 'var(--color-muted)'
};

export function styleTone(styleTag: string | null, styles: readonly string[]): MapTone {
	const i = styleTag === null ? -1 : styles.indexOf(styleTag);
	return TONES[i] ?? 'muted';
}

/**
 * The legend's types: the dance's, in order, then "Other" for untyped
 * positions when the dance has no Other of its own (bachata).
 */
export function legendTypes(
	styles: readonly string[],
	labels: Record<string, string>,
	hasUntyped: boolean
): { key: string; label: string; tone: MapTone }[] {
	const types = styles.map((s) => ({ key: s, label: labels[s] ?? s, tone: styleTone(s, styles) }));
	if (hasUntyped && !styles.includes('other'))
		types.push({ key: 'none', label: 'Other', tone: 'muted' });
	return types;
}

export function edgeKey(e: { from: number; to: number }): string {
	return `${e.from}:${e.to}`;
}

/**
 * What a tap on `selected` lights: the figures into and out of it (edges by
 * `edgeKey`), and the positions at their other ends. Nothing when nothing is
 * selected.
 */
export function litOf(
	edges: readonly { from: number; to: number }[],
	selected: number | null
): { nodes: Set<number>; edges: Set<string> } {
	const nodes = new Set<number>();
	const lit = new Set<string>();
	if (selected === null) return { nodes, edges: lit };
	nodes.add(selected);
	for (const e of edges) {
		if (e.from !== selected && e.to !== selected) continue;
		lit.add(edgeKey(e));
		nodes.add(e.from);
		nodes.add(e.to);
	}
	return { nodes, edges: lit };
}

/** A pill as the arrows see it: x and y are its centre. A `MapNode` is one as it is. */
export type Box = { x: number; y: number; w: number; h: number };

/** Between the line's end and the box it points at: the arrow head's room. */
const HEAD_GAP = 3;
const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Where the ray from `a`'s centre toward `p` leaves `a`'s rectangle, pushed
 * `out` px further along the ray.
 */
function exit(a: Box, p: { x: number; y: number }, out: number) {
	const dx = p.x - a.x;
	const dy = p.y - a.y;
	const len = Math.hypot(dx, dy) || 1;
	const tx = dx === 0 ? Infinity : a.w / 2 / Math.abs(dx);
	const ty = dy === 0 ? Infinity : a.h / 2 / Math.abs(dy);
	const t = Math.min(tx, ty);
	const k = Number.isFinite(t) ? t : 0;
	return { x: a.x + dx * k + (dx / len) * out, y: a.y + dy * k + (dy / len) * out };
}

/**
 * An arrow's path from box `a` to box `b`, and where its count sits. A curve
 * bowed to the left of its direction, so A → B and B → A bow apart and both
 * show. It leaves `a`'s rectangle and stops HEAD_GAP outside `b`'s, where the
 * arrow head goes. A loop (`a` is `b`) curls off the box's top right corner.
 */
export function edgeGeometry(
	a: Box,
	b: Box,
	loop = a === b
): { d: string; labelX: number; labelY: number } {
	if (loop) {
		const top = a.y - a.h / 2;
		const right = a.x + a.w / 2;
		const sx = right - Math.min(24, a.w * 0.3);
		const ex = right - Math.min(8, a.w * 0.1);
		const ey = top - HEAD_GAP;
		const c1 = { x: sx + 4, y: top - 34 };
		const c2 = { x: ex + 26, y: top - 30 };
		const lx = (sx + ex) / 2 + 14;
		const ly = top - 30;
		return {
			d: `M${r1(sx)} ${r1(top)} C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(ex)} ${r1(ey)}`,
			labelX: r1(lx),
			labelY: r1(ly)
		};
	}
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dist = Math.hypot(dx, dy);
	const ux = dist > 1e-6 ? dx / dist : 1;
	const uy = dist > 1e-6 ? dy / dist : 0;
	const bend = Math.min(40, Math.max(14, dist * 0.18));
	const c = { x: (a.x + b.x) / 2 - uy * bend, y: (a.y + b.y) / 2 + ux * bend };
	// The ends are found along a shallower bow than the curve's own, so pills side by
	// side are left and entered through their facing edges, not their top or bottom.
	const aim = { x: (a.x + b.x) / 2 - uy * bend * 0.4, y: (a.y + b.y) / 2 + ux * bend * 0.4 };
	const s = exit(a, aim, 0);
	const e = exit(b, aim, HEAD_GAP);
	return {
		d: `M${r1(s.x)} ${r1(s.y)} Q${r1(c.x)} ${r1(c.y)} ${r1(e.x)} ${r1(e.y)}`,
		labelX: r1(0.25 * s.x + 0.5 * c.x + 0.25 * e.x),
		labelY: r1(0.25 * s.y + 0.5 * c.y + 0.25 * e.y)
	};
}

/**
 * How an arrow looks given the picked position and the edge just stepped:
 * `out` from the picked, `in` into it, `stepped` the edge just taken (wins),
 * `rest` while nothing is picked, `faded` otherwise. The count shows when more
 * than one figure runs along it and it is not faded. The walk's tones come
 * from `walkLook` (walk.ts): `walked` (thick accent, its step numbers in
 * `badge`), `loose` (the same, dashed: a walked figure with no data edge) and
 * `next` (dashed accent, out of where the walk stands).
 */
export type ArrowLook = {
	tone: 'out' | 'in' | 'stepped' | 'rest' | 'faded' | 'walked' | 'loose' | 'next';
	badge: string | null;
	count: number | null;
};

export function arrowLook(
	e: { from: number; to: number; figures: number },
	s: { picked: number | null; stepped: string | null }
): ArrowLook {
	let tone: ArrowLook['tone'];
	if (s.stepped !== null && edgeKey(e) === s.stepped) tone = 'stepped';
	else if (s.picked === null) tone = 'rest';
	else if (e.from === s.picked) tone = 'out';
	else if (e.to === s.picked) tone = 'in';
	else tone = 'faded';
	return { tone, badge: null, count: tone !== 'faded' && e.figures > 1 ? e.figures : null };
}

/** A figure on the map's arrows: its label ("Enchufla · Doble") and its move's name. */
export interface MapFig {
	id: number;
	label: string;
	move: string;
}

/** One position as the map draws it (`mapData`). */
export interface MapDataPosition {
	id: number;
	name: string;
	styleTag: string | null;
	tone: MapTone;
	ins: number;
	outs: number;
	/** "Twins: your Cerrada, Salsa Tuesdays’ Closed" when it stands for twins. */
	twinsLine: string | null;
	ariaLabel: string;
}

/**
 * The map, as `mapData` (server) loads it for the map route and for the
 * Positions list's pane: the layout, its nodes and arrows, the tray, the
 * summary and the legend.
 */
export interface MapData {
	/** No positions at all. */
	empty: boolean;
	layout: MapLayout;
	positions: MapDataPosition[];
	edges: { from: number; to: number; width: number; figures: number; figs: MapFig[] }[];
	/** Figures that start at a drawn position and have no end: anything can follow them. */
	anyFrom: { from: number; figs: MapFig[] }[];
	/** Figures with no start (they follow anything), and where each ends (maybe nowhere). */
	noStart: { fig: MapFig; ends: number[] }[];
	/** Figures the map draws no arrow for: the tray's No position chip. */
	noPosition: number;
	summary: string;
	types: { key: string; label: string; tone: MapTone }[];
	/** The SVG's name for a screen reader. */
	mapLabel: string;
	/** In a group's own workspace: no gap marks in the legend. */
	inGroupMode: boolean;
}
