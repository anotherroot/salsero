/**
 * The picker's brain: which figures, variations and routines fit next to a
 * slot, grouped the way the sheet shows them.
 *
 * PURE and client-safe, like the rest of `src/lib/routines/`: the load hands
 * over candidates with their positions, and nothing here knows dances exist.
 * An untagged side fits anything: every comparison of hands goes through
 * `meet` (`src/lib/graph/graph.ts`).
 *
 * Fitting is ONE-SIDED on purpose. Building down from a slot matches where it
 * lands; building up into one matches where it starts. A gap often takes more
 * than one figure to close, so filtering by both neighbours at once would hide
 * exactly the figure that starts the bridge.
 */
import { meet } from '$lib/graph/graph';
import { LENGTH_CHOICES, nextCount } from '$lib/graph/timing';
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
	/** A figure's own length in counts; absent: read `next` as it is. */
	length?: number;
	/** A figure whose length is set in the routine: it can land on any count. */
	free?: boolean;
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
	| { kind: 'between'; after: After; before: Before };

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

/** Where a candidate leaves the next figure when it starts on `start`; a routine (or a figure read without its length) by its own `next`. */
function landsFrom(c: Candidate, start: number): number | null {
	return c.kind === 'figure' && c.length !== undefined ? nextCount(start, c.length) : c.next;
}

/**
 * Whether a candidate can leave the slot below on one of its counts. `start`
 * is the count the slot above gives it; null: any of its own starts. A figure
 * whose length is set in the routine can land anywhere (its length is settled
 * in the How long? sheet).
 */
function landsBefore(c: Candidate, a: Before, start: number | null): boolean {
	if (a.startCounts.length === 0 || c.free) return true;
	const from = start !== null ? [start] : c.startCounts.length > 0 ? c.startCounts : [];
	const lands =
		from.length > 0 && c.length !== undefined ? from.map((s) => landsFrom(c, s)) : [c.next];
	return lands.some((n) => n !== null && a.startCounts.includes(n));
}

function fitsCount(c: Candidate, a: Anchor): boolean {
	if (a.kind === 'between') {
		return fitsCount(c, a.after) && landsBefore(c, a.before, a.after.next);
	}
	if (a.kind === 'after') return a.next === null || c.startCounts.includes(a.next);
	if (a.kind === 'before') return landsBefore(c, a, null);
	return true;
}

function fitsHold(c: Candidate, a: Anchor): boolean {
	if (a.kind === 'between') return fitsHold(c, a.after) && fitsHold(c, a.before);
	if (a.kind === 'after') return a.ends === null || meet(a.ends, c.starts);
	if (a.kind === 'before') return meet(c.ends, a.starts);
	return true;
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
			matches(c) && (!on.count || fitsCount(c, anchor)) && (!on.hold || fitsHold(c, anchor));
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
		const routines = candidates.filter((c) => c.kind === 'routine' && ok(c));
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

/** Whether `n` counts from `start` leave the next slot on `want` (null: anything goes). */
export function fitsLength(start: number, n: number, want: number | null): boolean {
	return want === null || nextCount(start, n) === want;
}

/**
 * The How long? sheet's buttons for a figure starting on `start`: each length
 * it offers, greyed (`ok` false) when it would leave the next slot on another
 * count than `want` — the count the slot's other options leave it on.
 */
export function lengthChoices(start: number, want: number | null): { n: number; ok: boolean }[] {
	return LENGTH_CHOICES.map((n) => ({ n, ok: fitsLength(start, n, want) }));
}

/** The shortest offered length that lands where the slot below starts; null when none does, or nothing waits below. */
export function preselect(start: number, want: number | null): number | null {
	if (want === null) return null;
	return LENGTH_CHOICES.find((n) => fitsLength(start, n, want)) ?? null;
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
	return null;
}
