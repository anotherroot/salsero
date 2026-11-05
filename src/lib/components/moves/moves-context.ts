import { getContext, setContext } from 'svelte';
import { revealTop } from '$lib/moves/pane';

/**
 * What the (moves) layout shares with the pages it holds: its New sheet (the
 * band's +, the empty pane's button) and the position picked on the map.
 */
export interface MovesContext {
	/** Open the New sheet of the list beside the pane. */
	openNew(): void;
	/** The map's picked position; the layout clears it when the map leaves the pane. */
	pick: { value: number | null };
}

const KEY = Symbol('moves');

export function setMoves(ctx: MovesContext): void {
	setContext(KEY, ctx);
}

export function getMoves(): MovesContext {
	const ctx = getContext<MovesContext | undefined>(KEY);
	if (!ctx) throw new Error('getMoves() outside the (moves) layout');
	return ctx;
}

/**
 * Bring the lit row (`aria-current="page"`) of the list column into view,
 * scrolling the column only: `scrollIntoView` would scroll the window too.
 */
export function revealLit(): void {
	reveal('[aria-current="page"]');
}

/** The same for the row of the position picked on the map (`aria-current="true"`). */
export function revealPicked(): void {
	reveal('[aria-current="true"]');
}

function reveal(lit: string): void {
	const row = document.querySelector<HTMLElement>(`[data-list-column] ${lit}`);
	const column = row?.closest<HTMLElement>('[data-list-column]');
	if (!row || !column) return;
	const top = revealTop(
		column.getBoundingClientRect(),
		row.getBoundingClientRect(),
		column.scrollTop,
		24
	);
	if (top !== null) column.scrollTop = top;
}
