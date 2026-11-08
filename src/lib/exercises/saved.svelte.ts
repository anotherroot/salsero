import type { DanceSlug } from '$lib/dances/dances';

/*
 * The last save, for the toast on whatever screen comes next ("Saved · back in
 * 12 days · Undo"): announced by the page that saved, just before it leaves,
 * and drawn by `SavedToast` in the [dance] layout, which outlives the page.
 * Written from the browser only (a tap's result), so on the server it is
 * always null.
 */

export interface Saved {
	dance: DanceSlug;
	message: string;
	/** What Today's `undoDone` takes; null: nothing to undo. */
	undo: { setId: number; before: string | null } | null;
}

let current = $state<(Saved & { id: number }) | null>(null);
/** Each save its own id: the same words twice restart the toast's clock. */
let seq = 0;

export function announceSaved(s: Saved): void {
	current = { ...s, id: ++seq };
}

export const saved = {
	get current(): (Saved & { id: number }) | null {
		return current;
	},
	dismiss(): void {
		current = null;
	}
};
