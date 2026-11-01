/**
 * PURE: what the inline video (`ui/VideoFrame.svelte`) draws on its picture —
 * the play disc, the length pill, the bar with the time and the sections, the
 * buffering spinner — plus the time line and the bands. Client-safe.
 */
import { clock } from '$lib/format';
import type { Spot } from '$lib/types';

export interface InlineState {
	/** Turns true on the video's first `play` and stays true. */
	played: boolean;
	/** The element's `paused` — true after `ended` too. */
	paused: boolean;
	/** Waiting for data (`buffering` in `chrome.ts`). */
	waiting: boolean;
}

export interface InlineParts {
	disc: boolean;
	length: boolean;
	bar: boolean;
	spinner: boolean;
}

/** Before the first play: the board's thumbnail. After it: the bar, the disc while paused. */
export function inlineParts(s: InlineState): InlineParts {
	return {
		disc: s.paused && !s.waiting,
		length: !s.played,
		bar: s.played,
		spinner: s.waiting
	};
}

const known = (d: number) => Number.isFinite(d) && d > 0;

/** "0:09 / 1:08"; the time alone while the length is not known. */
export function timeText(currentS: number, durationS: number): string {
	return known(durationS) ? `${clock(currentS)} / ${clock(durationS)}` : clock(currentS);
}

/** The length pill's text, or null while the length is not known. */
export function lengthText(durationS: number): string | null {
	return known(durationS) ? clock(durationS) : null;
}

/** A band on `components/video/Timeline.svelte`; the inline bar marks none active. */
export interface InlineBand {
	id: number;
	startMs: number;
	endMs: number | null;
	active: false;
}

/** The video's sections as bands and its points as ticks. */
export function inlineBands(spots: Spot[]): InlineBand[] {
	return spots.map((s) => ({ id: s.id, startMs: s.startMs, endMs: s.endMs, active: false }));
}
