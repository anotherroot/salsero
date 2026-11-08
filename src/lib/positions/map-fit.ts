/**
 * Fitting the map to the screen. PURE and client-safe. A `View` (shared with
 * the video player's zoom, `$lib/video/zoom`) is read here as: screen point =
 * frame point × scale + (x, y), measured from the room's top left (the box the
 * map is drawn in). `viewTransform` is the CSS for an element with
 * `transform-origin: 0 0`. The map's own maths; zoom.ts is not touched.
 */

import type { View } from '$lib/video/zoom';
import type { Box } from './map-view';

/** The screen box, and what floats over its top (the band) and its bottom (the sheet, the bar). */
export type Room = { w: number; h: number; top: number; bottom: number };
type Frame = { width: number; height: number };

const PAD = 14;
const MAX_SCALE = 4;
/** How much of the map must stay on screen along an axis when panning. */
const KEEP = 48;

const freeH = (r: Room) => Math.max(1, r.h - r.top - r.bottom);

/** The whole frame in the free part of the room, centred; never enlarged past 1. */
export function wholeView(frame: Frame, room: Room): View {
	const scale = Math.min(
		1,
		room.w / Math.max(1, frame.width),
		freeH(room) / Math.max(1, frame.height)
	);
	return {
		scale,
		x: (room.w - frame.width * scale) / 2,
		y: room.top + (freeH(room) - frame.height * scale) / 2
	};
}

/** Scale into the whole view's .. 4, and keep some of the map on screen. */
export function clampMapView(v: View, frame: Frame, room: Room): View {
	const scale = Math.max(wholeView(frame, room).scale, Math.min(MAX_SCALE, v.scale));
	const fw = frame.width * scale;
	const fh = frame.height * scale;
	const kx = Math.min(KEEP, fw);
	const ky = Math.min(KEEP, fh);
	return {
		scale,
		x: Math.max(kx - fw, Math.min(room.w - kx, v.x)),
		y: Math.max(room.top + ky - fh, Math.min(room.h - room.bottom - ky, v.y))
	};
}

/**
 * The view that shows `boxes` (padded 14 px) as large as fits, up to `max`
 * (default 1), centred in the free part of the room. Never smaller than the
 * whole view. No boxes shows the whole map.
 */
export function fitView(boxes: Box[], frame: Frame, room: Room, max = 1): View {
	if (boxes.length === 0) return wholeView(frame, room);
	const l = Math.min(...boxes.map((b) => b.x - b.w / 2)) - PAD;
	const r = Math.max(...boxes.map((b) => b.x + b.w / 2)) + PAD;
	const t = Math.min(...boxes.map((b) => b.y - b.h / 2)) - PAD;
	const b = Math.max(...boxes.map((b) => b.y + b.h / 2)) + PAD;
	const whole = wholeView(frame, room).scale;
	const scale = Math.max(whole, Math.min(max, room.w / (r - l), freeH(room) / (b - t)));
	return clampMapView(
		{
			scale,
			x: room.w / 2 - ((l + r) / 2) * scale,
			y: room.top + freeH(room) / 2 - ((t + b) / 2) * scale
		},
		frame,
		room
	);
}

/** The CSS transform for an element with `transform-origin: 0 0`. */
export function viewTransform(v: View): string {
	return `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
}
