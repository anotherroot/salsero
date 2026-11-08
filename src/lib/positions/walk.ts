/**
 * The walk's model: a routine built position to position. A walk starts at a
 * position and each step is a figure (ending at a position, or nowhere) or a
 * jump (the tap after a figure that ends nowhere). Immutable: every function
 * returns a new walk. PURE and client-safe.
 */

import { edgeKey, type MapData, type MapFig } from './map-view';

export type WalkStep =
	| { kind: 'figure'; fig: MapFig; from: number | null; to: number | null }
	| { kind: 'jump'; to: number };

export interface Walk {
	start: number;
	steps: WalkStep[];
}

/** Where the walk stands now; null right after a figure with no end. */
export function currentOf(w: Walk): number | null {
	const last = w.steps[w.steps.length - 1];
	if (!last) return w.start;
	return last.to;
}

export function figureCount(w: Walk): number {
	return w.steps.filter((s) => s.kind === 'figure').length;
}

export function addFigure(w: Walk, fig: MapFig, to: number | null): Walk {
	return {
		start: w.start,
		steps: [...w.steps, { kind: 'figure', fig, from: currentOf(w), to }]
	};
}

/** Only when the walk stands nowhere; otherwise the same walk. */
export function jumpTo(w: Walk, id: number): Walk {
	if (w.steps.length === 0 || currentOf(w) !== null) return w;
	return { start: w.start, steps: [...w.steps, { kind: 'jump', to: id }] };
}

/** Drops the last step, a jump or a figure. */
export function undo(w: Walk): Walk {
	if (w.steps.length === 0) return w;
	return { start: w.start, steps: w.steps.slice(0, -1) };
}

/** `to` null is Anywhere: the figures that have no end. */
export interface NextGroup {
	to: number | null;
	stays: boolean;
	figs: MapFig[];
}

export function nextFrom(
	data: MapData,
	at: number
): { groups: NextGroup[]; fitsAnywhere: { fig: MapFig; to: number | null }[] } {
	const name = (id: number) => data.positions.find((p) => p.id === id)?.name ?? '';
	const groups: NextGroup[] = data.edges
		.filter((e) => e.from === at)
		.map((e) => ({ to: e.to, stays: e.to === at, figs: e.figs }));
	groups.sort(
		(a, b) =>
			b.figs.length - a.figs.length ||
			Number(b.stays) - Number(a.stays) ||
			name(a.to as number).localeCompare(name(b.to as number), 'en')
	);
	const any = data.anyFrom.find((a) => a.from === at);
	if (any && any.figs.length > 0) groups.push({ to: null, stays: false, figs: any.figs });

	const fitsAnywhere: { fig: MapFig; to: number | null }[] = [];
	for (const n of data.noStart) {
		if (n.ends.length === 0) fitsAnywhere.push({ fig: n.fig, to: null });
		else for (const to of n.ends) fitsAnywhere.push({ fig: n.fig, to });
	}
	return { groups, fitsAnywhere };
}

/** Figure steps with both ends, by edge key; numbers are the figure's 1-based count among figure steps. */
export function walkedArrows(
	w: Walk
): Map<string, { from: number; to: number; numbers: number[] }> {
	const out = new Map<string, { from: number; to: number; numbers: number[] }>();
	let n = 0;
	for (const s of w.steps) {
		if (s.kind !== 'figure') continue;
		n++;
		if (s.from === null || s.to === null) continue;
		const key = edgeKey({ from: s.from, to: s.to });
		const e = out.get(key);
		if (e) e.numbers.push(n);
		else out.set(key, { from: s.from, to: s.to, numbers: [n] });
	}
	return out;
}

/** Every position the walk has stood at. */
export function visited(w: Walk): Set<number> {
	const set = new Set<number>([w.start]);
	for (const s of w.steps) if (s.to !== null) set.add(s.to);
	return set;
}

/** The figures in order, repeats kept. */
export function figureIds(w: Walk): number[] {
	const ids: number[] = [];
	for (const s of w.steps) if (s.kind === 'figure') ids.push(s.fig.id);
	return ids;
}
