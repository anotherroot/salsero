/**
 * Spots — saved moments and sections of a video — as the full-screen player
 * needs them. PURE and client-safe: the media element speaks seconds, a spot
 * is stored in milliseconds, and every conversion between the two is here.
 */
import type { Spot } from '$lib/types';

/** Seconds of media time to the integer milliseconds a spot stores. */
export function msOf(s: number): number {
	return Math.round(s * 1000);
}

/**
 * `2:14.5` — minutes, seconds, tenths. Floored, not rounded, so 59.99 s reads
 * `0:59.9` rather than an impossible `0:60.0`. No hours: a class video is not
 * that long, and `62:05.3` still reads fine.
 */
export function spotTime(ms: number): string {
	const tenths = Math.floor(ms / 100);
	const minutes = Math.floor(tenths / 600);
	const rest = tenths % 600;
	const seconds = Math.floor(rest / 10);
	return `${minutes}:${String(seconds).padStart(2, '0')}.${rest % 10}`;
}

/** What a spot is called on screen: its label, else its time or time range. */
export function spotLabel(spot: Pick<Spot, 'startMs' | 'endMs' | 'label'>): string {
	if (spot.label) return spot.label;
	const start = spotTime(spot.startMs);
	return spot.endMs === null ? start : `${start}–${spotTime(spot.endMs)}`;
}

/**
 * The time after a ±step, kept inside the video. Before metadata arrives the
 * duration is NaN (and Infinity for some streams), so only the start is a
 * bound then.
 */
export function step(currentS: number, deltaS: number, durationS: number): number {
	const next = Math.max(0, currentS + deltaS);
	return Number.isFinite(durationS) ? Math.min(durationS, next) : next;
}

/** By start time, then by id so two spots at the same moment keep a stable order. */
export function sortSpots<T extends Pick<Spot, 'id' | 'startMs'>>(spots: T[]): T[] {
	return [...spots].sort((a, b) => a.startMs - b.startMs || a.id - b.id);
}

/**
 * Where to seek while a section loops, or null to keep playing. Anything at or
 * past the end goes back to the start — so a scrub past the section lands in
 * it again, which is the point: only ending the loop lets playback leave.
 * Before the start, playback runs on into the section.
 */
export function loopTarget(
	currentS: number,
	loop: Pick<Spot, 'startMs' | 'endMs'> | null
): number | null {
	if (!loop || loop.endMs === null) return null;
	return msOf(currentS) >= loop.endMs ? loop.startMs / 1000 : null;
}
