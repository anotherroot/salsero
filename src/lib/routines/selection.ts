/**
 * Rules for the editor's long-press selection. PURE and client-safe.
 *
 * `extractBlock` is the client's copy of `extractRoutine`'s refusals, worded
 * for a person, so "Make routine" can say why it is greyed BEFORE anything is
 * posted. The server still decides.
 */
import { t } from '$lib/i18n/catalog';

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
	const w = t().routine.selection.blocked;
	if (embeddedIn.length > 0) return w.embedded(embeddedIn.join(', '));
	const at = rows.map((r, i) => (selected.includes(r.id) ? i : -1)).filter((i) => i >= 0);
	if (at.length === 0) return w.none;
	const routine = at.find((i) => rows[i].isRoutine);
	if (routine !== undefined) return w.slotIsRoutine(routine + 1);
	if (at[at.length - 1] - at[0] !== at.length - 1) return w.apart;
	return null;
}

export type SelectionAction = 'above' | 'below' | 'duplicate' | 'extract' | 'delete';

/** Why each action of the selection bar is greyed, or null when it is open. */
export function actionBlocks(
	count: number,
	extractBlocked: string | null
): Record<SelectionAction, string | null> {
	const w = t().routine.selection.blocked;
	const beside = count === 1 ? null : w.one;
	const some = count === 0 ? w.first : null;
	return { above: beside, below: beside, duplicate: some, extract: extractBlocked, delete: some };
}
