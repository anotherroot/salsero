/**
 * Figure timing: which count of the 8-count a figure begins on, how many
 * counts it takes, and so which count it leaves the next figure to begin on.
 *
 * PURE and client-safe, like the rest of `src/lib/graph/`.
 *
 * Counts, not steps. Salsa takes six steps in eight counts and bachata differs
 * again; a count is the same unit in every dance, and the one the beat grid
 * already speaks.
 */

export const COUNTS_PER_EIGHT = 8;

/** What an unset start count reads as: the figure begins on "1". */
export const DEFAULT_START_COUNT = 1;

/** What an unset length reads as: one 8-count. */
export const DEFAULT_LENGTH_COUNTS = 8;

/** The longest figure the form accepts — eight 8-counts, the old `MAX_EIGHTS`. */
export const MAX_LENGTH_COUNTS = 64;

export function isStartCount(n: unknown): n is number {
	return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= COUNTS_PER_EIGHT;
}

export function isLengthCounts(n: unknown): n is number {
	return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_LENGTH_COUNTS;
}

/**
 * The count the FOLLOWING figure should begin on. A figure from 5 taking four
 * counts is done by 8, so the next begins on 1; one from 1 taking four leaves
 * the next on 5.
 */
export function nextCount(start: number, length: number): number {
	return ((start - 1 + length) % COUNTS_PER_EIGHT) + 1;
}

/**
 * How many whole 8-counts a figure occupies, for the planners that still work
 * in 8-counts (the drill, and the routine player until slice 3). Never below
 * one: a four-count figure still owns the 8-count it is called in.
 */
export function eightsSpan(length: number): number {
	return Math.max(1, Math.ceil(length / COUNTS_PER_EIGHT));
}
