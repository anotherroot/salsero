/**
 * Fitting the map to the screen. PURE and client-safe. A `View` (shared with
 * the video player's zoom, `$lib/video/zoom`) is read here as: screen point =
 * frame point × scale + (x, y), measured from the room's top left (the box the
 * map is drawn in). `viewTransform` is the CSS for an element with
 * `transform-origin: 0 0`. The map's own maths; zoom.ts is not touched.
 */

import type { Pt, View } from '$lib/video/zoom';
import type { Box } from './map-view';

/**
 * The screen box, and what floats over its top (the band), its bottom (the
 * sheet, the bar) and its right (the desktop's panel; 0 when left out). The
 * map fits beside `right`; `aside` floats over the map's right too, but the
 * map keeps its size under it: only a fit steers clear of it, and the map pans
 * at any scale (what is under it is reached by panning).
 */
export type Room = {
	w: number;
	h: number;
	top: number;
	bottom: number;
	right?: number;
	aside?: number;
};
type Frame = { width: number; height: number };

/** The desktop's panel over the map's right: 320 px, 12 px in, 12 px kept clear of the map. */
export const DESK_PANEL = 320 + 12 + 12;
/** The least map width worth keeping beside the panel. */
const DESK_MIN_MAP = 360;

/**
 * What the desktop's panel takes off a map box `w` wide (`Room.right`): the
 * panel, while at least 360 px of map stay beside it; else nothing, and the
 * panel floats over the map, which keeps its size and is panned under it.
 */
export function deskRight(w: number): number {
	return w - DESK_PANEL >= DESK_MIN_MAP ? DESK_PANEL : 0;
}

/** The panel over a map it is not kept beside (`Room.aside`): what `deskRight` leaves out. */
export function deskAside(w: number): number {
	return DESK_PANEL - deskRight(w);
}

const PAD = 14;
const MAX_SCALE = 4;
/** How much of the map must stay on screen along an axis when panning. */
const KEEP = 48;

const freeH = (r: Room) => Math.max(1, r.h - r.top - r.bottom);
/** The free width: the room less what floats over its right. */
const freeW = (r: Room) => Math.max(1, r.w - (r.right ?? 0));
/** Kept clear at the room's sides by the whole view, so no pill touches the screen's edge. */
const SIDE = 12;
/** Less than this left of an `aside` is no room to fit into: the fit uses the free width. */
const MIN_FIT_W = 160;
/** The width a fit centres in: the free width, less an `aside` when enough is left of it. */
function fitW(r: Room): number {
	const left = freeW(r) - (r.aside ?? 0);
	return left >= MIN_FIT_W ? left : freeW(r);
}

/** Whether the map pans at the whole view's scale: only when something floats over part of it. */
export function pansWhole(r: Room): boolean {
	return (r.aside ?? 0) > 0;
}

/** The whole frame in the free part of the room, centred, SIDE px clear of its sides; never enlarged past 1. */
export function wholeView(frame: Frame, room: Room): View {
	const scale = Math.min(
		1,
		Math.max(1, freeW(room) - 2 * SIDE) / Math.max(1, frame.width),
		freeH(room) / Math.max(1, frame.height)
	);
	return {
		scale,
		x: (freeW(room) - frame.width * scale) / 2,
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
		x: Math.max(kx - fw, Math.min(freeW(room) - kx, v.x)),
		y: Math.max(room.top + ky - fh, Math.min(room.h - room.bottom - ky, v.y))
	};
}

/**
 * The view that shows `boxes` (padded 14 px) as large as fits, up to `max`
 * (default 1), centred in the free part of the room (left of an `aside`).
 * Never smaller than the whole view. No boxes shows the whole map.
 */
export function fitView(boxes: Box[], frame: Frame, room: Room, max = 1): View {
	if (boxes.length === 0) return wholeView(frame, room);
	const l = Math.min(...boxes.map((b) => b.x - b.w / 2)) - PAD;
	const r = Math.max(...boxes.map((b) => b.x + b.w / 2)) + PAD;
	const t = Math.min(...boxes.map((b) => b.y - b.h / 2)) - PAD;
	const b = Math.max(...boxes.map((b) => b.y + b.h / 2)) + PAD;
	const whole = wholeView(frame, room).scale;
	const scale = Math.max(whole, Math.min(max, fitW(room) / (r - l), freeH(room) / (b - t)));
	return clampMapView(
		{
			scale,
			x: fitW(room) / 2 - ((l + r) / 2) * scale,
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

/*
 * The gestures, in this file's frame: points are px from the room's top left,
 * as `View` reads them here. The video player's pinch maths (`$lib/video/zoom`),
 * with the map's own clamp: from the whole view's scale up to 4, some map kept
 * on screen (`clampMapView`).
 */

/** Scale `start` by `k` so the map point under `from` lands under `to`. */
function about(start: View, from: Pt, to: Pt, k: number, frame: Frame, room: Room): View {
	const floor = wholeView(frame, room).scale;
	const scale = Math.max(floor, Math.min(MAX_SCALE, start.scale * k));
	const qx = (from.x - start.x) / start.scale;
	const qy = (from.y - start.y) / start.scale;
	return clampMapView({ scale, x: to.x - scale * qx, y: to.y - scale * qy }, frame, room);
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Two fingers from where they went down (`from`) to where they are now (`to`). */
export function pinchMapView(
	start: View,
	from: [Pt, Pt],
	to: [Pt, Pt],
	frame: Frame,
	room: Room
): View {
	const d0 = dist(from[0], from[1]);
	const k = d0 > 0 ? dist(to[0], to[1]) / d0 : 1;
	return about(start, mid(from[0], from[1]), mid(to[0], to[1]), k, frame, room);
}

/** One finger dragging the map. */
export function panMapView(v: View, dx: number, dy: number, frame: Frame, room: Room): View {
	return clampMapView({ ...v, x: v.x + dx, y: v.y + dy }, frame, room);
}

/** A trackpad pinch (a wheel event with Ctrl) about the pointer. */
export function wheelMapView(v: View, at: Pt, deltaY: number, frame: Frame, room: Room): View {
	return about(v, at, at, Math.exp(-deltaY / 200), frame, room);
}
