/** The Coverage selection: versions picked in the order the routine should call them. PURE. */
import type { CoverageGroup } from '$lib/routines/coverage';

/** Appends the id, or removes it keeping the others' order. */
export function togglePick(picked: number[], id: number): number[] {
	return picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id];
}

/** 1-based tap order of the id, or null when it is not picked. */
export function pickNumber(picked: number[], id: number): number | null {
	const i = picked.indexOf(id);
	return i < 0 ? null : i + 1;
}

/** The picked rows in tap order, skipping ids no longer listed. */
export function pickedRows(
	groups: CoverageGroup[],
	picked: number[]
): { id: number; label: string }[] {
	const byId = new Map<number, string>();
	for (const g of groups) for (const r of g.rows) byId.set(r.id, r.label);
	return picked.flatMap((id) => (byId.has(id) ? [{ id, label: byId.get(id)! }] : []));
}

/** "In no routine · 7" */
export function groupHeading(g: CoverageGroup): string {
	return `${g.title} · ${g.rows.length}`;
}
