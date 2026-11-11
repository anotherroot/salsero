/**
 * The routine editor's lifted pieces (spec 2026-11-11, routine lift): an open
 * slot, a selected slot or a run of selected neighbours lifts out of the list
 * while the rest steps back.
 *
 * The shadow sits on a `before:` layer at `-z-10`, under every card of the
 * list (whose `<ul>` is `isolate`), so the pieces of a joined run never shade
 * each other where they meet. A lone piece's ring (`RING`) is an `after:` layer on top, so the
 * cards inside never cover it. Neither may sit on an element that clips.
 */
import type { Piece } from '$lib/routines/selection';

export const LIFTED =
	"relative bg-surface before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:shadow-[0_14px_34px_rgb(0_0_0/0.18)] before:content-['']";

/**
 * The 1 px accent ring of a piece that stands alone. Not on a run's pieces:
 * each one's ring would draw again where they meet, a double line where a
 * hairline belongs.
 */
export const RING =
	"after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] after:content-['']";

/** The rest of the list beside an open slot, and beside a selection. */
export const DIM_OPEN = 'opacity-45';
export const DIM_SELECT = 'opacity-60';
/** Dimming and lifting ease; nothing that moves the layout does. */
export const FADE = 'transition-opacity duration-150 motion-reduce:transition-none';

const ROUND: Record<Piece, string> = {
	single: 'rounded-[20px]',
	top: 'rounded-t-[20px]',
	mid: 'rounded-none',
	bottom: 'rounded-b-[20px]'
};

/** A piece's corners: a run's top piece has the top ones, its bottom piece the bottom ones. */
export function pieceRound(piece: Piece): string {
	return ROUND[piece];
}

/**
 * A card's own corners inside the piece lifting it: where it meets the
 * piece's corners. `followed`: something under it in the piece (an open
 * slot's alternatives and tools, a run's tip and toolbar).
 */
export function faceRound(piece: Piece | null, followed: boolean): string {
	if (piece === null) return 'rounded-2xl';
	if (piece === 'single') return followed ? 'rounded-t-[20px]' : 'rounded-[20px]';
	if (piece === 'bottom' && !followed) return 'rounded-b-[20px]';
	return 'rounded-none';
}
