import type { IconName } from '$lib/icons/icons';
import { t } from '$lib/i18n/catalog';

/**
 * The Moves pane with nothing open (desktop: beside the Figures or Routines
 * list), and keeping the lit row in view in its column. PURE, client-safe.
 */

type PaneWords = { icon: IconName; title: string; body: string; group: string; action: string };

/** The pane's words per list, read at call time (getters): the reader's language. */
export const EMPTY_PANE: Record<'figures' | 'routines', PaneWords> = {
	figures: {
		icon: 'moves',
		get title() {
			return t().moves.pane.figures.title;
		},
		get body() {
			return t().moves.pane.figures.body;
		},
		get group() {
			return t().moves.pane.figures.group;
		},
		get action() {
			return t().moves.newMove;
		}
	},
	routines: {
		icon: 'routine',
		get title() {
			return t().moves.pane.routines.title;
		},
		get body() {
			return t().moves.pane.routines.body;
		},
		get group() {
			return t().moves.pane.routines.group;
		},
		get action() {
			return t().moves.newRoutine;
		}
	}
};

/** What the empty pane says; in group mode the group's words, and Figures has no button. */
export function emptyPane(
	list: 'figures' | 'routines',
	groupMode: boolean
): { icon: IconName; title: string; body: string; action: string | null } {
	const p = EMPTY_PANE[list];
	return {
		icon: p.icon,
		title: p.title,
		body: groupMode ? p.group : p.body,
		action: groupMode && list === 'figures' ? null : p.action
	};
}

type Span = { top: number; bottom: number };

/**
 * The list column's `scrollTop` that brings `row` into view with `margin` to
 * spare, or null when it is in view already. Rects are the viewport's
 * (`getBoundingClientRect`). A row taller than the column shows its top.
 */
export function revealTop(
	column: Span,
	row: Span,
	scrollTop: number,
	margin: number
): number | null {
	const top = column.top + margin;
	const bottom = column.bottom - margin;
	if (row.top < top) return scrollTop - (top - row.top);
	if (row.bottom > bottom) {
		const down = scrollTop + (row.bottom - bottom);
		// Never past the row's own top.
		return Math.min(down, scrollTop + (row.top - top));
	}
	return null;
}
