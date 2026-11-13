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

/** Why the selection cannot become a section, or null when it can: any run of neighbours, at any depth (spec 2026-11-12). */
export function extractBlock(rows: { id: number }[], selected: number[]): string | null {
	const w = t().routine.selection.blocked;
	const at = rows.map((r, i) => (selected.includes(r.id) ? i : -1)).filter((i) => i >= 0);
	if (at.length === 0) return w.none;
	if (at[at.length - 1] - at[0] !== at.length - 1) return w.apart;
	return null;
}

export type SelectionAction = 'above' | 'below' | 'duplicate' | 'extract' | 'delete';

/**
 * Why each action of the selection's toolbar is greyed, or null when it is
 * open. `together`: the selection is one run of neighbours, so Before and
 * After have a first and a last slot to build from.
 */
export function actionBlocks(
	count: number,
	together: boolean,
	extractBlocked: string | null
): Record<SelectionAction, string | null> {
	const w = t().routine.selection.blocked;
	const some = count === 0 ? w.first : null;
	const beside = some ?? (together ? null : w.apart);
	return { above: beside, below: beside, duplicate: some, extract: extractBlocked, delete: some };
}

/** A selected slot's place in its run: alone, or the top, a middle or the bottom of neighbours. */
export type Piece = 'single' | 'top' | 'mid' | 'bottom';

export interface SelectionShape {
	/** Each row's place in the selection, by row index; null when it is not selected. */
	pieces: (Piece | null)[];
	/** The runs of selected neighbours, in row order, as inclusive row indices. */
	runs: { from: number; to: number }[];
}

/** How the selected rows lift (spec 2026-11-11, routine lift): alone, or joined with their neighbours. */
export function selectionShape(rowIds: number[], selected: number[]): SelectionShape {
	const on = rowIds.map((id) => selected.includes(id));
	const runs: SelectionShape['runs'] = [];
	on.forEach((s, i) => {
		if (!s) return;
		const last = runs[runs.length - 1];
		if (last && last.to === i - 1) last.to = i;
		else runs.push({ from: i, to: i });
	});
	const pieces: (Piece | null)[] = rowIds.map(() => null);
	for (const { from, to } of runs) {
		for (let i = from; i <= to; i++) {
			pieces[i] = from === to ? 'single' : i === from ? 'top' : i === to ? 'bottom' : 'mid';
		}
	}
	return { pieces, runs };
}
