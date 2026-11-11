/**
 * A routine's shape, and what the figure graph says about it.
 *
 * PURE and client-safe, the same rules `src/lib/graph/` follows: no database,
 * no DOM, no `Date.now()`, and no idea that dances exist — the data-access
 * layer scopes to one dance and hands over plain data.
 *
 * Nothing here is stored. Where a routine starts, where it ends, where it
 * breaks and whether it loops are all recomputed per request, for the same
 * reason the schedule is: a cached answer is a second source of truth that goes
 * stale the moment a tag is edited.
 *
 * An untagged side fits anything: a slot whose starts are `[]` can be entered
 * from anywhere, and one whose ends are `[]` can be followed by anything. Every
 * comparison of two sides goes through `meet` (`src/lib/graph/graph.ts`), so a
 * repertoire nobody has tagged is all seams and no breaks — which is honest.
 */
import { countsOf, figureById, meet, sameSet, type Graph } from '$lib/graph/graph';
import { nextCount, startOn } from '$lib/graph/timing';

/** A slot filled by interchangeable figures — the alternatives. */
export interface OptionsSlot {
	kind: 'options';
	figureIds: number[];
	/** The slot's reminder, shown beside it while practising. */
	note?: string | null;
	/**
	 * Each option's length in this slot, by figure id: read only for a figure
	 * whose length is free (`optionLength`). Absent: every option its own length.
	 */
	lengths?: Record<number, number>;
	/** The `routine_steps` row, when the data layer knows it (`stepIncoming`). */
	stepId?: number;
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
				out.push({
					kind: 'options',
					figureIds,
					note: s.note ?? slot.note ?? null,
					...(s.lengths ? { lengths: s.lengths } : {}),
					...(s.stepId !== undefined ? { stepId: s.stepId } : {})
				});
			}
		}
	}
	return out;
}

/**
 * Every position this slot can be entered from: the union of its options'.
 * `[]` — anywhere — as soon as any option has no start, since that option can
 * be entered from anywhere and so can the slot.
 *
 * Permissive on purpose. An option that does not work from where the hands are
 * is simply not picked at run time, rather than blocked while authoring.
 */
export function slotStarts(g: Graph, slot: OptionsSlot): number[] {
	const out = new Set<number>();
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (!f) continue;
		if (f.starts.length === 0) return [];
		for (const p of f.starts) out.add(p);
	}
	return [...out];
}

/**
 * The set of positions every option can leave the hands in, ascending, or null
 * when they disagree (or nothing in the slot is danceable). `[]` when no option
 * has an end: anything can follow.
 *
 * Disagreement is refused on write — that is what interchangeable means — but
 * pure code must not assume the write path was the only way rows arrived. A
 * hand-edited database should read as "ends unknown" rather than pick a
 * winner, and the callers here all decline to guess.
 */
export function slotEnds(g: Graph, slot: OptionsSlot): number[] | null {
	let ends: number[] | null = null;
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (!f) continue;
		if (ends === null) ends = [...new Set(f.ends)].sort((a, b) => a - b);
		else if (!sameSet(ends, f.ends)) return null;
	}
	return ends;
}

/**
 * Every count this slot can begin on: the union of its options'. Permissive in
 * the same way `slotStarts` is.
 */
export function slotStartCounts(g: Graph, slot: OptionsSlot): number[] {
	const out = new Set<number>();
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (f) for (const n of countsOf(f)) out.add(n);
	}
	return [...out].sort((a, b) => a - b);
}

/**
 * How many counts an option takes in this slot: the slot's own length for a
 * figure whose length is free and that has one, else the figure's length. A
 * length kept from when the figure was free is not used once it is fixed.
 */
export function optionLength(g: Graph, slot: OptionsSlot, figureId: number): number {
	const f = figureById(g, figureId);
	if (!f) return 0;
	const own = slot.lengths?.[figureId];
	return f.free && own !== undefined ? own : f.length;
}

/**
 * The count every option leaves the next figure to begin on, each option
 * starting where `incoming` says it can (`startOn`), or null when they
 * disagree. Disagreement is refused on write (`addOption`, `setOptionLength`);
 * pure code reads a row that got past it — or one an edit further up has since
 * split — as "unknown", exactly as `slotEnds` does.
 */
export function slotNext(g: Graph, slot: OptionsSlot, incoming: number | null): number | null {
	let next: number | null = null;
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (!f) continue;
		const n = nextCount(startOn(countsOf(f), f.start, incoming), optionLength(g, slot, id));
		if (next === null) next = n;
		else if (next !== n) return null;
	}
	return next;
}

/** `slotNext` with each option on its usual start: a slot read on its own. */
export function sharedNextCount(g: Graph, slot: OptionsSlot): number | null {
	return slotNext(g, slot, null);
}

/** One slot of the walk: the count it is entered on, where its main figure starts, where it leaves the next. */
export interface Walked {
	/** The count the slot before leaves it on; null for the first, and after an unknown. */
	incoming: number | null;
	/** Where the main (first) option starts; null when nothing in the slot is danceable. */
	start: number | null;
	next: number | null;
}

/**
 * The routine's run on the count (spec 2026-11-11): each slot starts where the
 * one before leaves off when its figures can, else on their usual start, and
 * takes its own length. Every timing reader goes through this, so a figure
 * nobody changed reads exactly as it always has: one start, its own length.
 */
export function walk(g: Graph, flat: OptionsSlot[]): Walked[] {
	const out: Walked[] = [];
	let incoming: number | null = null;
	for (const s of flat) {
		const main = s.figureIds.map((id) => figureById(g, id)).find((f) => f !== null) ?? null;
		const start = main ? startOn(countsOf(main), main.start, incoming) : null;
		const next = slotNext(g, s, incoming);
		out.push({ incoming, start, next });
		incoming = next;
	}
	return out;
}

/** The count the flat slot holding `stepId` is entered on; undefined when no slot holds it. */
export function stepIncoming(
	g: Graph,
	shape: RoutineShape,
	stepId: number
): number | null | undefined {
	const flat = flatten(g, shape);
	const i = flat.findIndex((s) => s.stepId === stepId);
	return i === -1 ? undefined : walk(g, flat)[i].incoming;
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
		next: walk(g, flat)[flat.length - 1].next
	};
}

/**
 * Where one editor row begins and lands, in the hands and on the count: what
 * the picker filters against when building next to it, and what a seam
 * compares. An embedded routine borrows its first slot's starts and its last
 * slot's ends, the way it does everywhere else. All empty / null when nothing
 * in the row is danceable — an archived-only slot has no edges to build from.
 *
 * `starts: []` alone does NOT mean undanceable: it is also "enters from
 * anywhere". `startCounts` is the tell — every danceable row has one.
 */
export interface RowEdges {
	starts: number[];
	startCounts: number[];
	/** `[]`: anything can follow. Null: unknown (options disagree, or nothing danceable). */
	ends: number[] | null;
	next: number | null;
	/**
	 * Where the row's main figure starts as the routine walks (`walk`): the
	 * slot's "1→5". Null when nothing in it is danceable. `startCounts` is every
	 * count it COULD begin on, which is what a slot built before it fits against.
	 */
	start: number | null;
}

const NO_EDGES: RowEdges = { starts: [], startCounts: [], ends: null, next: null, start: null };

function edgesOf(g: Graph, flat: OptionsSlot[], walked: Walked[]): RowEdges {
	if (flat.length === 0) return { ...NO_EDGES };
	const first = flat[0];
	const last = flat[flat.length - 1];
	return {
		starts: slotStarts(g, first),
		startCounts: slotStartCounts(g, first),
		ends: slotEnds(g, last),
		next: walked[walked.length - 1].next,
		start: walked[0].start
	};
}

/** One row read on its own, entered on no particular count. */
export function rowEdges(g: Graph, slot: Slot): RowEdges {
	const flat = flatten(g, { slots: [slot] });
	return edgesOf(g, flat, walk(g, flat));
}

/**
 * Every editor row's edges, as the routine walks: each row is entered where
 * the row before leaves off, an embedded routine from where the parent enters
 * it. Parallel to `shape.slots`.
 */
export function rowEdgesIn(g: Graph, shape: RoutineShape): RowEdges[] {
	const walked = walk(g, flatten(g, shape));
	let at = 0;
	return shape.slots.map((slot) => {
		const flat = flatten(g, { slots: [slot] });
		const edges = edgesOf(g, flat, walked.slice(at, at + flat.length));
		at += flat.length;
		return edges;
	});
}

/** Whether a row has anything danceable: every danceable row has a start count. */
const danceable = (e: { startCounts: number[] }) => e.startCounts.length > 0;

/** Where the routine can be started. Empty when it has no danceable slot, or starts anywhere. */
export function routineStarts(g: Graph, shape: RoutineShape): number[] {
	const flat = flatten(g, shape);
	return flat.length === 0 ? [] : slotStarts(g, flat[0]);
}

/**
 * Where it leaves the hands: `[]` anywhere, null when the last slot's options
 * disagree or nothing is danceable.
 */
export function routineEnds(g: Graph, shape: RoutineShape): number[] | null {
	const flat = flatten(g, shape);
	return flat.length === 0 ? null : slotEnds(g, flat[flat.length - 1]);
}

/**
 * Flat slot indices `i` where the hands cannot get from slot `i` to `i + 1`.
 *
 * Reported, never refused. This is a personal app and the dancer may know
 * something the graph does not — a tag that is simply missing, or a transition
 * their body makes anyway. A slot whose own ends are unknown yields no break:
 * there is nothing to compare, and a warning nobody can act on is noise. A side
 * with no position never breaks (`meet`).
 */
export function breaks(g: Graph, shape: RoutineShape): number[] {
	const flat = flatten(g, shape);
	const out: number[] = [];
	for (let i = 0; i + 1 < flat.length; i++) {
		const ends = slotEnds(g, flat[i]);
		if (ends === null) continue;
		if (!meet(ends, slotStarts(g, flat[i + 1]))) out.push(i);
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
	const walked = walk(g, flat);
	const out: number[] = [];
	for (let i = 0; i + 1 < flat.length; i++) {
		const next = walked[i].next;
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
	const rows = rowEdgesIn(g, shape);
	const out: TimingSeam[] = [];
	for (let i = 0; i < rows.length; i++) {
		const next = rows[i].next;
		if (next === null) continue;
		const j = rows.findIndex((r, k) => k > i && danceable(r));
		if (j === -1) continue;
		if (!rows[j].startCounts.includes(next)) out.push({ after: i, next: j });
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
		const ends = rows[i].ends;
		if (ends === null) continue;
		const j = rows.findIndex((r, k) => k > i && danceable(r));
		if (j === -1) continue;
		if (!meet(ends, rows[j].starts)) out.push({ after: i, next: j });
	}
	return out;
}

/**
 * The seams where the hands pass through one position, as editor rows
 * `[after, next]`: row `after` names it among its ends and the next danceable
 * row names it among its starts. A side with no position does not count — it
 * fits there, but nothing says the hands are there. A seam inside an embedded
 * routine is not a seam between rows, as with `positionSeams`.
 */
export function through(g: Graph, shape: RoutineShape, positionId: number): [number, number][] {
	const rows = shape.slots.map((s) => rowEdges(g, s));
	const out: [number, number][] = [];
	for (let i = 0; i < rows.length; i++) {
		if (!rows[i].ends?.includes(positionId)) continue;
		const j = rows.findIndex((r, k) => k > i && danceable(r));
		if (j === -1) continue;
		if (rows[j].starts.includes(positionId)) out.push([i, j]);
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
	const ends = slotEnds(g, last);
	const next = walk(g, flat)[flat.length - 1].next;
	return (
		ends !== null &&
		next !== null &&
		meet(ends, slotStarts(g, first)) &&
		slotStartCounts(g, first).includes(next)
	);
}
