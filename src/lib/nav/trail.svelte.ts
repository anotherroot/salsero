import { tick } from 'svelte';
import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
import { page } from '$app/state';
import { danceInPath, type DanceSlug } from '$lib/dances/dances';
import { rootsOf, tabFor, type TabId } from './tabs';
import {
	arrivalKind,
	arrive,
	backMove,
	backTarget,
	EMPTY_TRAIL,
	forget,
	hrefOf,
	isTrailPage,
	leave,
	pageTitle,
	parseTrail,
	scrollFor,
	tabTarget,
	type Arrival,
	type Intent,
	type PageKey,
	type Trail
} from './trail';

export { backMove };

/*
 * The trail (`./trail.ts`) wired to the router: arrivals and leavings feed
 * it, the tab bar and the band's back read targets from it, and it lives in
 * `sessionStorage` so a reload keeps it. Nothing here runs at import: the
 * module is loaded on the server too.
 */

const STORAGE_KEY = 'nav-trail';

/*
 * SvelteKit's own key for the history slot index, set on every entry it
 * makes, shallow `pushState` ones included (`HISTORY_INDEX` in
 * @sveltejs/kit/src/runtime/client/constants.js). A fresh session starts it
 * at `Date.now()`, so indexes from before a reload never collide.
 */
const INDEX_KEY = 'sveltekit:history';

function historyIndex(): number {
	const i: unknown = history.state?.[INDEX_KEY];
	return typeof i === 'number' ? i : 0;
}

class TrailState {
	/** Replaced whole, never mutated: the pure functions return new trails. */
	value = $state.raw<Trail>(EMPTY_TRAIL);
}

/** Reactive: the current trail. Read it in components; write only through the functions here. */
export const trail = new TrailState();

let loaded = false;

/*
 * Read on the first navigation event rather than at init: the first paint
 * must match the server's (an empty trail), and Svelte does not repair an
 * `href` that differs while hydrating.
 */
function load(): void {
	if (loaded) return;
	loaded = true;
	try {
		trail.value = parseTrail(sessionStorage.getItem(STORAGE_KEY));
	} catch {
		// Blocked storage: nothing remembered.
	}
}

function set(t: Trail): void {
	trail.value = t;
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(t));
	} catch {
		// Blocked or full: the trail still works until the page goes.
	}
}

let intent: Intent = null;

/** The next navigation is a tab tap / a back. Cleared when it lands, or by the next link click. */
export function intend(i: Exclude<Intent, null>): void {
	intent = i;
}

/** Where a tab leads from `current`; null means "scroll the lit list to the top". */
export function tabHref(tab: TabId, dance: DanceSlug, current: string): string | null {
	const t = tabTarget(trail.value, tab, dance, current);
	return 'href' in t ? t.href : null;
}

/** The path with the search it was left with, if this session saw it. */
export function rememberedHref(path: string): string {
	return hrefOf(trail.value, path);
}

/** Where the band's back goes from `current`, and its label. */
export function backFor(
	current: string,
	fallback: { href: string; label: string }
): { href: string; label: string; key: PageKey | null } {
	return backTarget(trail.value, current, fallback);
}

/** True when the back has been taken by stepping history (the caller's link must not go too). */
export function backByHistory(key: PageKey | null): boolean {
	if (backMove(trail.value.entries, historyIndex(), key) !== 'history') return false;
	history.back();
	return true;
}

/** The band's back, from code: step history when the slot below is the target, else go there. */
export async function goBack(
	fallback: { href: string; label: string },
	opts: { replace?: boolean } = {}
): Promise<void> {
	const target = backFor(location.pathname, fallback);
	intend('back');
	if (backByHistory(target.key)) return;
	// eslint-disable-next-line svelte/no-navigation-without-resolve -- a trail href, built from resolved paths
	await goto(target.href, { replaceState: opts.replace ?? false });
}

/** Keep the trail in step with the router. Call once, from the root layout. */
export function syncTrail(): void {
	/** The slot the navigation in flight left (a sheet's shallow entry included). */
	let before: number | null = null;

	const leaveHere = () => {
		load();
		const path = page.url.pathname;
		if (isTrailPage(path)) set(leave(trail.value, path, window.scrollY));
	};

	// A tab or a back sets its intent in its onclick, after this capture-phase
	// clear: any other link click drops one a cancelled navigation left behind.
	$effect(() => {
		const onclick = (e: MouseEvent) => {
			if (e.target instanceof Element && e.target.closest('a[href]')) intent = null;
		};
		window.addEventListener('click', onclick, true);
		return () => window.removeEventListener('click', onclick, true);
	});

	// The app going to the background, or the tab closing: keep the scroll.
	$effect(() => {
		const onhide = () => leaveHere();
		const onvisibility = () => {
			if (document.visibilityState === 'hidden') leaveHere();
		};
		window.addEventListener('pagehide', onhide);
		document.addEventListener('visibilitychange', onvisibility);
		return () => {
			window.removeEventListener('pagehide', onhide);
			document.removeEventListener('visibilitychange', onvisibility);
		};
	});

	beforeNavigate((nav) => {
		load();
		// A popstate has already moved history: the slot it left is gone from view.
		before = nav.type === 'popstate' ? null : historyIndex();
		const from = nav.from?.url.pathname;
		if (from && isTrailPage(from)) set(leave(trail.value, from, window.scrollY));
	});

	afterNavigate(async (nav) => {
		load();
		const to = nav.to?.url;
		const index = historyIndex();
		const prevIndex = before;
		before = null;
		const it = intent;
		intent = null;
		if (!to || !isTrailPage(to.pathname)) return;
		const path = to.pathname;

		// A tab or a back reached a page that is gone: off the trail, onto the tab's list.
		if ((it === 'tab' || it === 'back') && page.status >= 400) {
			const dance = danceInPath(path)!;
			set(forget(trail.value, path));
			const root = rootsOf(tabFor(path, dance) ?? 'today', dance)[0];
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- a trail href, built from resolved paths
			void goto(hrefOf(trail.value, root), { replaceState: true });
			return;
		}

		// The page's <title> is in place once it has rendered.
		await tick();
		const a: Arrival = {
			to: path,
			search: to.search,
			title: pageTitle(document.title),
			from: nav.from?.url.pathname ?? null,
			index,
			prevIndex,
			kind: arrivalKind(nav.type, index, prevIndex),
			intent: it
		};
		set(arrive(trail.value, a));
		const y = scrollFor(trail.value, a);
		if (y !== null && !to.hash) window.scrollTo(0, y);
	});
}
