/**
 * View shapes for the routine editor's components. The page builds them from
 * its data; the components only draw them — so no component has to know about
 * graph ids, seams indexed by server rows, or optimistic overlays.
 */
import type { Side } from '$lib/gestures/swipe';
import type { ResolvedPathname } from '$app/types';
import type { IconName } from '$lib/icons/icons';

export interface AltView {
	id: number;
	label: string;
	/** A `resolve()` result, not a bare string — see `RowView.href`. */
	href: ResolvedPathname;
	/** The group's name when this option is a group's figure. */
	source: string | null;
	/** Its length in this slot when a routine sets it (spec 2026-11-11): the chip that opens How long?. */
	length: number | null;
}

export interface RowView {
	/** The slot's id. */
	id: number;
	/** The main figure's label, or the embedded routine's name. */
	title: string;
	/** The group's name when the main figure is a group's: the slot's source chip. */
	source: string | null;
	/** "1→1 · Closed → Open", led by "Routine · 3 slots" for a routine. Empty when nothing is danceable. */
	meta: string;
	/** No option and no child: the title says so, muted. */
	empty: boolean;
	/** The main figure's length in this slot when a routine sets it (spec 2026-11-11): its chip. */
	length: { figureId: number; n: number } | null;
	/**
	 * Where the slot ends (spec 2026-11-11, slot end): `chosen` and `open` draw a
	 * chip that opens the Where does it end? sheet, `single` and `decided` the
	 * name alone. Null: no positions, an embedded routine, an older page's data.
	 */
	end: { state: 'chosen' | 'open' | 'single' | 'decided'; name: string | null } | null;
	note: string | null;
	/** Where swiping right or "Open →" goes; null when there is nothing to open.
	 *  A `resolve()` result, not a bare string. */
	href: ResolvedPathname | null;
	isRoutine: boolean;
	/** Every option but the main figure, in the order they were added. */
	alternatives: AltView[];
	canAddAlternative: boolean;
	/** A refusal aimed at this slot. */
	failure: string | null;
	/**
	 * What does not connect between this row and the next danceable one; null
	 * when it does. `bridge`: something closes the gap in one step, so the seam
	 * offers to pick it.
	 */
	seam: { label: string; next: number; bridge: boolean } | null;
}

/**
 * Where a picker was opened from: building down from row `row`, up into it,
 * or closing the seam between it and row `next` in one step.
 */
export type PickFrom =
	{ row: number; side: 'after' | 'before' } | { row: number; side: 'between'; next: number };

/**
 * One cell of a lifted card's toolbar (spec 2026-11-11, routine lift): the
 * open slot's and the selection's. `why`: greyed, and a tap says this instead.
 */
export interface ToolItem {
	key: string;
	label: string;
	icon: IconName;
	/** The accessible name, when the label alone is too short to say it. */
	name?: string;
	why?: string | null;
	danger?: boolean;
	onclick: () => void;
}

/** The one card swiped open on the page, by key: `slot:<id>` or `alt:<stepId>:<figureId>`. */
export type Swiped = { key: string; side: Side } | null;
