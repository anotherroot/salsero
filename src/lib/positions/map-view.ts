/**
 * The map as the page draws it, on top of `map.ts`'s layout: each type's
 * colour, what a tap on a position lights, and the arrows' curves. PURE and
 * client-safe.
 */

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

type Circle = { x: number; y: number; r: number };

/** Between the line's end and the circle it points at: the arrow head's room. */
const HEAD_GAP = 3;
const r1 = (v: number) => Math.round(v * 10) / 10;

function toward(c: Circle, p: { x: number; y: number }, out: number) {
	const dx = p.x - c.x;
	const dy = p.y - c.y;
	const d = Math.sqrt(dx * dx + dy * dy) || 1;
	return { x: c.x + (dx / d) * out, y: c.y + (dy / d) * out };
}

/**
 * An arrow's path from circle `a` to circle `b`, and where its count sits.
 * A curve bowed to the left of its direction, so A → B and B → A bow apart and
 * both show. It leaves `a`'s edge and stops just outside `b`'s, where the arrow
 * head goes. A loop (`a` is `b`) is a curl off the circle's upper right.
 */
export function edgeGeometry(
	a: Circle,
	b: Circle,
	loop = a === b
): { d: string; labelX: number; labelY: number } {
	if (loop) {
		const mid = -Math.PI / 4;
		const reach = a.r + 34;
		const at = (angle: number, out: number) => ({
			x: a.x + Math.cos(angle) * out,
			y: a.y + Math.sin(angle) * out
		});
		const s = at(mid - 0.45, a.r + 1);
		const e = at(mid + 0.45, a.r + HEAD_GAP);
		const c1 = at(mid - 0.75, reach);
		const c2 = at(mid + 0.75, reach);
		const label = at(mid, a.r + 26);
		return {
			d: `M${r1(s.x)} ${r1(s.y)} C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(e.x)} ${r1(e.y)}`,
			labelX: r1(label.x),
			labelY: r1(label.y)
		};
	}
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dist = Math.sqrt(dx * dx + dy * dy);
	const ux = dist > 1e-6 ? dx / dist : 1;
	const uy = dist > 1e-6 ? dy / dist : 0;
	const bend = Math.min(40, Math.max(14, dist * 0.18));
	const c = { x: (a.x + b.x) / 2 - uy * bend, y: (a.y + b.y) / 2 + ux * bend };
	const s = toward(a, c, a.r + 1);
	const e = toward(b, c, b.r + HEAD_GAP);
	return {
		d: `M${r1(s.x)} ${r1(s.y)} Q${r1(c.x)} ${r1(c.y)} ${r1(e.x)} ${r1(e.y)}`,
		labelX: r1(0.25 * s.x + 0.5 * c.x + 0.25 * e.x),
		labelY: r1(0.25 * s.y + 0.5 * c.y + 0.25 * e.y)
	};
}

/** The Twins marker's estimated size: five characters at 10.5 px bold, and its halo. */
export const TWINS_WIDTH = 36;
export const TWINS_HEIGHT = 14;
const TWINS_GAP = 3;

/**
 * Where a twinned position's "Twins" marker goes: left of its circle, level
 * with its top, or right of it when the left would leave the frame; never
 * above the frame's top. Task 27 draws twins as one node and redraws this.
 */
export function twinsSpot(n: Circle): { x: number; y: number; anchor: 'start' | 'end' } {
	const y = Math.max(n.y - n.r, TWINS_HEIGHT / 2 + 1);
	const left = n.x - n.r - TWINS_GAP;
	return left - TWINS_WIDTH >= 0
		? { x: left, y, anchor: 'end' }
		: { x: n.x + n.r + TWINS_GAP, y, anchor: 'start' };
}
