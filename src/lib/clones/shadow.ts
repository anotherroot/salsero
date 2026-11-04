/**
 * Yours replaces theirs in what you see (PURE): a group's row whose family
 * has a live member of the person's own is left out of the lists, or marked on
 * a link card. Only views use it; plans, coverage and Today read the group's row.
 */

/** Drops every row whose gene has a member of yours. */
export function shadow<T extends { gene: string | null }>(
	theirs: T[],
	mine: Map<string, number>
): T[] {
	return theirs.filter((r) => r.gene === null || !mine.has(r.gene));
}

/** The same rows, each marked with your member's id when you have one. */
export function swapToMine<T extends { id: number; gene: string | null }>(
	rows: T[],
	mine: Map<string, number>
): (T & { mineId: number | null })[] {
	return rows.map((r) => ({ ...r, mineId: (r.gene !== null && mine.get(r.gene)) || null }));
}
