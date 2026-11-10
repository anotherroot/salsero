/**
 * An open page keeping up with deploys: when a navigation becomes a full page
 * load, and when the page may reload by itself. PURE; `fresh.svelte.ts` holds
 * the live counter and the root layout wires both to the router.
 */
import { BUSY_ROUTES } from '$lib/app-update/view';
import { t } from '$lib/i18n/catalog';
import type { Locale } from '$lib/i18n/locale';

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

/** A form field as the page sees it now (`tag` and `type` lower case). */
export interface FieldState {
	tag: string;
	type: string;
	focused: boolean;
	value: string;
	defaultValue: string;
}

const NOT_TYPED = new Set([
	'hidden',
	'checkbox',
	'radio',
	'submit',
	'button',
	'reset',
	'file',
	'range',
	'color',
	'image'
]);

/**
 * Fields someone is typing in: one with focus, or one whose value is not what
 * the page drew (typed or autofilled). Counted with the unsaved work, so a
 * page never reloads by itself under someone signing in — the login and join
 * forms are not tracked by the unsaved guard, and an autofill popup is enough
 * to send the page out of view and back.
 */
export function typedFields(fields: FieldState[]): number {
	return fields.filter(
		(f) =>
			(f.tag === 'textarea' || (f.tag === 'input' && !NOT_TYPED.has(f.type))) &&
			(f.focused || f.value !== f.defaultValue)
	).length;
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
 * unsaved-changes guard is asking, never offline (the layout stops it and says
 * so), and never while the page holds something the unload would cut
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

/**
 * Whether the page draws in another language than its data names: the client
 * set its language once, at the first load (`setClientLocale`), and a sign-in
 * or an admin's change since has not reached it. A page whose data names none
 * is never stale.
 */
export function localeStale(drawn: Locale, wanted: Locale | undefined): boolean {
	return wanted !== undefined && drawn !== wanted;
}

/**
 * Whether the page should reload by itself to draw in its data's language:
 * stale, and only when a reload would cut nothing short (`mayReloadNow`: not
 * on Practice or My count, not over the player, a sheet, unsaved work or a
 * hold). Otherwise the next navigation to another page loads it whole.
 */
export function needsLocaleReload(
	s: { drawn: Locale; wanted: Locale | undefined; routeId: string | null } & Quiet
): boolean {
	return localeStale(s.drawn, s.wanted) && mayReloadNow(s);
}

/* ── The new-version toast (merge sheets and update bubbles spec, 4C) ───── */

export const reloadTitle = (): string => t().shell.reload.title;
export const staleTitle = (): string => t().shell.reload.staleTitle;
export const staleLine = (): string => t().shell.reload.staleLine;

/**
 * The toast's second line: what kept the page from reloading by itself, the
 * unsaved first. A held page loads the new version on its next page change or
 * when it comes back into view, never the moment the hold ends, so the words
 * say "kept", not "reloads when you're done".
 */
export function reloadWhy(q: Quiet): string {
	const w = t().shell.reload;
	if (q.unsaved > 0) return w.unsaved;
	if (q.held > 0) return w.held;
	if (q.playerOpen || q.sheetsOpen) return w.open;
	return w.next;
}
