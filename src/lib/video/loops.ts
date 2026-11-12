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

/** A loop's file name, parsed: the spot, its span, and whether it is the still. Null when it is not one. */
export function parseLoopName(name: string): (LoopSpan & { still: boolean }) | null {
	const m = /^(\d{1,16})-(\d{1,12})-(\d{1,12})(-still)?\.jpg$/.exec(name);
	if (!m) return null;
	const [id, startMs, endMs] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (!Number.isSafeInteger(id) || endMs <= startMs) return null;
	return { id, startMs, endMs, still: m[4] !== undefined };
}
