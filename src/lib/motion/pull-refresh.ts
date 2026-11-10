/*
 * Pull down to refresh (device first, look C, picked 2026-11-10): the page
 * under the band slides down with the finger, and the band's colour fills the
 * gap with words only. PURE: the numbers and the gesture's decisions;
 * `PullRefresh.svelte` draws it.
 */

/** How far the sheet can travel, in px. */
export const PULL_MAX = 120;
/** The resistance: the larger, the more the sheet follows the finger. */
export const PULL_K = 170;
/** Past this the release syncs ("Let go to sync"). */
export const PULL_TRIGGER = 68;
/** The sheet stays this far open while it syncs. */
export const PULL_HOLD = 52;
/** "Up to date" shows this long before the sheet springs back. */
export const DONE_MS = 700;
/** "Offline" shows this long. */
export const OFFLINE_MS = 1000;
/** The spring back. */
export const SPRING_MS = 320;
/** A finger must move this far before the gesture is decided (pull, scroll or swipe). */
export const DECIDE_PX = 8;

/** The sheet's travel for a finger moved `raw` px down: resisted, never past `PULL_MAX`. */
export function pullDistance(raw: number): number {
	return PULL_MAX * (1 - Math.exp(-Math.max(0, raw) / PULL_K));
}

export type PullPhase = 'idle' | 'pull' | 'ready' | 'syncing' | 'done' | 'offline';

export function phaseWhilePulling(d: number): 'pull' | 'ready' {
	return d >= PULL_TRIGGER ? 'ready' : 'pull';
}

/**
 * Whether a finger's first decided move starts a pull: a touch, at the very
 * top of the page (the band fully open), moving down more than sideways (a
 * row's swipe is sideways), not inside a sheet, a dialog or the player.
 */
export function mayStart(a: {
	pointerType: string;
	scrollY: number;
	dx: number;
	dy: number;
	inside: boolean;
}): boolean {
	return (
		a.pointerType === 'touch' &&
		a.scrollY <= 0 &&
		!a.inside &&
		a.dy > 0 &&
		Math.abs(a.dy) > Math.abs(a.dx)
	);
}

/** Whether the sync left nothing behind, so "Up to date" is true (null: no device, a plain re-read). */
export function doneWord(
	summary: { waiting: number; refused: number; signedOut: boolean } | null
): boolean {
	return summary === null || (summary.waiting === 0 && summary.refused === 0 && !summary.signedOut);
}
