import { revealTop } from '$lib/moves/pane';

/**
 * Bring the lit row (`aria-current="page"`) of the list column into view
 * (any section's ListPane),
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
