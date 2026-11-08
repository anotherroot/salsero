/**
 * Out of sync on the Moves lists: the card under Coverage and the words that
 * end a row's meta. `differ` on a row is how many of its other copies
 * disagree (0 in step). PURE, client-safe.
 */
import { t } from '$lib/i18n/catalog';

export type SyncKind = 'figure' | 'routine' | 'position';

const NOUN = { figure: 'figures', routine: 'routines', position: 'positions' } as const;

/** The card: "3 figures out of sync" over "Your copies and the clubs' don't agree"; null at 0. */
export function syncCard(
	kind: SyncKind,
	n: number,
	on = false
): { title: string; meta: string } | null {
	const w = t();
	// The filter on and nothing left to show: the card stays, to clear it.
	if (n <= 0)
		return on ? { title: w.moves.sync.allInStep, meta: w.moves.sync.allInStepMeta } : null;
	return { title: w.moves.sync.title(w.nouns[NOUN[kind]](n)), meta: w.moves.sync.meta };
}

/** A row's "2 copies differ" / "1 copy differs"; null when in step. */
export function differLabel(n: number | undefined): string | null {
	return n && n > 0 ? t().moves.row.differ(n) : null;
}

/** The `?sync=1` filter's rule: keep a row only when a copy of it differs. */
export const outOfSync = (r: { differ?: number }) => (r.differ ?? 0) > 0;

/** How many rows of a list differ from a copy: the card's number. */
export const outOfSyncCount = (rows: { differ?: number }[]) => rows.filter(outOfSync).length;

/** The list's empty state while the filter is on and every copy agrees (read when drawn). */
export const SYNC_EMPTY = {
	get title(): string {
		return t().moves.sync.emptyTitle;
	},
	get body(): string {
		return t().moves.sync.emptyBody;
	}
};
