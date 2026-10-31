/**
 * Tells the Android shell which colour the strip under the navigation bar
 * takes: the tab bar's while the page shows tabs (or a bar pinned on their
 * surface), the page's otherwise. A no-op in a browser.
 */
import type { Action } from 'svelte/action';

export function reportStrip(strip: 'tabs' | 'page'): void {
	(window as { SalsaBars?: { postMessage(m: string): void } }).SalsaBars?.postMessage(strip);
}

/** How many mounted components sit on the tab-bar surface at the bottom edge. */
export const pinned = $state({ count: 0 });

/** A component pinned on the tab-bar surface registers itself while mounted. */
export const tabSurface: Action = () => {
	pinned.count++;
	return {
		destroy() {
			pinned.count--;
		}
	};
};
