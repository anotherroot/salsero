/**
 * A swipe on a card that reveals a button underneath it — Delete on one side,
 * Open on the other. DOM-free, in the manner of `src/lib/longpress.ts`: the
 * component feeds pointer positions and asks where to draw and where to settle.
 *
 * The direction locks once the pointer has moved `lockPx`. Mostly vertical is
 * a page scroll and stays one for the rest of the gesture — a swipe that
 * started while the thumb was scrolling is the swipe nobody meant.
 */

/** Which way the card is swiped open: 'left' shows the right-hand button. */
export type Side = 'left' | 'right' | null;

export interface SwipeOptions {
	/** The button's width: how far an open card rests from home. */
	reveal: number;
	lockPx: number;
	/** Fraction of `reveal` past which a release snaps open. */
	snap: number;
	/** Which sides have a button. A function, so a card's buttons can change without a new swipe. */
	sides: () => { left: boolean; right: boolean };
}

export interface Swipe {
	down(x: number, y: number, open: Side): void;
	/** The card's offset to draw, or null while undecided or once this is a scroll. */
	move(x: number, y: number): number | null;
	/** Where to settle; undefined when it was never a swipe (a tap, or a scroll). */
	up(): Side | undefined;
	/** True once, for the click that follows a swipe — it must not also tap the card. */
	swallow(): boolean;
}

export function swipe(o: SwipeOptions): Swipe {
	let origin: { x: number; y: number; base: number } | null = null;
	let axis: 'x' | 'y' | null = null;
	let offset = 0;
	let owed = false;

	return {
		down(x, y, open) {
			// A new gesture: whatever click the last swipe owed has come or never will.
			owed = false;
			axis = null;
			const base = open === 'left' ? -o.reveal : open === 'right' ? o.reveal : 0;
			origin = { x, y, base };
			offset = base;
		},
		move(x, y) {
			if (!origin || axis === 'y') return null;
			const dx = x - origin.x;
			const dy = y - origin.y;
			if (axis === null) {
				if (Math.hypot(dx, dy) < o.lockPx) return null;
				axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
				if (axis === 'y') return null;
			}
			const { left, right } = o.sides();
			// A little past the button, then it stops: elastic enough to feel, not
			// so loose the card can be flung off.
			const min = left ? -o.reveal * 1.25 : 0;
			const max = right ? o.reveal * 1.25 : 0;
			offset = Math.min(max, Math.max(min, origin.base + dx));
			return offset;
		},
		up() {
			const was = origin;
			origin = null;
			if (!was || axis !== 'x') return undefined;
			owed = true;
			if (offset <= -o.reveal * o.snap) return 'left';
			if (offset >= o.reveal * o.snap) return 'right';
			return null;
		},
		swallow() {
			if (!owed) return false;
			owed = false;
			return true;
		}
	};
}
