/**
 * View shapes for the routine editor's components. The page builds them from
 * its data; the components only draw them — so no component has to know about
 * graph ids, seams indexed by server rows, or optimistic overlays.
 */
import type { Side } from '$lib/gestures/swipe';
import type { ResolvedPathname } from '$app/types';

export interface AltView {
	id: number;
	label: string;
	/** "1→1". Empty for an archived figure. */
	timing: string;
	/** A `resolve()` result, not a bare string — see `RowView.href`. */
	href: ResolvedPathname;
}

export interface RowView {
	/** The slot's id. */
	id: number;
	/** The main figure's label, or the embedded routine's name. */
	title: string;
	/** "1→1 · Closed → Open". Empty when nothing in the slot is danceable. */
	meta: string;
	note: string | null;
	/** Where swiping right or "Open →" goes; null when there is nothing to open.
	 *  A `resolve()` result, not a bare string — `<a href>` needs that to pass
	 *  `svelte/no-navigation-without-resolve` without re-resolving here. */
	href: ResolvedPathname | null;
	isRoutine: boolean;
	/** Every option but the main figure, in the order they were added. */
	alternatives: AltView[];
	canAddAlternative: boolean;
	/** A refusal aimed at this slot. */
	failure: string | null;
	/** What does not connect between this row and the next danceable one; null when it does. */
	seam: { label: string; next: number } | null;
}

/** The one card swiped open on the page, by key: `slot:<id>` or `alt:<stepId>:<figureId>`. */
export type Swiped = { key: string; side: Side } | null;
