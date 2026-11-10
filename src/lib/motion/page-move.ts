/**
 * Page changes on the phone (spec 2026-11-10-page-transitions-design.md): the
 * card lifts on the tap, holds empty while the page loads, and lands where the
 * new page's band ends. PURE: where the card's edge is, where it waits, and
 * which move a navigation gets. The runtime is `page-move.svelte.ts`.
 */
import { frameOf } from '$lib/nav/frame';

/** The spec's values: px and ms. */
export const PAGE_MOVE = {
	lift: 70,
	up: 200,
	wordsOut: 130,
	dotsAfter: 500,
	stillAfter: 8000,
	down: 320,
	wordsIn: 240,
	wordsInDelay: 60,
	corners: 260,
	quietOut: 120,
	screenFade: 200,
	dotsBelow: 46
} as const;

/** Where the card's top shows on screen, and whether it is square (run on under the slim band). */
export type Edge = { y: number; square: boolean };

/**
 * The card's own top while it shows; the slim band's foot when it runs on
 * under it (scrolled down), where its corners are hidden: square.
 */
export function visibleEdge(cardTop: number, slimFoot: number | null): Edge {
	if (slimFoot !== null && cardTop < slimFoot) return { y: slimFoot, square: true };
	return { y: cardTop, square: false };
}

/** Where the lifted card waits: up to `lift` above its edge, never above the slim band, never lower. */
export function heldEdge(
	edge: number,
	slimFoot: number | null,
	lift: number = PAGE_MOVE.lift
): number {
	return Math.min(edge, Math.max(slimFoot ?? -Infinity, edge - lift));
}

/** A page with the band and the card; a full-screen one (no card); a frame page (sign-in, welcome). */
export type PageShape = 'card' | 'screen' | 'frame';

const SCREEN = new Set(['/[dance]/player', '/[dance]/(moves)/positions/map']);

export function shapeOf(routeId: string | null): PageShape {
	if (routeId !== null && SCREEN.has(routeId)) return 'screen';
	const frame = frameOf(routeId, true);
	return frame === 'card' || frame === 'none' ? 'frame' : 'card';
}

/** The card lifts; only the words change (a step inside one page); nothing moves. */
export type MoveKind = 'lift' | 'words' | 'none';

type Place = { routeId: string | null; path: string };

export function moveKind(from: Place, to: Place, o: { desk: boolean; inPage: boolean }): MoveKind {
	if (o.desk) return 'none';
	if (shapeOf(from.routeId) === 'frame' || shapeOf(to.routeId) === 'frame') return 'none';
	// A filter or a search: the lists fold (round 1), the card stays.
	if (from.path === to.path) return 'none';
	return o.inPage ? 'words' : 'lift';
}

/** The card's edge as drawn mid-move: its top plus the transform running on it. */
export function drawnEdge(top: number, transformY: number): number {
	return top + transformY;
}
