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

import { SEGMENT_ROUTE, segmentOf, type MovesSegment } from '$lib/moves/segment';

export type Skeleton =
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
 * Long enough that a preloaded page (the load starts on touchstart) lands
 * without a grey flash, short enough that a slow one never looks frozen.
 */
export const SKELETON_DELAY_MS = 100;

const LISTS: Record<string, string> = {
	'/[dance]/lessons': 'Lessons',
	'/[dance]/songs': 'Music',
	'/[dance]/coverage': 'Coverage',
	'/[dance]/positions/none': 'No position',
	'/settings': 'Settings',
	'/voice': 'My count'
};

const DETAILS = new Set([
	'/[dance]/lessons/[id]',
	'/[dance]/songs/[id]',
	'/[dance]/exercises/[id]',
	'/[dance]/player',
	'/[dance]/positions/[id]',
	'/[dance]/positions/map'
]);

/**
 * The skeleton for a destination, by its route id (`navigating.to.route.id`).
 * Null for pages outside the shell (login, pairing, share), for `/` (a
 * redirect), and for an unknown route — those get the bar alone.
 */
export function skeletonFor(routeId: string | null | undefined): Skeleton | null {
	if (!routeId) return null;
	if (routeId === '/[dance]') return { kind: 'today' };
	// Only a segment's own list draws the Moves band; the pages under Positions have their own.
	const segment = segmentOf(routeId);
	if (segment && SEGMENT_ROUTE[segment] === routeId) return { kind: 'moves', segment };
	const title = LISTS[routeId];
	if (title) return { kind: 'list', title };
	if (routeId === '/[dance]/figures/[id]') return { kind: 'figure' };
	if (routeId === '/[dance]/routines/[id]') return { kind: 'routine' };
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
