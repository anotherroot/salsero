/**
 * A routine slot's end (spec 2026-11-11, slot end): where the hands are when
 * the slot is danced, as the routine sets it. PURE and client-safe — the
 * phone's copy reads the same.
 *
 * A slot's options may know several ends; the routine dances one. In order:
 * no positions — anything follows; one shared end — that one; the slot below
 * starts in exactly one of the shared ends — that one, decided for the person
 * (a stored choice is overridden, not erased); a stored end every option can
 * take — chosen; otherwise every shared end, waiting for a choice.
 *
 * Ids in the graph are canonical (one per family, twins merged); a stored end
 * is a real position id, read through `g.canon`.
 */
import { figureById, sameSet, type Graph } from '$lib/graph/graph';
import type { OptionsSlot } from './routines';

/** none: no positions · single: one shared end · decided: by the slot below · chosen · open: waits for a choice. */
export type EndState = 'none' | 'single' | 'decided' | 'chosen' | 'open';

export interface SlotEnd {
	/** Where the slot leaves the hands: `[]` anything follows, null unknown (the options share none). */
	ends: number[] | null;
	state: EndState;
	/** The stored end, canonical, while every option can take it; else null. */
	stored: number | null;
}

/** A stored (real) position id as the graph knows it. */
const canonOf = (g: Graph, id: number) => g.canon?.get(id) ?? id;

/**
 * The ends every option can leave the hands in, ascending. An option with no
 * end fits anything and narrows nothing; `[]` when no option has one; null
 * when they have ends but share none.
 */
export function sharedEnds(g: Graph, slot: OptionsSlot): number[] | null {
	let shared: number[] | null = null;
	for (const id of slot.figureIds) {
		const f = figureById(g, id);
		if (!f || f.ends.length === 0) continue;
		const own = [...new Set(f.ends)];
		shared = shared === null ? own : shared.filter((p) => own.includes(p));
	}
	if (shared === null) return [];
	return shared.length === 0 ? null : shared.sort((a, b) => a - b);
}

/**
 * The slot's effective end. `below`: where the slot below can start (null: no
 * slot below; `[]`: it enters anywhere, which decides nothing).
 */
export function slotEnd(g: Graph, slot: OptionsSlot, below: number[] | null): SlotEnd {
	const shared = sharedEnds(g, slot);
	const want = slot.end === undefined ? null : canonOf(g, slot.end);
	const stored = shared !== null && want !== null && shared.includes(want) ? want : null;
	if (shared === null) return { ends: null, state: 'open', stored: null };
	if (shared.length === 0) return { ends: [], state: 'none', stored: null };
	if (shared.length === 1) return { ends: shared, state: 'single', stored };
	if (below !== null && below.length === 1 && shared.includes(below[0])) {
		return { ends: [below[0]], state: 'decided', stored };
	}
	if (stored !== null) return { ends: [stored], state: 'chosen', stored };
	return { ends: shared, state: 'open', stored: null };
}

/**
 * Whether an alternative with `candidate` ends fits a slot that ends in
 * `slotEnds` (its effective end) and whose main figure ends in `mainEnds`.
 * One end fixed: the alternative must be able to end there (one with no ends
 * can). Otherwise the old rule: the same ends as the main figure.
 */
export function endFits(
	candidate: number[],
	slotEnds: number[] | null,
	mainEnds: number[]
): boolean {
	if (slotEnds !== null && slotEnds.length === 1) {
		return candidate.length === 0 || candidate.includes(slotEnds[0]);
	}
	return sameSet(candidate, mainEnds);
}

export interface EndChoice {
	/** The end, canonical. */
	id: number;
	/** The first alternative that cannot end there: the choice is closed. */
	blockedBy: number | null;
	/** The slot below cannot start there: the choice is open, with a warning. */
	belowMisses: boolean;
}

/** The Where does it end? sheet's rows: the main figure's ends, in its order. */
export function endChoices(g: Graph, slot: OptionsSlot, below: number[] | null): EndChoice[] {
	const [main, ...alternatives] = slot.figureIds
		.map((id) => figureById(g, id))
		.filter((f) => f !== null);
	if (!main) return [];
	return [...new Set(main.ends)].map((id) => ({
		id,
		blockedBy: alternatives.find((f) => f.ends.length > 0 && !f.ends.includes(id))?.id ?? null,
		belowMisses: below !== null && below.length > 0 && !below.includes(id)
	}));
}
