/**
 * A figure loop's file names (picker preview): `<spot>-<start>-<end>.jpg` and
 * `…-still.jpg`, from the section itself. PURE and imports nothing: the device
 * worker bundles it, and it has no app environment (`$lib/i18n` needs one).
 */

/** A section, as far as its loop goes. */
export type LoopSpan = { id: number; startMs: number; endMs: number };

/** The clip, `12-1000-7000.mp4`, or its still, `12-1000-7000-still.jpg` (revision 2026-11-13). */
export const loopName = (spot: LoopSpan, still = false): string =>
	`${spot.id}-${spot.startMs}-${spot.endMs}${still ? '-still.jpg' : '.mp4'}`;

/** A loop's file name, parsed: the spot, its span, and whether it is the still. Null when it is not one. */
export function parseLoopName(name: string): (LoopSpan & { still: boolean }) | null {
	const m = /^(\d{1,16})-(\d{1,12})-(\d{1,12})(?:(-still)\.jpg|\.mp4)$/.exec(name);
	if (!m) return null;
	const [id, startMs, endMs] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (!Number.isSafeInteger(id) || endMs <= startMs) return null;
	return { id, startMs, endMs, still: m[4] !== undefined };
}
