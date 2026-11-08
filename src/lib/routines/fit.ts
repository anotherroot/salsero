/**
 * The picker's brain: which figures, variations and routines fit next to a
 * slot, grouped the way the sheet shows them.
 *
 * PURE and client-safe, like the rest of `src/lib/routines/`: the load hands
 * over candidates with their positions, and nothing here knows dances exist.
 * An untagged side fits anything: every comparison of hands goes through
 * `meet` (`src/lib/graph/graph.ts`), and alternatives compare their ends with
 * `sameSet`.
 *
 * Fitting is ONE-SIDED on purpose. Building down from a slot matches where it
 * lands; building up into one matches where it starts. A gap often takes more
 * than one figure to close, so filtering by both neighbours at once would hide
 * exactly the figure that starts the bridge.
 */
import { meet, sameSet } from '$lib/graph/graph';
import type { RowEdges } from './routines';
import { fold } from '../fold';
import { fromTags } from '$lib/clones/from-tag';
import { t } from '$lib/i18n/catalog';
import type { TeamRef, TwinNote } from '$lib/types';

export interface Candidate {
	kind: 'figure' | 'routine';
	id: number;
	/** The figure a variation belongs to; null for a routine. */
	groupId: number | null;
	/** The figure's name, for the group heading; null for a routine. */
	figure: string | null;
	/** "Enchufla · Doble" — a variation, never its bare name. */
	label: string;
	/** Where it can start. Empty: anywhere. */
	starts: number[];
	startCounts: number[];
	/** Where it leaves the hands. Empty: anything can follow. */
	ends: number[];
	next: number | null;
	/** A group's row a person may use: whose it is. */
	team?: TeamRef;
	/** The person's twins of it that this candidate stands for (`clones/twins.ts`). */
	twins?: TwinNote[];
	/** The place of the copy's source when the viewer reads it; drawn beside a same name. */
	from?: string | null;
}

/** `ends`: `[]` anything can follow, null unknown (the row's options disagree). */
type After = { kind: 'after'; ends: number[] | null; next: number | null };
type Before = { kind: 'before'; starts: number[]; startCounts: number[] };

export type Anchor =
	| { kind: 'none' }
	/** Building down from a slot: where it lands, and the count it leaves the next on. */
	| After
	/** Building up into a slot: where it can be entered, and on which counts. */
	| Before
	/**
	 * Closing a seam in one step: fits the slot above AND the slot below. Each
	 * filter applies to both sides at once — Count means it starts on the count
	 * the slot above leaves AND leaves the slot below on its count.
	 */
	| { kind: 'between'; after: After; before: Before }
	/** Standing in for a slot's main figure. `exclude` is what the slot already holds. */
	| {
			kind: 'alternative';
			starts: number[];
			startCount: number;
			ends: number[];
			next: number;
			exclude: number[];
	  };

export interface Filters {
	count: boolean;
	hold: boolean;
	query: string;
}

export interface PickGroup {
	groupId: number;
	/** The figure's name: a non-pickable heading in the sheet. */
	name: string;
	/** The figure has exactly one variation (fitting or not): one pickable row, no heading. */
	single: boolean;
	/** Only the fitting ones; a group with none is left out. */
	variations: Candidate[];
	/** A group's move: the group it is labelled with. */
	team?: TeamRef;
}

/** The variation's own name: the part of "Enchufla · Doble" after the figure. */
export function variationName(c: Candidate): string {
	const prefix = `${c.figure} · `;
	return c.figure !== null && c.label.startsWith(prefix) ? c.label.slice(prefix.length) : c.label;
}

/** A group's same-named variations: where each copy came from ("· Sreda 17:30"). */
export function groupTags(g: PickGroup): Map<number, string> {
	return fromTags(
		g.variations.map((v) => ({ id: v.id, name: variationName(v), from: v.from ?? null }))
	);
}

export interface PickList {
	figures: PickGroup[];
	routines: Candidate[];
	/** Which chips mean anything here: a side the anchor does not know cannot filter. */
	toggles: { count: boolean; hold: boolean };
	/** Chips that, turned off, would show something. Empty unless the list is. */
	emptiedBy: ('count' | 'hold')[];
}

export { fold };

function toggles(a: Anchor): { count: boolean; hold: boolean } {
	// The hold chip only means something when the anchor names a position on its side.
	if (a.kind === 'after') return { count: a.next !== null, hold: (a.ends?.length ?? 0) > 0 };
	if (a.kind === 'before') return { count: a.startCounts.length > 0, hold: a.starts.length > 0 };
	if (a.kind === 'between') {
		const x = toggles(a.after);
		const y = toggles(a.before);
		return { count: x.count || y.count, hold: x.hold || y.hold };
	}
	return { count: false, hold: false };
}

function fitsCount(c: Candidate, a: Anchor): boolean {
	if (a.kind === 'between') return fitsCount(c, a.after) && fitsCount(c, a.before);
	if (a.kind === 'after') return a.next === null || c.startCounts.includes(a.next);
	if (a.kind === 'before') {
		return a.startCounts.length === 0 || (c.next !== null && a.startCounts.includes(c.next));
	}
	return true;
}

function fitsHold(c: Candidate, a: Anchor): boolean {
	if (a.kind === 'between') return fitsHold(c, a.after) && fitsHold(c, a.before);
	if (a.kind === 'after') return a.ends === null || meet(a.ends, c.starts);
	if (a.kind === 'before') return meet(c.ends, a.starts);
	return true;
}

/**
 * The server's rule for an alternative (`addOption`), mirrored: the same set of
 * ends, the same counts, and starts that meet the main figure's. Not
 * switchable — the server would refuse anything else.
 */
function standsIn(c: Candidate, a: Extract<Anchor, { kind: 'alternative' }>): boolean {
	return (
		c.kind === 'figure' &&
		!a.exclude.includes(c.id) &&
		sameSet(c.ends, a.ends) &&
		c.next === a.next &&
		c.startCounts.includes(a.startCount) &&
		meet(c.starts, a.starts)
	);
}

export function pickList(candidates: Candidate[], anchor: Anchor, filters: Filters): PickList {
	const t = toggles(anchor);
	// Word by word, in any order: a variation's label is "Enchufla · Doble", so
	// "enchufla doble" as one substring would never match it.
	const words = fold(filters.query).split(/\s+/).filter(Boolean);
	const matches = (c: Candidate) => {
		const label = fold(c.label);
		return words.every((w) => label.includes(w));
	};

	const build = (on: { count: boolean; hold: boolean }) => {
		const ok = (c: Candidate) =>
			matches(c) &&
			(anchor.kind === 'alternative'
				? standsIn(c, anchor)
				: (!on.count || fitsCount(c, anchor)) && (!on.hold || fitsHold(c, anchor)));
		const groups = new Map<
			number,
			{ name: string; team?: TeamRef; total: number; fitting: Candidate[] }
		>();
		for (const c of candidates) {
			if (c.kind !== 'figure' || c.groupId === null) continue;
			let g = groups.get(c.groupId);
			if (!g)
				groups.set(
					c.groupId,
					(g = { name: c.figure ?? c.label, team: c.team, total: 0, fitting: [] })
				);
			g.total++;
			if (ok(c)) g.fitting.push(c);
		}
		const figures: PickGroup[] = [];
		for (const [groupId, g] of groups) {
			if (g.fitting.length > 0) {
				figures.push({
					groupId,
					name: g.name,
					single: g.total === 1,
					variations: g.fitting,
					...(g.team ? { team: g.team } : {})
				});
			}
		}
		const routines =
			anchor.kind === 'alternative' ? [] : candidates.filter((c) => c.kind === 'routine' && ok(c));
		return { figures, routines };
	};
	const isEmpty = (l: ReturnType<typeof build>) =>
		l.figures.length === 0 && l.routines.length === 0;

	const on = { count: filters.count && t.count, hold: filters.hold && t.hold };
	const list = build(on);
	const emptiedBy: ('count' | 'hold')[] = [];
	if (isEmpty(list)) {
		if (on.count && !isEmpty(build({ ...on, count: false }))) emptiedBy.push('count');
		if (on.hold && !isEmpty(build({ ...on, hold: false }))) emptiedBy.push('hold');
		if (
			emptiedBy.length === 0 &&
			on.count &&
			on.hold &&
			!isEmpty(build({ count: false, hold: false }))
		) {
			emptiedBy.push('count', 'hold');
		}
	}
	return { ...list, toggles: t, emptiedBy };
}

/** Building down from a row. No anchor when the row has nothing danceable to build from. */
export function anchorAfter(e: RowEdges): Anchor {
	return e.ends === null && e.next === null
		? { kind: 'none' }
		: { kind: 'after', ends: e.ends, next: e.next };
}

/** Building up into a row. `starts: []` with a start count is "enters from anywhere", not nothing. */
export function anchorBefore(e: RowEdges): Anchor {
	return e.starts.length === 0 && e.startCounts.length === 0
		? { kind: 'none' }
		: { kind: 'before', starts: e.starts, startCounts: e.startCounts };
}

/**
 * Closing the seam between two rows in one step. Null unless BOTH rows have
 * something danceable — with one side unknown, it is just a one-sided build.
 */
export function anchorBetween(above: RowEdges, below: RowEdges): Anchor | null {
	const after = anchorAfter(above);
	const before = anchorBefore(below);
	if (after.kind !== 'after' || before.kind !== 'before') return null;
	return { kind: 'between', after, before };
}

/**
 * Whether anything closes this seam in one step, with both filters on: the
 * editor offers the between-button only when there is something to pick.
 */
export function canBridge(candidates: Candidate[], anchor: Anchor | null): boolean {
	if (anchor === null) return false;
	const l = pickList(candidates, anchor, { count: true, hold: true, query: '' });
	return l.figures.length > 0 || l.routines.length > 0;
}

/**
 * Standing in for a main figure. Null when it is archived or gone: nothing to
 * match. A main figure with no position has an anchor like any other: its
 * alternatives must have no ends either, and may start anywhere.
 */
export function anchorAlternative(main: Candidate | undefined, exclude: number[]): Anchor | null {
	if (!main || main.next === null || main.startCounts.length === 0) return null;
	return {
		kind: 'alternative',
		starts: main.starts,
		startCount: main.startCounts[0],
		ends: main.ends,
		next: main.next,
		exclude
	};
}

/** The count before `n`: a slot starting on 1 is reached by a figure ending on 8. */
const countBefore = (n: number) => (n === 1 ? 8 : n - 1);

/** The picker's context line. Null when there is nothing to say. */
export function anchorText(a: Anchor, name: (id: number) => string): string | null {
	const w = t().routine.picker;
	const or = ` ${t().figure.or} `;
	const names = (ids: number[]) => ids.map(name).join(or);
	if (a.kind === 'after') {
		const from = a.ends !== null && a.ends.length > 0 ? names(a.ends) : null;
		if (a.next !== null && from !== null) return w.startsOnFrom(a.next, from);
		if (a.next !== null) return w.startsOn(a.next);
		if (from !== null) return w.startsFrom(from);
		return null;
	}
	if (a.kind === 'before') {
		const counts = a.startCounts.map(countBefore).join(or);
		if (counts && a.starts.length > 0) return w.endsOnAt(counts, names(a.starts));
		if (counts) return w.endsOn(counts);
		if (a.starts.length > 0) return w.endsAt(names(a.starts));
		return null;
	}
	if (a.kind === 'between') {
		const from = anchorText(a.after, name);
		const to = anchorText(a.before, name);
		if (from && to) return `${from} · ${to[0].toLowerCase()}${to.slice(1)}`;
		return from ?? to;
	}
	if (a.kind === 'alternative') {
		const counts = `${a.startCount}→${a.next}`;
		if (a.starts.length === 0 && a.ends.length === 0) return counts;
		const from = a.starts.length > 0 ? names(a.starts) : w.anywhereFrom;
		const to = a.ends.length > 0 ? names(a.ends) : w.anywhereTo;
		return `${from} → ${to}, ${counts}`;
	}
	return null;
}
