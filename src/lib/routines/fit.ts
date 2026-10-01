/**
 * The picker's brain: which figures, variations and routines fit next to a
 * slot, grouped the way the sheet shows them.
 *
 * PURE and client-safe, like the rest of `src/lib/routines/`: the load hands
 * over candidates whose positions are already resolved (untagged reads as
 * neutral there, through `startsOf`/`endOf`), and nothing here knows dances
 * exist.
 *
 * Fitting is ONE-SIDED on purpose. Building down from a slot matches where it
 * lands; building up into one matches where it starts. A gap often takes more
 * than one figure to close, so filtering by both neighbours at once would hide
 * exactly the figure that starts the bridge.
 */
import type { RowEdges } from './routines';

export interface Candidate {
	kind: 'figure' | 'routine';
	id: number;
	/** A variation's figure; null for a figure or a routine. */
	parentId: number | null;
	/** "Enchufla · Doble" for a variation — never its bare name. */
	label: string;
	/** Resolved positions. Empty when nothing in it is danceable. */
	starts: number[];
	startCounts: number[];
	end: number | null;
	next: number | null;
}

export type Anchor =
	| { kind: 'none' }
	/** Building down from a slot: where it lands, and the count it leaves the next on. */
	| { kind: 'after'; end: number | null; next: number | null }
	/** Building up into a slot: where it can be entered, and on which counts. */
	| { kind: 'before'; starts: number[]; startCounts: number[] }
	/** Standing in for a slot's main figure. `exclude` is what the slot already holds. */
	| {
			kind: 'alternative';
			starts: number[];
			startCount: number;
			end: number;
			next: number;
			exclude: number[];
	  };

export interface Filters {
	count: boolean;
	hold: boolean;
	query: string;
}

export interface PickGroup {
	head: Candidate;
	/** False: the figure itself does not fit; it is shown greyed so its variations still read as a group. */
	headFits: boolean;
	variations: Candidate[];
}

export interface PickList {
	figures: PickGroup[];
	routines: Candidate[];
	/** Which chips mean anything here: a side the anchor does not know cannot filter. */
	toggles: { count: boolean; hold: boolean };
	/** Chips that, turned off, would show something. Empty unless the list is. */
	emptiedBy: ('count' | 'hold')[];
}

/** Lowercase, accents stripped: "Dile Qué Nó" and "dile que no" are one search. */
export function fold(s: string): string {
	return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function toggles(a: Anchor): { count: boolean; hold: boolean } {
	if (a.kind === 'after') return { count: a.next !== null, hold: a.end !== null };
	if (a.kind === 'before') return { count: a.startCounts.length > 0, hold: a.starts.length > 0 };
	return { count: false, hold: false };
}

function fitsCount(c: Candidate, a: Anchor): boolean {
	if (a.kind === 'after') return a.next === null || c.startCounts.includes(a.next);
	if (a.kind === 'before') {
		return a.startCounts.length === 0 || (c.next !== null && a.startCounts.includes(c.next));
	}
	return true;
}

function fitsHold(c: Candidate, a: Anchor): boolean {
	if (a.kind === 'after') return a.end === null || c.starts.includes(a.end);
	if (a.kind === 'before') {
		return a.starts.length === 0 || (c.end !== null && a.starts.includes(c.end));
	}
	return true;
}

/**
 * The server's rule for an alternative (`addOption`), mirrored: same landing,
 * same start count, at least one shared start. Not switchable — the server
 * would refuse anything else.
 */
function standsIn(c: Candidate, a: Extract<Anchor, { kind: 'alternative' }>): boolean {
	return (
		c.kind === 'figure' &&
		!a.exclude.includes(c.id) &&
		c.end === a.end &&
		c.next === a.next &&
		c.startCounts.includes(a.startCount) &&
		c.starts.some((p) => a.starts.includes(p))
	);
}

export function pickList(candidates: Candidate[], anchor: Anchor, filters: Filters): PickList {
	const t = toggles(anchor);
	const q = fold(filters.query.trim());
	const matches = (c: Candidate) => q === '' || fold(c.label).includes(q);

	const build = (on: { count: boolean; hold: boolean }) => {
		const ok = (c: Candidate) =>
			matches(c) &&
			(anchor.kind === 'alternative'
				? standsIn(c, anchor)
				: (!on.count || fitsCount(c, anchor)) && (!on.hold || fitsHold(c, anchor)));
		const figures: PickGroup[] = [];
		for (const head of candidates) {
			if (head.kind !== 'figure' || head.parentId !== null) continue;
			const variations = candidates.filter(
				(c) => c.kind === 'figure' && c.parentId === head.id && ok(c)
			);
			const headFits = ok(head);
			if (headFits || variations.length > 0) figures.push({ head, headFits, variations });
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
	return e.end === null && e.next === null
		? { kind: 'none' }
		: { kind: 'after', end: e.end, next: e.next };
}

/** Building up into a row. */
export function anchorBefore(e: RowEdges): Anchor {
	return e.starts.length === 0 && e.startCounts.length === 0
		? { kind: 'none' }
		: { kind: 'before', starts: e.starts, startCounts: e.startCounts };
}

/** Standing in for a main figure. Null when it is archived or gone: nothing to match. */
export function anchorAlternative(main: Candidate | undefined, exclude: number[]): Anchor | null {
	if (!main || main.end === null || main.next === null || main.startCounts.length === 0)
		return null;
	return {
		kind: 'alternative',
		starts: main.starts,
		startCount: main.startCounts[0],
		end: main.end,
		next: main.next,
		exclude
	};
}

/** The count before `n`: a slot starting on 1 is reached by a figure ending on 8. */
const countBefore = (n: number) => (n === 1 ? 8 : n - 1);

/** The picker's context line. Null when there is nothing to say. */
export function anchorText(a: Anchor, name: (id: number) => string): string | null {
	const names = (ids: number[]) => ids.map(name).join(' or ');
	if (a.kind === 'after') {
		if (a.next !== null && a.end !== null) return `Starts on ${a.next} from ${name(a.end)}`;
		if (a.next !== null) return `Starts on ${a.next}`;
		if (a.end !== null) return `Starts from ${name(a.end)}`;
		return null;
	}
	if (a.kind === 'before') {
		const counts = a.startCounts.map(countBefore).join(' or ');
		if (counts && a.starts.length > 0) return `Ends on ${counts} at ${names(a.starts)}`;
		if (counts) return `Ends on ${counts}`;
		if (a.starts.length > 0) return `Ends at ${names(a.starts)}`;
		return null;
	}
	if (a.kind === 'alternative') {
		return `${names(a.starts)} → ${name(a.end)}, ${a.startCount}→${a.next}`;
	}
	return null;
}
