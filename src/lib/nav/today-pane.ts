import type { ListId } from './pane';

/**
 * Which Today list sits beside an item. PURE. `listOf` (pane.ts) names a
 * route's own list; an exercise opened from Coming up keeps Coming up beside
 * it, as a figure opened from a routine keeps the routines (moves-pane.ts).
 * Null: nothing special, the route's own list.
 */
export function besideToday(
	routeId: string | null,
	path: string,
	opener: string | null
): Extract<ListId, 'coming'> | null {
	if (routeId === '/[dance]/(today)/coming-up') return 'coming';
	if (routeId === '/[dance]/(today)/exercises/[id]' && opener !== null) {
		const dance = path.split('/')[1];
		if (opener === `/${dance}/coming-up`) return 'coming';
	}
	return null;
}
