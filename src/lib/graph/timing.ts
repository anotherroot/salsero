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
 * in 8-counts (the routine player, and the figure popup's cue). Never below
 * one: a four-count figure still owns the 8-count it is called in.
 */
export function eightsSpan(length: number): number {
	return Math.max(1, Math.ceil(length / COUNTS_PER_EIGHT));
}

/**
 * A set of start counts as the `figures.start_counts` mask: bit `n - 1` is
 * count n. Counts outside 1..8 are ignored.
 */
export function maskOf(counts: readonly number[]): number {
	let mask = 0;
	for (const n of counts) if (isStartCount(n)) mask |= 1 << (n - 1);
	return mask;
}

/**
 * The counts a figure can start on, ascending. A null or empty mask is a
 * figure nobody gave a set: it starts on its one `start_count` (null reads as 1).
 */
export function countsOfMask(mask: number | null, start: number | null): number[] {
	if (!mask) return [start ?? DEFAULT_START_COUNT];
	const out: number[] = [];
	for (let n = 1; n <= COUNTS_PER_EIGHT; n++) if (mask & (1 << (n - 1))) out.push(n);
	return out;
}

/**
 * The count a figure begins on in a routine: where the figure before leaves
 * off when its set holds that count, else its usual start (the routine then
 * shows a timing break there, as it always has).
 */
export function startOn(counts: readonly number[], usual: number, incoming: number | null): number {
	return incoming !== null && counts.includes(incoming) ? incoming : usual;
}

/** The lengths the How long? sheet offers for a figure whose length is set in the routine. */
export const LENGTH_CHOICES = [2, 4, 6, 8, 12, 16, 24] as const;
