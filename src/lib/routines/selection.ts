/**
 * Rules for the editor's long-press selection. PURE and client-safe.
 *
 * `extractBlock` is the client's copy of `extractRoutine`'s refusals, worded
 * for a person, so "Make routine" can say why it is greyed BEFORE anything is
 * posted. The server still decides.
 */

/** Selected ids in routine order, whatever order they were tapped in. */
export function inOrder(rows: { id: number }[], selected: number[]): number[] {
	return rows.filter((r) => selected.includes(r.id)).map((r) => r.id);
}

/** Why the selection cannot become a routine, or null when it can. */
export function extractBlock(
	rows: { id: number; isRoutine: boolean }[],
	selected: number[],
	embeddedIn: string[]
): string | null {
	if (embeddedIn.length > 0) {
		return `This routine is embedded in ${embeddedIn.join(', ')} — embedding is one level.`;
	}
	const at = rows.map((r, i) => (selected.includes(r.id) ? i : -1)).filter((i) => i >= 0);
	if (at.length === 0) return 'Select the slots to make into a routine.';
	const routine = at.find((i) => rows[i].isRoutine);
	if (routine !== undefined) return `Slot ${routine + 1} is a routine — embedding is one level.`;
	if (at[at.length - 1] - at[0] !== at.length - 1) return 'Select slots next to each other.';
	return null;
}
