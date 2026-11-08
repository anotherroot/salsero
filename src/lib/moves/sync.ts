/**
 * Out of sync on the Moves lists: the card under Coverage and the words that
 * end a row's meta. `differ` on a row is how many of its other copies
 * disagree (0 in step). PURE, client-safe.
 */
import { plural } from '$lib/format';

export type SyncKind = 'figure' | 'routine' | 'position';

const NOUN: Record<SyncKind, [string, string]> = {
	figure: ['figure', 'figures'],
	routine: ['routine', 'routines'],
	position: ['position', 'positions']
};

/** The card: "3 figures out of sync" over "Your copies and the clubs' don't agree"; null at 0. */
export function syncCard(kind: SyncKind, n: number): { title: string; meta: string } | null {
	if (n <= 0) return null;
	const [one, many] = NOUN[kind];
	return {
		title: `${plural(n, one, many)} out of sync`,
		meta: "Your copies and the clubs' don't agree"
	};
}

/** A row's "2 copies differ" / "1 copy differs"; null when in step. */
export function differLabel(n: number | undefined): string | null {
	return n && n > 0 ? plural(n, 'copy differs', 'copies differ') : null;
}

/** The `?sync=1` filter's rule: keep a row only when a copy of it differs. */
export const outOfSync = (r: { differ?: number }) => (r.differ ?? 0) > 0;

/** How many rows of a list differ from a copy: the card's number. */
export const outOfSyncCount = (rows: { differ?: number }[]) => rows.filter(outOfSync).length;
