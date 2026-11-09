import { untrack } from 'svelte';

/**
 * Who has the bottom edge. An edit's Save bar or a selection bar takes the
 * bottom while it shows, and the tab bar steps aside for it (the layout reads
 * `bottom.claimed`). Claims count, so two at once release independently.
 */
let claims = $state(0);

export const bottom = {
	get claimed() {
		return claims > 0;
	}
};

/** Call during a component's init: holds the bottom while `active()` is true, and lets go on false or on destroy. */
export function claimBottom(active: () => boolean): void {
	$effect(() => {
		if (!active()) return;
		// untrack: `claims++` reads then writes, and would make this effect depend on its own write.
		untrack(() => claims++);
		return () => untrack(() => claims--);
	});
}

/**
 * Whether a bar is pinned at the foot of the page (`BottomBar`, mounted). A
 * toast drawn by a layout does not know the page under it, so it asks this to
 * sit above the bar rather than on it (`SavedToast`). Bars count, as claims do.
 */
let pins = $state(0);
/** Each mounted bar's height, by a key of its own (the offline strip sits above the tallest). */
const heights = $state<Record<number, number>>({});
let nextKey = 0;

export const pinned = {
	get bar() {
		return pins > 0;
	},
	/** The tallest pinned bar's height in px; 0 with none. */
	get height() {
		return Math.max(0, ...Object.values(heights));
	}
};

/** Call during a pinned bar's init: counts it while it is mounted, and its height if given. */
export function pinBar(height?: () => number): void {
	$effect(() => {
		untrack(() => pins++);
		return () => untrack(() => pins--);
	});
	if (height) barHeight(height);
}

/**
 * Call during the init of a bar at the foot of the page: its height lifts the
 * offline strip above it (`pinned.height`), without counting it as pinned for
 * toasts (the figure switcher: its page's toasts already clear it).
 */
export function barHeight(height: () => number): void {
	const key = nextKey++;
	$effect(() => {
		const h = height();
		untrack(() => (heights[key] = h));
	});
	$effect(() => () => untrack(() => delete heights[key]));
}
