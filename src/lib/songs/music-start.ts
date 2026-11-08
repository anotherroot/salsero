/**
 * PURE, client-safe: where a song's music starts (spec 2026-11-08, "Where the
 * music starts"). The file stays whole; this is only where playing begins.
 */

/** A start below this is no quiet part worth showing or folding. */
export const MUSIC_START_MIN_S = 1;

type Starts = { startS: number | null; startFoundS: number | null };

/** Where the song plays from: the person's start, else the worker's, else 0:00. */
export function musicStart(s: Starts): number {
	return s.startS ?? s.startFoundS ?? 0;
}

export function startSource(s: Starts): 'yours' | 'found' | 'unmeasured' {
	return s.startS !== null ? 'yours' : s.startFoundS !== null ? 'found' : 'unmeasured';
}

/** A fresh `<audio>` reports a few hundredths of a second before it has played. */
const AT_ZERO_S = 0.05;

/**
 * Where Play should seek before it plays: the music start when the song sits
 * at 0:00, else null. Every player calls it (the song page, the Practice
 * player), so all of them start where the music does; the seek bar still
 * reaches 0:00.
 */
export function playFrom(currentTime: number, startS: number, durationS: number): number | null {
	if (currentTime > AT_ZERO_S || !(startS > 0)) return null;
	if (Number.isFinite(durationS) && startS >= durationS) return null;
	return startS;
}
