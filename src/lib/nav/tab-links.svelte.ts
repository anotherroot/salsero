import type { DanceSlug } from '$lib/dances/dances';
import { TABS, tapKind } from './tabs';
import { intend, tabHref } from './trail.svelte';

/*
 * Where the tabs lead and what a tap on one does: shared by the phone's tab bar
 * (`BottomNav`) and the desktop's side (`Side`), so the two cannot drift.
 */

/**
 * Each tab's href from `path`, in `TABS` order. A tab reopens the last page seen
 * in it (`$lib/nav/trail.ts`); null is the lit tab on its own main list, which
 * has nowhere to go: its link keeps the list's href (long-press, new tab) and a
 * tap scrolls the list to the top.
 */
export function tabTargets(dance: DanceSlug, path: string): (string | null)[] {
	return TABS.map((t) => tabHref(t.id, dance, path));
}

/** A click on a tab's link; `scrollTop` when its target is null (above). */
export function tapTab(e: MouseEvent, scrollTop: boolean): void {
	const kind = tapKind(e, scrollTop);
	if (kind === 'pass') return;
	if (kind === 'tab') {
		intend('tab');
		return;
	}
	e.preventDefault();
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' });
}
