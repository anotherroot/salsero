import { getContext, setContext } from 'svelte';

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
