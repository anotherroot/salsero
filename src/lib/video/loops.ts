/**
 * A figure's loop for the pickers (spec 2026-11-12-picker-preview): its file
 * names come from the section itself, so a page or a phone builds the URL from
 * synced columns alone. PURE and client-safe.
 */

/** A section, as far as its loop goes. */
export type LoopSpan = { id: number; startMs: number; endMs: number };

/** `12-1000-7000.jpg`, or `12-1000-7000-still.jpg`. */
export const loopName = (spot: LoopSpan, still = false): string =>
	`${spot.id}-${spot.startMs}-${spot.endMs}${still ? '-still' : ''}.jpg`;

