import type { GroupMode } from '$lib/types';

/*
 * A group's view the frame shows without the page's address saying so: a group's
 * drill while it is being edited (group view spec, rule 5). The exercise page
 * holds it while `editing`; the root layout shows `page.data.groupMode ??
 * frameView.current`; Mine calls `stop` (the page's own ×, with its question).
 * Written from the browser only, so on the server it is always empty.
 */

let current = $state<GroupMode | null>(null);
let stop = $state<(() => void) | null>(null);
let holder = 0;

export const frameView = {
	get current(): GroupMode | null {
		return current;
	},
	get stop(): (() => void) | null {
		return stop;
	}
};

/** Show `mode` until the returned release runs; a newer hold replaces this one. */
export function holdView(mode: GroupMode, onStop: () => void): () => void {
	const mine = ++holder;
	current = mode;
	stop = onStop;
	return () => {
		if (holder !== mine) return;
		current = null;
		stop = null;
	};
}
