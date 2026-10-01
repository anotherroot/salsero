/**
 * A routine's shape, and what the figure graph says about it.
 *
 * PURE and client-safe, the same rules `src/lib/graph/` follows: no database,
 * no DOM, no `Date.now()`, and no idea that dances exist — the data-access
 * layer scopes to one dance and hands over plain data.
 *
 * Nothing here is stored. Where a routine starts, where it ends, where it
 * breaks and whether it loops are all recomputed per request, for the same
 * reason urgency is: a cached answer is a second source of truth that goes
 * stale the moment a tag is edited.
 *
 * Every position is read through `startsOf` and `endOf`, never off the figure
 * row, because those two are what make an untagged figure resolve to the
 * neutral position. A repertoire nobody has tagged is one big hub, and a
 * routine over it is all seams and no breaks — which is honest.
 */
import { endOf, figureById, nextCountOf, startsOf, type Graph } from '$lib/graph/graph';

/** A slot filled by interchangeable figures — the alternatives. */
export interface OptionsSlot {
	kind: 'options';
	figureIds: number[];
	/** The slot's reminder, shown beside it while practising. */
	note?: string | null;
}

/**
 * A slot filled by an embedded routine.
 *
 * Its own slots are always `OptionsSlot`: embedding is one level, enforced on
 * write, so the type says so too and nothing downstream has to recurse.
 */
export interface ChildSlot {
	kind: 'child';
	routineId: number;
	slots: OptionsSlot[];
	/** A note on the embedding slot, which applies to the child as a whole. */
	note?: string | null;
}

export type Slot = OptionsSlot | ChildSlot;

export interface RoutineShape {
	slots: Slot[];
}

/**
 * The routine as one flat run of option slots, children spliced in place.
 *
 * Everything else here works on this, which is why a break INSIDE an embedded
 * routine and a break at its seam are both visible: the embedded slot borrows
 * the child's shape rather than hiding it.
 *
 * An option no figure in the graph answers for is dropped, and a slot left with
 * none disappears with it. Archiving a figure must not be able to stop a
 * routine playing, and a slot that can call nothing is not a slot.
 */
export function flatten(g: Graph, shape: RoutineShape): OptionsSlot[] {
	const out: OptionsSlot[] = [];
	for (const slot of shape.slots) {
		for (const s of slot.kind === 'child' ? slot.slots : [slot]) {
			const figureIds = s.figureIds.filter((id) => figureById(g, id) !== null);
			// A child's own slot note wins; the note on the slot that EMBEDS the
			// child applies to the whole child, so it stands in where an inner slot
			// has nothing of its own to say.
			if (figureIds.length > 0) {
				out.push({ kind: 'options', figureIds, note: s.note ?? slot.note ?? null });
			}
		}
	}
	return out;
}

/**
 * Which flat slot a run is on, from the number of calls made so far.
 *
 * Before the first call it is the FIRST slot rather than nothing: the list has
 * to say where the routine is about to start, or it reads as dead for the few
 * seconds before the lead-in ends.
 *
 * The double modulo is not decoration. The index comes from a `findIndex`,
 * which answers -1 when it misses, and `-1 % 5` is `-1` in JavaScript — that
 * indexes off the front of the list and silently highlights no row at all.
 */
export function slotAt(calledIndex: number | null, slotCount: number): number | null {
	if (slotCount <= 0) return null;
	if (calledIndex === null) return 0;
	return ((calledIndex % slotCount) + slotCount) % slotCount;
}

/**
 * Every position this slot can be entered from: the union of its options'.
 *
 * Permissive on purpose. An option that does not work from where the hands are
 * is simply not picked at run time, rather than blocked while authoring.
 */
export function slotStarts(g: Graph, slot: OptionsSlot): number[] {
	const out = new Set<number>();
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (!f) continue;
		for (const p of startsOf(g, f)) out.add(p);
	}
	return [...out];
}

/**
 * The position every option leaves the hands at, or null when they disagree.
 *
 * Disagreement is refused on write — that is what interchangeable means — but
 * pure code must not assume the write path was the only way rows arrived. A
 * hand-edited database should read as "end unknown" rather than pick a winner,
 * and the callers here all decline to guess.
 */
export function sharedEnd(g: Graph, slot: OptionsSlot): number | null {
	let end: number | null = null;
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (!f) continue;
		const e = endOf(g, f);
		if (end === null) end = e;
		else if (end !== e) return null;
	}
	return end;
}

/**
 * Every count this slot can begin on: the union of its options'. Permissive in
 * the same way `slotStarts` is.
 */
export function slotStartCounts(g: Graph, slot: OptionsSlot): number[] {
	const out = new Set<number>();
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (f) out.add(f.start);
	}
	return [...out].sort((a, b) => a - b);
}

/**
 * The count every option leaves the next figure to begin on, or null when they
 * disagree. Disagreement is refused on write (`addOption`); pure code reads a
 * row that got past it as "unknown", exactly as `sharedEnd` does.
 */
export function sharedNextCount(g: Graph, slot: OptionsSlot): number | null {
	let next: number | null = null;
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (!f) continue;
		const n = nextCountOf(f);
		if (next === null) next = n;
		else if (next !== n) return null;
	}
	return next;
}

export interface SlotTiming {
	/** Counts the slot can begin on. Empty when nothing in it is danceable. */
	starts: number[];
	/** The count it leaves the next slot on, or null when unknown. */
	next: number | null;
}

/**
 * One editor row's timing. An embedded routine borrows its first slot's start
 * counts and its last slot's next count, the way it borrows positions.
 */
export function slotTiming(g: Graph, slot: Slot): SlotTiming {
	const flat = flatten(g, { slots: [slot] });
	if (flat.length === 0) return { starts: [], next: null };
	return {
		starts: slotStartCounts(g, flat[0]),
		next: sharedNextCount(g, flat[flat.length - 1])
	};
}

/**
 * Where one editor row begins and lands, in the hands and on the count: what
 * the picker filters against when building next to it, and what a seam
 * compares. An embedded routine borrows its first slot's starts and its last
 * slot's end, the way it does everywhere else. All empty / null when nothing in
 * the row is danceable — an archived-only slot has no edges to build from.
 */
export interface RowEdges {
	starts: number[];
	startCounts: number[];
	end: number | null;
	next: number | null;
}

export function rowEdges(g: Graph, slot: Slot): RowEdges {
	const flat = flatten(g, { slots: [slot] });
	if (flat.length === 0) return { starts: [], startCounts: [], end: null, next: null };
	const first = flat[0];
	const last = flat[flat.length - 1];
	return {
		starts: slotStarts(g, first),
		startCounts: slotStartCounts(g, first),
		end: sharedEnd(g, last),
		next: sharedNextCount(g, last)
	};
}

/** Where the routine can be started. Empty when it has no danceable slot. */
export function routineStarts(g: Graph, shape: RoutineShape): number[] {
	const flat = flatten(g, shape);
	return flat.length === 0 ? [] : slotStarts(g, flat[0]);
}

/** Where it leaves the hands, or null if the last slot's options disagree. */
export function routineEnd(g: Graph, shape: RoutineShape): number | null {
	const flat = flatten(g, shape);
	return flat.length === 0 ? null : sharedEnd(g, flat[flat.length - 1]);
}

/**
 * Flat slot indices `i` where the hands cannot get from slot `i` to `i + 1`.
 *
 * Reported, never refused. This is a personal app and the dancer may know
 * something the graph does not — a tag that is simply missing, or a transition
 * their body makes anyway. A slot whose own end is unknown yields no break:
 * there is nothing to compare, and a warning nobody can act on is noise.
 */
export function breaks(g: Graph, shape: RoutineShape): number[] {
	const flat = flatten(g, shape);
	const out: number[] = [];
	for (let i = 0; i + 1 < flat.length; i++) {
		const end = sharedEnd(g, flat[i]);
		if (end === null) continue;
		if (!slotStarts(g, flat[i + 1]).includes(end)) out.push(i);
	}
	return out;
}

/**
 * Flat slot indices `i` where slot `i` leaves the next figure on a count slot
 * `i + 1` cannot begin on. The timing twin of `breaks`: reported, never
 * refused, and silent out of a slot whose next count is unknown.
 */
export function timingBreaks(g: Graph, shape: RoutineShape): number[] {
	const flat = flatten(g, shape);
	const out: number[] = [];
	for (let i = 0; i + 1 < flat.length; i++) {
		const next = sharedNextCount(g, flat[i]);
		if (next === null) continue;
		if (!slotStartCounts(g, flat[i + 1]).includes(next)) out.push(i);
	}
	return out;
}

/** A timing break between two of the editor's own rows (indices into `shape.slots`). */
export interface TimingSeam {
	after: number;
	next: number;
}

/**
 * `timingBreaks`, indexed by the editor's rows instead of the flat run.
 *
 * Flat indices drift from the rows as soon as a slot is dropped from the run —
 * one whose figures are all archived — or a child routine expands into
 * several, which put a marker on the wrong row with text read from the wrong
 * slot. Here each row is compared with the next row that has anything
 * danceable, and a child routine is one row with its borrowed timing. A break
 * INSIDE a child is not a seam between two rows; `timingBreaks` still counts it.
 */
export function timingSeams(g: Graph, shape: RoutineShape): TimingSeam[] {
	const rows = shape.slots.map((s) => slotTiming(g, s));
	const out: TimingSeam[] = [];
	for (let i = 0; i < rows.length; i++) {
		const next = rows[i].next;
		if (next === null) continue;
		const j = rows.findIndex((r, k) => k > i && r.starts.length > 0);
		if (j === -1) continue;
		if (!rows[j].starts.includes(next)) out.push({ after: i, next: j });
	}
	return out;
}

/** A position break between two of the editor's own rows. Same shape as a timing seam. */
export type PositionSeam = TimingSeam;

/**
 * `breaks`, indexed by the editor's rows instead of the flat run — the twin of
 * `timingSeams`, for the same reason: flat indices drift from the rows as soon
 * as a slot embeds a routine or holds only archived figures, and the editor
 * draws a seam BETWEEN two rows. A break inside a child is not a seam between
 * rows; `breaks` still counts it.
 */
export function positionSeams(g: Graph, shape: RoutineShape): PositionSeam[] {
	const rows = shape.slots.map((s) => rowEdges(g, s));
	const out: PositionSeam[] = [];
	for (let i = 0; i < rows.length; i++) {
		const end = rows[i].end;
		if (end === null) continue;
		const j = rows.findIndex((r, k) => k > i && r.starts.length > 0);
		if (j === -1) continue;
		if (!rows[j].starts.includes(end)) out.push({ after: i, next: j });
	}
	return out;
}

/**
 * Whether the routine runs straight back into itself — in the hands AND on the
 * count.
 *
 * A free diagnostic worth showing: the player loops a routine when the song
 * outlasts it, so a routine that does not loop will cross one break per lap.
 */
export function loops(g: Graph, shape: RoutineShape): boolean {
	const flat = flatten(g, shape);
	if (flat.length === 0) return false;
	const first = flat[0];
	const last = flat[flat.length - 1];
	const end = sharedEnd(g, last);
	const next = sharedNextCount(g, last);
	return (
		end !== null &&
		next !== null &&
		slotStarts(g, first).includes(end) &&
		slotStartCounts(g, first).includes(next)
	);
}
