import { listOf, type ListId } from './pane';

/**
 * Which Moves list sits beside an item, and which of its rows is lit. PURE.
 * `listOf` (pane.ts) names a route's own list; this is what the column shows,
 * which can differ: a figure opened from a routine keeps the routines beside it.
 */

export type MovesList = Extract<ListId, 'figures' | 'routines' | 'positions'>;

export type OpenRow =
	| { kind: 'figure' | 'move' | 'routine' | 'position'; id: number }
	| { kind: 'coverage' }
	| { kind: 'no-position' }
	| { kind: 'map' }
	| null;

const BASE = '/[dance]/(moves)/';

/** The id after `/<dance>/<segment>/` in `path`, when the whole path is exactly that. */
function idIn(path: string | null, segment: string): number | null {
	if (path === null) return null;
	const m = new RegExp(`^/[^/]+/${segment}/(\\d+)$`).exec(path);
	return m ? Number(m[1]) : null;
}

export function besideOf(
	routeId: string | null,
	path: string,
	opener: string | null
): { list: MovesList; open: OpenRow } | null {
	if (routeId === null || !routeId.startsWith(BASE)) return null;
	const own = (segment: string) => idIn(path, segment);
	switch (routeId.slice(BASE.length)) {
		case 'figures':
			return { list: 'figures', open: null };
		case 'figures/[id]': {
			const figure = own('figures');
			const routine = idIn(opener, 'routines');
			if (routine !== null) return { list: 'routines', open: { kind: 'routine', id: routine } };
			return { list: 'figures', open: figure === null ? null : { kind: 'figure', id: figure } };
		}
		case 'moves/[id]': {
			const id = own('moves');
			return { list: 'figures', open: id === null ? null : { kind: 'move', id } };
		}
		case 'coverage':
			return { list: 'figures', open: { kind: 'coverage' } };
		case 'routines':
			return { list: 'routines', open: null };
		case 'routines/[id]': {
			const id = own('routines');
			return { list: 'routines', open: id === null ? null : { kind: 'routine', id } };
		}
		case 'positions':
			return { list: 'positions', open: null };
		case 'positions/map':
			return { list: 'positions', open: { kind: 'map' } };
		case 'positions/none':
			return { list: 'positions', open: { kind: 'no-position' } };
		case 'positions/[id]': {
			const figure = idIn(opener, 'figures');
			if (figure !== null) return { list: 'figures', open: { kind: 'figure', id: figure } };
			const id = own('positions');
			return { list: 'positions', open: id === null ? null : { kind: 'position', id } };
		}
		default:
			return null;
	}
}

/**
 * The list in the column beside a route: the Moves column `besideOf` chooses,
 * else the route's own list (`listOf`); null for a page with no list beside it.
 * The skeleton keys on it, so an item opened inside the same column covers only the pane.
 */
export function columnOf(
	routeId: string | null,
	path: string,
	opener: string | null
): ListId | null {
	return besideOf(routeId, path, opener)?.list ?? listOf(routeId)?.list ?? null;
}
