/**
 * The Done landing (spec 2026-11-10-motion-round-1, "Done lands on Today").
 * PURE. On the phone Today is hidden under the exercise page while a save
 * reorders it; when it shows again, what changed is played only right after a
 * save (or Not today), never on a plain return.
 */

/** Play what changed while Today was hidden: a save's toast or the layout's (Not today) is up. */
export function shouldReplay(o: { savedId: number | null; layoutToast: boolean }): boolean {
	return o.savedId !== null || o.layoutToast;
}

/** The row just done: the saved exercise once its row is done, else none. */
export function landedRow(
	savedId: number | null,
	rows: readonly { id: number; done: boolean }[]
): number | null {
	if (savedId === null) return null;
	return rows.some((r) => r.id === savedId && r.done) ? savedId : null;
}
