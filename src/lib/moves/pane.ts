import type { IconName } from '$lib/icons/icons';

/**
 * The Moves pane with nothing open (desktop: beside the Figures or Routines
 * list), and keeping the lit row in view in its column. PURE, client-safe.
 */

export const EMPTY_PANE = {
	figures: {
		icon: 'moves',
		title: 'Pick a figure',
		body: 'Its timing, recordings and routines open here, beside the list. A move’s name opens the move.',
		group: 'The group’s figures open here.',
		action: 'New move'
	},
	routines: {
		icon: 'routine',
		title: 'Pick a routine',
		body: 'Its slots, where it breaks and whether it loops open here, beside the list.',
		group:
			'Sketch a routine first, link it from a lesson later. The editor is the same as for your own.',
		action: 'New routine'
	}
} as const satisfies Record<
	'figures' | 'routines',
	{ icon: IconName; title: string; body: string; group: string; action: string }
>;

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
