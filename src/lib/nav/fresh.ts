/**
 * An open page keeping up with deploys: when a navigation becomes a full page
 * load, and when the page may reload by itself. PURE; `fresh.svelte.ts` holds
 * the live counter and the root layout wires both to the router.
 */
import { BUSY_ROUTES } from '$lib/app-update/view';

/** What a reload or a full load would cut short. */
export interface Quiet {
	/** The full-screen player holds history entries of its own. */
	playerOpen: boolean;
	/** A sheet holds history entries of its own. */
	sheetsOpen: boolean;
	/** Things a reload would lose (`unsaved(null, true)`: an upload in flight counts). */
	unsaved: number;
	/** Holds taken with `holdReload` (an upload, a practice run). */
	held: number;
}

function quiet(s: Quiet): boolean {
	return !s.playerOpen && !s.sheetsOpen && s.unsaved === 0 && s.held === 0;
}

const FULL_LOAD_TYPES = new Set(['link', 'goto', 'form']);

/**
 * Whether this navigation should become a full page load: a new version is
 * out and the app is going to a different page anyway, so loading it whole
 * looks like any page change.
 *
 * Never a popstate (a sheet's Back, the player stepping up, Back to another
 * page all replay history and must stay in the app), never while the
 * unsaved-changes guard is asking, never offline (the offline screen takes
 * that one), and never while the page holds something the unload would cut
 * short: the guard would ask the browser's own question about it, and a
 * sheet's or the player's Back, let go by the cancelled navigation, would
 * race the load. The navigation then goes on inside the app, and the next
 * one gets its turn.
 */
export function fullLoadFor(
	nav: { type: string; willUnload: boolean; fromPath: string; toPath: string | null },
	s: { updated: boolean; asking: boolean; online: boolean } & Quiet
): boolean {
	if (!s.updated || s.asking || !s.online || !quiet(s)) return false;
	if (nav.willUnload || !FULL_LOAD_TYPES.has(nav.type)) return false;
	return nav.toPath !== null && nav.toPath !== nav.fromPath;
}

/**
 * Whether the page may reload by itself now (it has just become visible with
 * a new version out): never on Practice or My count, never over the player, a
 * sheet, unsaved work or a hold. Otherwise the Reload bar waits for the user.
 */
export function mayReloadNow(s: { routeId: string | null } & Quiet): boolean {
	if (s.routeId !== null && (BUSY_ROUTES as readonly string[]).includes(s.routeId)) return false;
	return quiet(s);
}
