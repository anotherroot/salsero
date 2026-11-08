/**
 * PURE, client-safe: moving through Edit's grid from the keyboard (one tab
 * stop, a roving tabindex), and when the grid may follow the song.
 */
import type { Row } from './sections';

/** No auto-scroll this long after the person scrolled by hand. */
export const FOLLOW_PAUSE_MS = 4000;

const rowOf = (rows: Row[], beat: number) => rows.findIndex((r) => beat >= r.start && beat < r.end);

/** Where a key moves the focused beat, or null for a key the grid ignores (or past an end). */
export function gridKey(key: string, beat: number, rows: Row[]): number | null {
	const r = rowOf(rows, beat);
	if (r < 0) return null;
	const row = rows[r];
	const last = rows[rows.length - 1].end - 1;
	switch (key) {
		case 'ArrowRight':
			return beat < last ? beat + 1 : null;
		case 'ArrowLeft':
			return beat > rows[0].start ? beat - 1 : null;
		case 'Home':
			return row.start;
		case 'End':
			return row.end - 1;
		case 'ArrowDown':
		case 'ArrowUp': {
			const to = rows[r + (key === 'ArrowDown' ? 1 : -1)];
			if (!to) return null;
			return Math.min(to.start + (beat - row.start), to.end - 1);
		}
		default:
			return null;
	}
}

/** The grid keeps the playing row in view, unless the person scrolled by hand just now. */
export function shouldFollow(now: number, lastHandScroll: number): boolean {
	return now - lastHandScroll >= FOLLOW_PAUSE_MS;
}
