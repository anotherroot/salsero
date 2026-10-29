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

/** The shortest a section can be edited down to: below a second there is no loop to hear. */
export const MIN_SECTION_MS = 1000;

/**
 * A spot's times with one edge moved to `toMs`, clamped inside the video and
 * leaving a section at least `MIN_SECTION_MS` long — or null when that changes
 * nothing (an edge already against its bound, or a point's missing end), which
 * is what disables a ±1 s button. The duration is in seconds, as the media
 * element gives it; while it is unknown only the start of the video bounds.
 */
export function moveEdge(
	spot: Pick<Spot, 'startMs' | 'endMs'>,
	edge: 'start' | 'end',
	toMs: number,
	durationS: number
): { startMs: number; endMs: number | null } | null {
	const lastMs = Number.isFinite(durationS) ? msOf(durationS) : Infinity;
	const { startMs, endMs } = spot;
	if (edge === 'end') {
		if (endMs === null) return null;
		const next = Math.max(startMs + MIN_SECTION_MS, Math.min(lastMs, toMs));
		return next === endMs ? null : { startMs, endMs: next };
	}
	const latest = endMs === null ? lastMs : endMs - MIN_SECTION_MS;
	const next = Math.max(0, Math.min(latest, toMs));
	return next === startMs ? null : { startMs: next, endMs };
}

/** The fine step, for the transport, the editor and the , / . keys. A frame (17 ms at 60 fps) showed nothing. */
export const TENTH_MS = 100;

/** How far inside its end the editor parks the video, so the paused picture is still in the section. */
export const END_PARK_MS = 10;

/** Where to pause to show an edge (seconds): a start itself, an end just inside it. */
export function edgeViewTime(spot: Pick<Spot, 'startMs' | 'endMs'>, edge: 'start' | 'end'): number {
	return edge === 'start' || spot.endMs === null
		? spot.startMs / 1000
		: (spot.endMs - END_PARK_MS) / 1000;
}

/** Earlier / Later: how far one tap moves a whole section. */
export const WHOLE_SHIFT_MS = 500;
/** Shorter / Longer: how far one tap moves each edge. */
export const WHOLE_RESIZE_MS = 250;

/**
 * A section moved by `deltaMs`, its length kept, stopped at either end of the
 * video — or null for a point, or when it is already against that end.
 */
export function shiftSpot(
	spot: Pick<Spot, 'startMs' | 'endMs'>,
	deltaMs: number,
	durationS: number
): { startMs: number; endMs: number } | null {
	if (spot.endMs === null) return null;
	const lastMs = Number.isFinite(durationS) ? msOf(durationS) : Infinity;
	const d = Math.max(-spot.startMs, Math.min(lastMs - spot.endMs, deltaMs));
	return d === 0 ? null : { startMs: spot.startMs + d, endMs: spot.endMs + d };
}

/**
 * A section grown (positive) or shrunk by `perSideMs` at each edge, kept
 * inside the video and no shorter than `MIN_SECTION_MS` — a shrink past that
 * stops at exactly the minimum around the old middle. Null when nothing
 * changes or for a point.
 */
export function resizeSpot(
	spot: Pick<Spot, 'startMs' | 'endMs'>,
	perSideMs: number,
	durationS: number
): { startMs: number; endMs: number } | null {
	if (spot.endMs === null) return null;
	const lastMs = Number.isFinite(durationS) ? msOf(durationS) : Infinity;
	let startMs = Math.max(0, spot.startMs - perSideMs);
	let endMs = Math.min(lastMs, spot.endMs + perSideMs);
	if (endMs - startMs < MIN_SECTION_MS) {
		if (spot.endMs - spot.startMs <= MIN_SECTION_MS) return null;
		const mid = (spot.startMs + spot.endMs) / 2;
		startMs = Math.round(mid - MIN_SECTION_MS / 2);
		endMs = startMs + MIN_SECTION_MS;
	}
	return startMs === spot.startMs && endMs === spot.endMs ? null : { startMs, endMs };
}

/** `1:04.23` — minutes, seconds, hundredths, floored like `spotTime`. For the player's clock and edges. */
export function preciseTime(ms: number): string {
	const cs = Math.floor(Math.max(0, ms) / 10);
	const minutes = Math.floor(cs / 6000);
	const rest = cs % 6000;
	return `${minutes}:${String(Math.floor(rest / 100)).padStart(2, '0')}.${String(rest % 100).padStart(2, '0')}`;
}

/** `7.2 s` — a section's length. */
export function lengthText(ms: number): string {
	return `${(ms / 1000).toFixed(1)} s`;
}

/** A section's own clock: `2.7 / 7.2 s`, held inside the section. */
export function sectionProgress(spot: Pick<Spot, 'startMs' | 'endMs'>, currentMs: number): string {
	const length = (spot.endMs ?? spot.startMs) - spot.startMs;
	const into = Math.max(0, Math.min(length, currentMs - spot.startMs));
	return `${(into / 1000).toFixed(1)} / ${lengthText(length)}`;
}
