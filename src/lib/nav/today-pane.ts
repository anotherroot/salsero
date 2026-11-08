import { resolve } from '$app/paths';
import type { DanceSlug } from '$lib/dances/dances';
import { t } from '$lib/i18n/catalog';
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

/** Today's list as a back's fallback: where a save goes back to when nothing opened the page. */
export function todayBack(dance: DanceSlug): { href: string; label: string } {
	return {
		href: resolve('/[dance]/(today)', { dance }),
		label: t().shell.backTo(t().shell.tabs.today)
	};
}
