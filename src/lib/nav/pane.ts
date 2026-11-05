import type { DanceSlug } from '$lib/dances/dances';

/**
 * A list and the item beside it (desktop spec, "A list and the item beside it
 * (2A)"). PURE. Which list a route belongs to, and whether the pane's header
 * starts with a back.
 */

/** The lists that sit beside their item. Later plans add Today, Moves, Lessons and Groups. */
export type ListId = 'songs' | 'figures' | 'routines' | 'positions';

/** Route id → its list, and whether that route opens an item beside it. */
const ROUTES: Record<string, { list: ListId; open: boolean }> = {
	'/[dance]/songs': { list: 'songs', open: false },
	'/[dance]/songs/[id]': { list: 'songs', open: true },
	'/[dance]/(moves)/figures': { list: 'figures', open: false },
	'/[dance]/(moves)/figures/[id]': { list: 'figures', open: true },
	'/[dance]/(moves)/moves/[id]': { list: 'figures', open: true },
	'/[dance]/(moves)/coverage': { list: 'figures', open: true },
	'/[dance]/(moves)/routines': { list: 'routines', open: false },
	'/[dance]/(moves)/routines/[id]': { list: 'routines', open: true },
	'/[dance]/(moves)/positions': { list: 'positions', open: false },
	'/[dance]/(moves)/positions/[id]': { list: 'positions', open: true },
	'/[dance]/(moves)/positions/none': { list: 'positions', open: true },
	'/[dance]/(moves)/positions/map': { list: 'positions', open: true }
};

/**
 * Each list's home, after `/${dance}`: `root` is the list page itself, `items`
 * the prefix its items live under (by whole segment). Today's root is the
 * dance itself, so only its items prefix counts as "in" it.
 */
export const LIST_HOME: Record<ListId, { root: string; items: string }> = {
	songs: { root: '/songs', items: '/songs' },
	figures: { root: '/figures', items: '/figures' },
	routines: { root: '/routines', items: '/routines' },
	positions: { root: '/positions', items: '/positions' }
};

/**
 * The list a route belongs to, and whether an item is open beside it. Null for
 * a page of its own (a song's grid, Settings) and for a list not yet in a pane.
 */
export function listOf(
	routeId: string | null
): { list: ListId; open: boolean; under?: true } | null {
	if (routeId === null) return null;
	const hit = ROUTES[routeId];
	return hit ? { ...hit } : null;
}

/** `path` is the list's root, or a page under it (by whole segments: `/salsa/songsx` is not). */
export function inList(path: string, list: ListId, dance: DanceSlug): boolean {
	const home = LIST_HOME[list];
	return path === `/${dance}${home.root}` || path.startsWith(`/${dance}${home.items}/`);
}

/**
 * Whether the pane's header starts with ‹. An item opened from its own list has
 * none: the list is beside it, and another of its items open beside the list
 * counts as the list. Opened from anywhere else, it goes back there (the trail).
 * `under` (a page under an item) always has one. No opener (a reload, a direct link) shows the list beside it: no back.
 */
export function paneBack(
	opener: string | null,
	list: ListId,
	dance: DanceSlug,
	under = false
): boolean {
	return under || (opener !== null && !inList(opener, list, dance));
}
