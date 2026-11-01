import {
	afterNavigate,
	beforeNavigate,
	goto,
	invalidateAll,
	onNavigate,
	pushState
} from '$app/navigation';
import { SheetStack } from './stack';

/*
 * The one SheetStack, wired to SvelteKit's shallow routing: each open sheet is
 * an entry whose `page.state.sheets` says how many sheets it holds.
 *
 * The depth is read from the history entry itself, not from `page.state`:
 * `invalidateAll()` (every `use:enhance` submit) resets `page.state` to {}
 * while the entry keeps its state, and after a reload a popstate is a full
 * navigation that sets `page.state` only once its data has loaded. The key is
 * SvelteKit's own; `stack.spec.ts` checks it is still the one it uses.
 */
const STATES_KEY = 'sveltekit:states';

/** The current history entry's shallow state (what `page.state` should say). */
export function entryState(): App.PageState {
	const s: unknown = history.state?.[STATES_KEY];
	return s && typeof s === 'object' ? (s as App.PageState) : {};
}

function entryDepth(): number {
	return entryState().sheets ?? 0;
}

export const sheetStack = new SheetStack({
	// Spread the entry's state so the video player's depth survives a sheet's push.
	push: (d) => pushState('', { ...entryState(), sheets: d }),
	go: (d) => history.go(d),
	// A task, not a microtask: `beforeNavigate` runs a few microtasks into a
	// `goto`, and a sheet closed just before one must see its hold.
	later: (fn) => setTimeout(fn, 0)
});

/**
 * Refresh the page's data once history has caught up with the sheets' own Back
 * moves, and not at all if the user has gone elsewhere meanwhile. A reload
 * started before a close's Back has landed is dropped by SvelteKit when the
 * popstate arrives, so every refresh that follows a sheet's or the player's
 * close goes through here. Resolves when the refresh is done (or skipped).
 */
export function refreshWhenSettled(): Promise<void> {
	const href = location.href;
	return new Promise((resolve) => {
		sheetStack.settled(() => {
			if (location.href === href) void invalidateAll().finally(resolve);
			else resolve();
		});
	});
}

/** The URL a form was submitted on while a sheet was open, until a close refreshes for it. */
let sentAt: string | null = null;

/**
 * Called when a Sheet or Dialog has really closed: if a form was sent from
 * the page while a sheet was open, its `update()` may have been dropped by the
 * close's Back, so refresh once history has settled.
 */
export function refreshIfSent(): void {
	if (sentAt === null) return;
	const at = sentAt;
	sentAt = null;
	if (at === location.href) void refreshWhenSettled();
}

/** An `act()` save posts without a <form>, so it marks itself as sent the same way. */
export function markSent(): void {
	if (sheetStack.openCount > 0) sentAt = location.href;
}

/** A link click's hold on the stack's Back moves (see `syncSheets`), until its navigation takes over. */
let clickRelease: (() => void) | null = null;
let clickTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * Let go of a link click's hold now: for a click the caller prevented that
 * goes nowhere (the current variation tapped in the switcher's list), so a
 * sheet it closes steps Back at once rather than after the fallback.
 */
export function releaseClick(): void {
	clearTimeout(clickTimer);
	clickRelease?.();
	clickRelease = null;
}

/**
 * Close-then-go: for a link or a form inside a sheet whose navigation must
 * REPLACE the page's own entry (a variation picked in the switcher's list).
 * The caller closes its sheets first; once history has stepped back over
 * their entries, this goes to `href`. The click's hold is let go at once (the
 * click was prevented: no navigation of its own follows), and a refresh owed
 * for a form sent from the sheet is dropped, since this navigation loads the
 * page's data itself and a refresh started after it would abort it.
 */
export function gotoWhenSettled(
	href: string,
	opts: Parameters<typeof goto>[1] = {},
	before?: () => void
): Promise<void> {
	releaseClick();
	sentAt = null;
	return new Promise((resolve, reject) => {
		sheetStack.settled(() => {
			before?.();
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller's href, already built
			goto(href, opts).then(resolve, reject);
		});
	});
}

/** Keep the stack in step with history. Call once, from the root layout. */
export function syncSheets(): void {
	$effect(() => {
		const onpop = () => sheetStack.sync(entryDepth());
		window.addEventListener('popstate', onpop);
		return () => window.removeEventListener('popstate', onpop);
	});
	// Mark a form sent while a sheet is open (see `refreshIfSent`).
	$effect(() => {
		const onsubmit = () => {
			if (sheetStack.openCount > 0) sentAt = location.href;
		};
		document.addEventListener('submit', onsubmit, true);
		return () => document.removeEventListener('submit', onsubmit, true);
	});
	/*
	 * A link click reaches `beforeNavigate` only a frame and a task later
	 * (SvelteKit lets the browser repaint first, with its own 100 ms fallback),
	 * and a link inside a sheet often closes the sheet in its onclick: the Back
	 * that close owes would go out first and abort the link's navigation. So
	 * the click itself takes a hold — in the capture phase, before any onclick —
	 * until that navigation's own hold takes over, or a fallback lets go when
	 * none follows (a prevented click, a hash link). Holding for a click that
	 * goes nowhere only delays a Back by the fallback.
	 */
	$effect(() => {
		const onclick = (e: MouseEvent) => {
			if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
			const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
			if (!a || a.hasAttribute('download')) return;
			const target = a.getAttribute('target');
			if (target && target !== '_self') return;
			if (a instanceof HTMLAnchorElement && a.origin !== location.origin) return;
			releaseClick();
			clickRelease = sheetStack.hold();
			clickTimer = setTimeout(releaseClick, 1000);
		};
		window.addEventListener('click', onclick, true);
		return () => {
			window.removeEventListener('click', onclick, true);
			releaseClick();
		};
	});
	// While a navigation of the page's own loads, a Back from the stack would
	// abort it (SvelteKit drops a navigation a popstate overtakes) or go over
	// its new entry: hold them until it lands, is cancelled (the unsaved guard)
	// or is aborted — `complete` settles on each.
	beforeNavigate((nav) => {
		if (nav.type !== 'popstate' && nav.type !== 'leave' && !nav.willUnload) {
			const release = sheetStack.hold();
			nav.complete.then(release, release);
		}
		// The click's hold, if any, has been taken over (or was for nothing).
		releaseClick();
	});
	// A real navigation pushed (or replaced) an entry of its own, before the
	// old page unmounts: its sheets' entries are behind it now.
	onNavigate((nav) => {
		if (nav.type !== 'popstate') sheetStack.navigated(entryDepth());
	});
	afterNavigate((nav) => {
		// The router counts as started only once the first afterNavigate is done.
		if (nav.type === 'enter') queueMicrotask(() => sheetStack.start(entryDepth()));
		else if (nav.type !== 'popstate') sheetStack.anchor();
	});
}
