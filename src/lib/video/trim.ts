/**
 * The editor's trim strip: a zoomed timeline of one spot with a margin either
 * side, and the arithmetic between a position on it and a time. PURE and
 * client-safe; the strip measures itself and hands the numbers in.
 */
import type { Spot } from '$lib/types';
import { msOf } from './spots';

/** How much video the strip shows either side of the spot. */
export const TRIM_PAD_MS = 3000;
/** An edge closer than this to the strip's side widens the strip on release. */
export const TRIM_FIT_MS = 500;
/** How far from a handle a finger still grabs it, in CSS px. */
export const GRAB_PX = 28;

export interface TrimWindow {
	fromMs: number;
	toMs: number;
}

type Edges = Pick<Spot, 'startMs' | 'endMs'>;

function lastMs(durationS: number): number {
	return Number.isFinite(durationS) ? msOf(durationS) : Infinity;
}

/** The spot with `TRIM_PAD_MS` either side, inside the video. */
export function trimWindow(spot: Edges, durationS: number): TrimWindow {
	const end = spot.endMs ?? spot.startMs;
	return {
		fromMs: Math.max(0, spot.startMs - TRIM_PAD_MS),
		toMs: Math.min(lastMs(durationS), end + TRIM_PAD_MS)
	};
}

/**
 * The window after an edit: the same object while both edges are well inside,
 * so a caller can tell nothing moved; otherwise the side an edge came close to
 * is pushed out to `TRIM_PAD_MS` beyond it.
 */
export function fitWindow(win: TrimWindow, spot: Edges, durationS: number): TrimWindow {
	const end = spot.endMs ?? spot.startMs;
	const lowOk = spot.startMs - win.fromMs >= TRIM_FIT_MS || win.fromMs === 0;
	const highOk = win.toMs - end >= TRIM_FIT_MS || win.toMs === lastMs(durationS);
	if (lowOk && highOk) return win;
	return {
		fromMs: lowOk ? win.fromMs : Math.max(0, spot.startMs - TRIM_PAD_MS),
		toMs: highOk ? win.toMs : Math.min(lastMs(durationS), end + TRIM_PAD_MS)
	};
}

/** The time at `x` px across a strip `width` px wide, rounded and clamped to the window. */
export function msAtX(x: number, width: number, win: TrimWindow): number {
	const f = Math.max(0, Math.min(1, x / width));
	return Math.round(win.fromMs + f * (win.toMs - win.fromMs));
}

/** Where a time sits on the strip, 0–100, clamped. */
export function pctOf(ms: number, win: TrimWindow): number {
	const p = ((ms - win.fromMs) / (win.toMs - win.fromMs)) * 100;
	return Math.max(0, Math.min(100, p));
}

/** The handle within `grabPx` of `x` — the nearer one, the start on a tie — or null. */
export function handleAt(
	x: number,
	width: number,
	win: TrimWindow,
	spot: Edges,
	grabPx = GRAB_PX
): 'start' | 'end' | null {
	const px = (ms: number) => (pctOf(ms, win) / 100) * width;
	const toStart = Math.abs(px(spot.startMs) - x);
	const toEnd = spot.endMs === null ? Infinity : Math.abs(px(spot.endMs) - x);
	if (Math.min(toStart, toEnd) > grabPx) return null;
	return toStart <= toEnd ? 'start' : 'end';
}
