/**
 * A toast swiped away, left or right. DOM-free like `swipe.ts`: the component
 * feeds pointer positions with their times and asks where to draw and whether
 * the release throws the toast off or brings it back.
 *
 * The direction locks once the pointer has moved `lockPx`; a mostly vertical
 * move stays the page's for the rest of the gesture. A release goes when the
 * toast is past `distance` of its width, or when it is flicked faster than
 * `speed` (px per ms) the way it is already going.
 */

export interface DismissOptions {
	lockPx: number;
	/** Fraction of the toast's width past which a release throws it off. */
	distance: number;
	/** Px per ms: a flick at least this fast throws it off, however short. */
	speed: number;
}

export const DISMISS: DismissOptions = { lockPx: 10, distance: 0.35, speed: 0.5 };

/** Where a release sends the toast: off to one side, or back home. */
export type Release = 'left' | 'right' | 'back';

export interface Dismiss {
	/** `width`: the toast's own, which `distance` is a fraction of. */
	down(x: number, y: number, t: number, width: number): void;
	/** The offset to draw, or null while undecided or once this is a scroll. */
	move(x: number, y: number, t: number): number | null;
	/** Undefined when it was never a swipe (a tap, or a scroll). */
	up(t: number): Release | undefined;
	/** True once, for the click that follows a swipe: it must not also press Undo. */
	swallow(): boolean;
}

/** How far a toast goes off: its width and a little, so the shadow leaves too. */
export function offscreen(side: 'left' | 'right', width: number): number {
	return (side === 'left' ? -1 : 1) * (width + 24);
}

/** Fades as it travels: fully gone at the width. */
export function fade(offset: number, width: number): number {
	if (width <= 0) return 1;
	return Math.max(0, 1 - Math.abs(offset) / width);
}

export function dismiss(o: DismissOptions = DISMISS): Dismiss {
	let origin: { x: number; y: number; width: number } | null = null;
	let axis: 'x' | 'y' | null = null;
	let offset = 0;
	/** The last two samples, for the release speed. */
	let last = { x: 0, t: 0 };
	let prev = { x: 0, t: 0 };
	let owed = false;

	return {
		down(x, y, t, width) {
			owed = false;
			axis = null;
			offset = 0;
			origin = { x, y, width };
			last = prev = { x, t };
		},
		move(x, y, t) {
			if (!origin || axis === 'y') return null;
			const dx = x - origin.x;
			const dy = y - origin.y;
			if (axis === null) {
				if (Math.hypot(dx, dy) < o.lockPx) return null;
				axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
				if (axis === 'y') return null;
			}
			prev = last;
			last = { x, t };
			offset = dx;
			return offset;
		},
		up(t) {
			const was = origin;
			origin = null;
			if (!was || axis !== 'x') return undefined;
			owed = true;
			// A pause before letting go is no flick: the speed counts only a recent move.
			const dt = last.t - prev.t;
			const v = dt > 0 && t - last.t < 100 ? (last.x - prev.x) / dt : 0;
			const side = offset < 0 ? 'left' : 'right';
			const far = Math.abs(offset) >= was.width * o.distance;
			const flung = Math.abs(v) >= o.speed && Math.sign(v) === Math.sign(offset);
			return offset !== 0 && (far || flung) ? side : 'back';
		},
		swallow() {
			if (!owed) return false;
			owed = false;
			return true;
		}
	};
}
