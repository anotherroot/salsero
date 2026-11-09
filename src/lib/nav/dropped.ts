/**
 * A navigation SvelteKit dropped but never finished. PURE; the root layout
 * wires it to `navigating`.
 *
 * SvelteKit 2 (2.70.4 still) aborts a navigation whose data is still loading
 * when an invalidation starts: any `invalidate`, `invalidateAll`, or a form's
 * own `update()` takes the router's turn. The navigation's `complete` rejects
 * ("navigation aborted"), but `navigating` keeps it for good: the skeleton
 * stays over the old page, and no `beforeNavigate` runs again until some
 * navigation finishes. The app refreshes by itself at any moment (back on
 * screen, a sync landing, a timer), so a tap can meet one.
 */

/** The navigation `navigating` holds: its `complete`, where it goes, and whether history has moved already. */
export interface UnderWay {
	complete: Promise<void>;
	href: string;
	popstate: boolean;
}

/** How many times running a dropped navigation goes again inside the app before the page loads whole. */
export const DROPPED_RETRIES = 2;

/**
 * Calls `again` when `nav` ends in a rejection and is still the navigation
 * under way (`current`, read then): dropped, not cancelled (never under way)
 * and not overtaken by a newer navigation (that one is under way now).
 */
export function watchDropped(
	nav: UnderWay,
	current: () => Promise<void> | null,
	again: (nav: UnderWay) => void
): void {
	nav.complete.then(
		() => {},
		() => {
			if (current() === nav.complete) again(nav);
		}
	);
}

/** The `n`th dropped navigation running: go again inside the app, or load the page whole. */
export function droppedMove(n: number): 'goto' | 'load' {
	return n <= DROPPED_RETRIES ? 'goto' : 'load';
}
