/**
 * PURE: the group view's address (group view spec, 2026-11-09). A list in a
 * group's view carries the group in its URL, `?in=<team id>`; a page of one
 * thing decides by its row instead. The server re-checks `in` on every request
 * (`$lib/server/group-mode`), so this module only reads and writes it.
 */
import type { DanceSlug } from '$lib/dances/dances';

export const VIEW_PARAM = 'in';

/** The `in` value when it is a team id, else null (a bad one is no view, never an error). */
export function viewParam(search: URLSearchParams): number | null {
	const raw = search.get(VIEW_PARAM);
	return raw !== null && /^[1-9][0-9]{0,9}$/.test(raw) ? Number(raw) : null;
}

/**
 * `href` with `in` set to `teamId`, or without it for null. Every other parameter
 * and the hash stay; a form action's key (`?/create`) stays first, where
 * SvelteKit looks for it.
 */
export function withView(href: string, teamId: number | null): string {
	const hashAt = href.indexOf('#');
	const hash = hashAt === -1 ? '' : href.slice(hashAt);
	const rest = hashAt === -1 ? href : href.slice(0, hashAt);
	const queryAt = rest.indexOf('?');
	const path = queryAt === -1 ? rest : rest.slice(0, queryAt);
	const parts = queryAt === -1 ? [] : rest.slice(queryAt + 1).split('&');
	const kept = parts.filter((p) => p !== '' && p.split('=')[0] !== VIEW_PARAM);
	if (teamId !== null) kept.push(`${VIEW_PARAM}=${teamId}`);
	return kept.length === 0 ? path + hash : `${path}?${kept.join('&')}${hash}`;
}

/** The kind of row a page of one thing shows; `group` is a group's own pages. */
export type RowKind =
	'lesson' | 'figure' | 'routine' | 'position' | 'move' | 'song' | 'drill' | 'group' | 'import';

const ROW_ROUTES: Record<string, RowKind> = {
	'/[dance]/lessons/[id]': 'lesson',
	'/[dance]/(moves)/figures/[id]': 'figure',
	'/[dance]/(moves)/routines/[id]': 'routine',
	'/[dance]/(moves)/positions/[id]': 'position',
	'/[dance]/(moves)/moves/[id]': 'move',
	'/[dance]/songs/[id]': 'song',
	'/[dance]/(today)/exercises/[id]': 'drill',
	// A playlist's pick list adds into the list's own space.
	'/[dance]/songs/imports/[id]': 'import'
};

/** Which row a route shows, by its SvelteKit route id; null for lists and the rest. */
export function rowKindOf(routeId: string | null): RowKind | null {
	if (routeId === null) return null;
	if (routeId === '/[dance]/groups/[id]' || routeId.startsWith('/[dance]/groups/[id]/'))
		return 'group';
	return ROW_ROUTES[routeId] ?? null;
}

const VIEWED = /^\/(figures|routines|positions(\/(map|none))?|coverage|lessons|songs)$/;

/** Whether `path` is a list whose content follows the view (it keeps `in`). */
export function viewedList(path: string, dance: DanceSlug): boolean {
	const prefix = `/${dance}`;
	return path.startsWith(`${prefix}/`) && VIEWED.test(path.slice(prefix.length));
}

/**
 * A tab's target (`tabHref`, from the trail) in the current view: a viewed list
 * takes `view`, whatever `in` it was left with; any other page drops `in` (a page
 * of one thing decides by its row). Null (the lit tab on its own list) stays null.
 */
export function tabHrefIn(
	href: string | null,
	dance: DanceSlug,
	view: number | null
): string | null {
	if (href === null) return null;
	const path = href.split(/[?#]/)[0];
	return withView(href, viewedList(path, dance) ? view : null);
}
