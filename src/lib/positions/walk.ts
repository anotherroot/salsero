/**
 * The walk's model: a routine built position to position. A walk starts at a
 * position and each step is a figure (ending at a position, or nowhere) or a
 * jump (the tap after a figure that ends nowhere). Immutable: every function
 * returns a new walk. PURE and client-safe.
 */

import type { ActionResult } from '@sveltejs/kit';
import { edgeKey, type ArrowLook, type MapData, type MapFig } from './map-view';

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

/**
 * The map while walking (spec 2026-11-08-map-walk, "The map while walking"):
 * each data edge's look (`arrows`, by `edgeKey`): walked with its step numbers
 * ("2,5"), next (dashed, out of the current position), or faded. `loose` is a
 * walked figure with no data edge under it (a fits-anywhere figure walked at A,
 * ending at E): drawn for the walk only, dashed. A figure with no end, and the
 * jump after it, draw nothing. `fit` is what the view eases to: the positions
 * visited and the next places (none while the walk stands nowhere: any pill is
 * a place to carry on from, and the path so far shows where it has been).
 */
export interface WalkLook {
	current: number | null;
	visited: Set<number>;
	next: Set<number>;
	arrows: Map<string, ArrowLook>;
	loose: { from: number; to: number; look: ArrowLook }[];
	fit: number[];
}

export function walkLook(w: Walk, edges: readonly { from: number; to: number }[]): WalkLook {
	const current = currentOf(w);
	const seen = visited(w);
	const walked = walkedArrows(w);
	const next = new Set<number>();
	const arrows = new Map<string, ArrowLook>();
	for (const e of edges) {
		const key = edgeKey(e);
		const steps = walked.get(key);
		const out = current !== null && e.from === current;
		if (out) next.add(e.to);
		arrows.set(
			key,
			steps
				? { tone: 'walked', badge: steps.numbers.join(','), count: null }
				: { tone: out ? 'next' : 'faded', badge: null, count: null }
		);
	}
	const loose = [...walked.entries()]
		.filter(([key]) => !arrows.has(key))
		.map(([, a]) => ({
			from: a.from,
			to: a.to,
			look: { tone: 'loose', badge: a.numbers.join(','), count: null } as ArrowLook
		}));
	const fit = [...new Set([...seen, ...next])];
	return { current, visited: seen, next, arrows, loose, fit };
}

/**
 * A pill while walking: the current position filled, the ones visited with an
 * accent border, and everything not visited or next at 0.2 (none while the
 * walk stands nowhere: every pill is a place to carry on from).
 */
export function walkPill(
	l: WalkLook,
	id: number
): { tone: 'current' | 'visited' | 'plain'; opacity: number } {
	const tone = id === l.current ? 'current' : l.visited.has(id) ? 'visited' : 'plain';
	const strong = l.current === null || tone !== 'plain' || l.next.has(id);
	return { tone, opacity: strong ? 1 : 0.2 };
}

/** The sheet's strip: the start, then each figure numbered, and a jump as a plain place. Empty before the first step. */
export type StripItem =
	{ kind: 'place'; at: number } | { kind: 'figure'; n: number; label: string };

export function stripOf(w: Walk): StripItem[] {
	if (w.steps.length === 0) return [];
	const out: StripItem[] = [{ kind: 'place', at: w.start }];
	let n = 0;
	for (const s of w.steps) {
		if (s.kind === 'jump') out.push({ kind: 'place', at: s.to });
		else out.push({ kind: 'figure', n: ++n, label: s.fig.label });
	}
	return out;
}

/**
 * What the unsaved-changes dialog hears from the walk's Save (the `routine`
 * action, sent without moving the page): a redirect is the routine made, a
 * refusal or an error its message (`fallback` when it has none).
 */
export function saveOutcome(
	result: ActionResult,
	fallback: string
): { ok: true } | { ok: false; message: string } {
	if (result.type === 'redirect' || result.type === 'success') return { ok: true };
	const m =
		result.type === 'failure'
			? (result.data as { message?: unknown } | undefined)?.message
			: (result.error as { message?: unknown } | undefined)?.message;
	return { ok: false, message: typeof m === 'string' && m !== '' ? m : fallback };
}
