/**
 * The full-screen player's screens as a stack: the full video at the bottom,
 * then a section's view, an editor, a sheet. Back pops one; history holds one
 * entry per screen (`player-history.ts`). PURE and client-safe.
 */
import type { Spot } from '$lib/types';

/**
 * `list`: the spot list as a panel beside the video (landscape), closed by Back like any sheet.
 * `link`: the Link popup's list; `link-new`: one of its create steps, above it, so Back
 * returns to the list before it closes the popup.
 */
export type PlayerSheet = 'rename' | 'delete' | 'keys' | 'list' | 'link' | 'link-new';

export type Screen =
	| { kind: 'full' }
	| { kind: 'section'; spotId: number }
	| { kind: 'edit'; spotId: number }
	| { kind: 'sheet'; sheet: PlayerSheet };

/** `[0]` is always the full video. */
export type Stack = readonly Screen[];

const FULL: Screen = { kind: 'full' };

/** Where the player opens: the full video, or a section's view above it. */
export function openingStack(loopSpotId?: number): Stack {
	return loopSpotId === undefined ? [FULL] : [FULL, { kind: 'section', spotId: loopSpotId }];
}

/** The level on screen: the top screen that is not a sheet. */
export function levelOf(stack: Stack): Screen {
	for (let i = stack.length - 1; i >= 0; i--) if (stack[i].kind !== 'sheet') return stack[i];
	return FULL;
}

/** The sheet open on top, if any. */
export function sheetOf(stack: Stack): PlayerSheet | null {
	const top = stack[stack.length - 1];
	return top?.kind === 'sheet' ? top.sheet : null;
}

/**
 * Where the editor's Done goes: a point back to the full video, a section to
 * its own view — by popping when that view is right below, else by replacing
 * the editor with it (an editor opened from a just-saved toast).
 */
export function doneTarget(stack: Stack, spot: Pick<Spot, 'id' | 'endMs'>): 'pop' | Screen {
	if (spot.endMs === null) return 'pop';
	const below = stack[stack.length - 2];
	if (below?.kind === 'section' && below.spotId === spot.id) return 'pop';
	return { kind: 'section', spotId: spot.id };
}

/**
 * The section that loops: the one whose view or editor is open. A loop exists
 * nowhere else — not at the full video, not for a point — and the editor's
 * Loop toggle pauses it for that editor only.
 *
 * `arriving` is a level on its way (a jump goes back through history first,
 * then pushes): it loops already, so the screen still on the stack cannot
 * pull the video back into its own section meanwhile.
 */
export function loopOf<T extends Pick<Spot, 'id' | 'endMs'>>(
	stack: Stack,
	spots: readonly T[],
	paused: boolean,
	arriving: Screen | null = null
): T | null {
	const level = arriving ?? levelOf(stack);
	if (level.kind !== 'section' && level.kind !== 'edit') return null;
	if (level.kind === 'edit' && paused) return null;
	const spot = spots.find((s) => s.id === level.spotId);
	return spot && spot.endMs !== null ? spot : null;
}

/**
 * The stack without any screen whose spot has gone (deleted on another
 * device, then a reload): cut just below the first such screen. The same
 * array when nothing is missing, so a caller can tell.
 */
export function prune(stack: Stack, spots: readonly Pick<Spot, 'id'>[]): Stack {
	const cut = stack.findIndex(
		(s) => (s.kind === 'section' || s.kind === 'edit') && !spots.some((x) => x.id === s.spotId)
	);
	return cut === -1 ? stack : stack.slice(0, cut);
}

/**
 * Where an editor opens: right above its own section's view when that view is
 * the level on screen (so Done pops back to it), else right above the full
 * video. Any sheet on top, and any other section, is left behind.
 */
export function editStack(stack: Stack, spotId: number): Stack {
	const level = levelOf(stack);
	const edit: Screen = { kind: 'edit', spotId };
	return level.kind === 'section' && level.spotId === spotId ? [FULL, level, edit] : [FULL, edit];
}
