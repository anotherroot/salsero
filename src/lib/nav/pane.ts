import type { DanceSlug } from '$lib/dances/dances';

/**
 * A list and the item beside it (desktop spec, "A list and the item beside it
 * (2A)"). PURE. Which list a route belongs to, and whether the pane's header
 * starts with a back.
 */

/** The lists that sit beside their item. Later plans add Today, Moves, Lessons and Groups. */
export type ListId = 'songs';

/** Route id → its list, and whether that route opens an item beside it. */
const ROUTES: Record<string, { list: ListId; open: boolean }> = {
	'/[dance]/songs': { list: 'songs', open: false },
	'/[dance]/songs/[id]': { list: 'songs', open: true }
};

/** Each list's root, after `/${dance}`: the list page itself, and what is under it. */
const ROOT: Record<ListId, string> = {
	songs: '/songs'
};

/**
 * The list a route belongs to, and whether an item is open beside it. Null for
 * a page of its own (a song's grid, Settings) and for a list not yet in a pane.
 */
export function listOf(routeId: string | null): { list: ListId; open: boolean } | null {
	if (routeId === null) return null;
	const hit = ROUTES[routeId];
	return hit ? { ...hit } : null;
}

/** `path` is the list's root, or a page under it (by whole segments: `/salsa/songsx` is not). */
function inList(path: string, list: ListId, dance: DanceSlug): boolean {
	const root = `/${dance}${ROOT[list]}`;
	return path === root || path.startsWith(`${root}/`);
}

/**
 * Whether the pane's header starts with ‹. An item opened from its own list has
 * none: the list is beside it, and another of its items open beside the list
 * counts as the list. Opened from anywhere else, it goes back there (the trail).
 * No opener (a reload, a direct link) shows the list beside it: no back.
 */
export function paneBack(opener: string | null, list: ListId, dance: DanceSlug): boolean {
	return opener !== null && !inList(opener, list, dance);
}
