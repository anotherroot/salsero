/**
 * What the shell shows while a navigation waits for its data. PURE — the
 * root layout (`src/routes/+layout.svelte`) feeds it `navigating` from
 * `$app/state`.
 *
 * Every page has a server `load`, and SvelteKit keeps the old page up until
 * that load answers, so a tap used to change nothing on screen for a round
 * trip. Now the destination's tab lights at once, a bar runs along the top,
 * and — once the wait outlasts `SKELETON_DELAY_MS` — a skeleton shaped like
 * the destination covers the old page. See "Pending navigation" in the design
 * spec.
 */

import { listOf, type ListId } from '$lib/nav/pane';
import { SEGMENT_ROUTE, segmentOf, type MovesSegment } from '$lib/moves/segment';

type Shape =
	| { kind: 'today' }
	| { kind: 'list'; title: string }
	| { kind: 'detail' }
	/** A figure's page: the compact band, the facts card, then its lists. */
	| { kind: 'figure' }
	/** A routine's page: the band, the Practise hero, the facts, then the slot cards. */
	| { kind: 'routine' }
	/** Figures, Routines and Positions: the band with its segmented switch, then that segment's list. */
	| { kind: 'moves'; segment: MovesSegment };

/**
 * What a destination draws: its shape, and what the desktop adds. `pane`: it is a
 * list with its item beside it (`listOf`), `open` an item opens in it. `deskTitle`:
 * the band row's title when the list names it; null draws a bone. Plans add fields.
 */
export type Skeleton = Shape & {
	pane: boolean;
	open: boolean;
	deskTitle: string | null;
	/** The list beside the pane (`listOf`), or null where the page is one column. */
	list: ListId | null;
};

/**
 * Long enough that a preloaded page (the load starts on touchstart) lands
 * without a grey flash, short enough that a slow one never looks frozen.
 */
export const SKELETON_DELAY_MS = 100;

const LISTS: Record<string, string> = {
	'/[dance]/lessons': 'Lessons',
	'/[dance]/songs': 'Music',
	'/[dance]/(moves)/coverage': 'Coverage',
	'/[dance]/(moves)/positions/none': 'No position',
	'/settings': 'Settings',
	'/voice': 'My count'
};

/** The band row's title over a list and its pane. */
const PANE_TITLE: Record<ListId, string> = {
	today: 'Today',
	songs: 'Music',
	figures: 'Moves',
	routines: 'Moves',
	positions: 'Moves'
};

const DETAILS = new Set([
	'/[dance]/lessons/[id]',
	'/[dance]/songs/[id]',
	'/[dance]/(today)/exercises/[id]',
	'/[dance]/player',
	'/[dance]/(moves)/positions/[id]',
	'/[dance]/(moves)/positions/map'
]);

/**
 * The skeleton for a destination, by its route id (`navigating.to.route.id`).
 * Null for pages outside the shell (login, pairing, share), for `/` (a
 * redirect), and for an unknown route — those get the bar alone.
 *
 * `search` is the destination's query string: Today with `day=` in it is a past
 * day, one column with no list beside it. Optional, so a call without it reads as
 * today.
 */
export function skeletonFor(
	routeId: string | null | undefined,
	search: string = ''
): Skeleton | null {
	const shape = shapeFor(routeId);
	if (!shape) return null;
	const pastDay = routeId === '/[dance]/(today)' && new URLSearchParams(search).has('day');
	const l = pastDay ? null : listOf(routeId ?? null);
	return {
		...shape,
		pane: l !== null,
		open: l?.open ?? false,
		list: l?.list ?? null,
		deskTitle: l
			? PANE_TITLE[l.list]
			: shape.kind === 'today'
				? 'Today'
				: shape.kind === 'moves'
					? 'Moves'
					: shape.kind === 'list'
						? shape.title
						: null
	};
}

function shapeFor(routeId: string | null | undefined): Shape | null {
	if (!routeId) return null;
	if (routeId === '/[dance]/(today)') return { kind: 'today' };
	// Only a segment's own list draws the Moves band; the pages under Positions have their own.
	const segment = segmentOf(routeId);
	if (segment && SEGMENT_ROUTE[segment] === routeId) return { kind: 'moves', segment };
	const title = LISTS[routeId];
	if (title) return { kind: 'list', title };
	if (routeId === '/[dance]/(moves)/figures/[id]') return { kind: 'figure' };
	if (routeId === '/[dance]/(moves)/routines/[id]') return { kind: 'routine' };
	if (DETAILS.has(routeId)) return { kind: 'detail' };
	return null;
}

/**
 * Whether a navigation leaves the page, rather than re-filtering it: only a
 * new path gets a skeleton. A search on Figures or a step to another day on
 * Today keeps its page in view (the bar still runs), so the input you typed
 * in does not vanish under a skeleton.
 */
export function leavesPage(from: string, to: string): boolean {
	return from !== to;
}

/**
 * What the desktop draws for a skeleton, by where the navigation comes from.
 * Inside a list and pane, from one item to another (or back to the list), the
 * list column is live and stays: only the pane is covered ('pane'), and going to
 * the empty pane has nothing to cover ('none'). From anywhere else the whole
 * frame is drawn ('frame'). The phone draws the same skeleton whatever this says.
 *
 * "Same list" is the column actually beside each end (`toColumn`, `fromColumn`:
 * `columnOf`), which in Moves is not always the route's own: a figure opened
 * from routine 5 keeps the Routines column. Without them, each route's own list.
 */
export type DeskSkeleton = 'frame' | 'pane' | 'none';

export function deskSkeletonMode(
	toRouteId: string | null | undefined,
	fromRouteId: string | null | undefined,
	toColumn?: ListId | null,
	fromColumn?: ListId | null
): DeskSkeleton {
	const to = listOf(toRouteId ?? null);
	const from = listOf(fromRouteId ?? null);
	if (!to || !from) return 'frame';
	const a = toColumn === undefined ? to.list : toColumn;
	const b = fromColumn === undefined ? from.list : fromColumn;
	if (a === null || a !== b) return 'frame';
	return to.open ? 'pane' : 'none';
}
