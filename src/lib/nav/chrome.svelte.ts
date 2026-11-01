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
