/**
 * Sections and routines opened in place in the routine editor (spec
 * 2026-11-12, routine sections): the panel colour per level, how deep a
 * panel may open, and the "where am I" bar's rows. PURE and client-safe.
 */

export type PanelHue = 'h1' | 'h2' | 'h3' | 'h4' | 'rt';

/** Levels that open in place; a deeper section opens on its own page. */
export const OPEN_DEPTH = 4;

/** A level's colour, repeating every four (depth 1 is a top-level child); a routine inside is grey. */
export function panelHue(depth: number, isRoutine: boolean): PanelHue {
	if (isRoutine) return 'rt';
	return (['h1', 'h2', 'h3', 'h4'] as const)[(depth - 1) % 4];
}

export function openable(depth: number): boolean {
	return depth <= OPEN_DEPTH;
}

/** The bar's rows: the deepest three of the chain, and how many sit above them. */
export function wherePath<T>(chain: T[]): { more: number; rows: T[] } {
	const rows = chain.slice(-3);
	return { more: chain.length - rows.length, rows };
}
