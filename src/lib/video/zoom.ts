/**
 * Pinch to zoom the player's picture. PURE and client-safe: points are in px
 * relative to the box's centre, and a `View` is the wrapper's transform —
 * translate the picture's centre by (x, y), then scale about that centre.
 */

export type Pt = { x: number; y: number };
export type Size = { w: number; h: number };
export type View = { scale: number; x: number; y: number };

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const NO_ZOOM: View = { scale: 1, x: 0, y: 0 };

/** The picture as `object-fit: contain` draws it in the box, at 1×. */
export function fitSize(box: Size, natural: Size): Size {
	if (!natural.w || !natural.h) return box;
	const k = Math.min(box.w / natural.w, box.h / natural.h);
	return { w: natural.w * k, h: natural.h * k };
}

/** How far the picture may move along one axis: none while it is smaller than its box. */
function limit(t: number, pic: number, box: number, scale: number): number {
	const room = (pic * scale - box) / 2;
	return room <= 0 ? 0 : Math.max(-room, Math.min(room, t));
}

/** Scale into 1×–4×, and never a gap at the picture's edges. */
export function clampView(v: View, box: Size, pic: Size): View {
	const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.scale));
	if (scale === MIN_ZOOM) return NO_ZOOM;
	return {
		scale,
		x: limit(v.x, pic.w, box.w, scale) || 0,
		y: limit(v.y, pic.h, box.h, scale) || 0
	};
}

/** Scale `start` by `k` so the picture point under `from` lands under `to`. */
function about(start: View, from: Pt, to: Pt, k: number, box: Size, pic: Size): View {
	const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, start.scale * k));
	const qx = (from.x - start.x) / start.scale;
	const qy = (from.y - start.y) / start.scale;
	return clampView({ scale, x: to.x - scale * qx, y: to.y - scale * qy }, box, pic);
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Two fingers from where they went down (`from`) to where they are now (`to`). */
export function pinchView(start: View, from: [Pt, Pt], to: [Pt, Pt], box: Size, pic: Size): View {
	const d0 = dist(from[0], from[1]);
	const k = d0 > 0 ? dist(to[0], to[1]) / d0 : 1;
	return about(start, mid(from[0], from[1]), mid(to[0], to[1]), k, box, pic);
}

/** One finger dragging a zoomed picture. */
export function panView(v: View, dx: number, dy: number, box: Size, pic: Size): View {
	return clampView({ ...v, x: v.x + dx, y: v.y + dy }, box, pic);
}

/** A trackpad pinch (a wheel event with Ctrl) about the pointer. */
export function wheelView(v: View, at: Pt, deltaY: number, box: Size, pic: Size): View {
	return about(v, at, at, Math.exp(-deltaY / 200), box, pic);
}

export function zoomTransform(v: View): string {
	return `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
}
