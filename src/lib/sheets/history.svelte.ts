import { afterNavigate, onNavigate, pushState } from '$app/navigation';
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
	later: (fn) => queueMicrotask(fn)
});

/** Keep the stack in step with history. Call once, from the root layout. */
export function syncSheets(): void {
	$effect(() => {
		const onpop = () => sheetStack.sync(entryDepth());
		window.addEventListener('popstate', onpop);
		return () => window.removeEventListener('popstate', onpop);
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
