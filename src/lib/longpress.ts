/**
 * A long press on a list row, for selection on a phone.
 *
 * Client-safe and free of the DOM, so its timing can be tested: the caller
 * feeds it pointer positions and asks, on each click, whether that click
 * belongs to a long press and must be swallowed — a long press that selects
 * a row must not also open it.
 */
export interface LongPress {
	/** A pointer went down on row `id` at (x, y). */
	down(id: number, x: number, y: number): void;
	/** The pointer moved; too far and it is a scroll, not a press. */
	move(x: number, y: number): void;
	/** The pointer was released or cancelled before the press fired. */
	up(): void;
	/** A click arrived: true when it is the tail of a long press and must be swallowed. */
	swallow(): boolean;
}

export function longPress(opts: {
	ms: number;
	tolerancePx: number;
	/** Whether a new press may start — a list already selecting takes taps instead. */
	enabled: () => boolean;
	onLongPress: (id: number) => void;
}): LongPress {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let origin: { x: number; y: number } | null = null;
	let fired = false;

	function cancel() {
		if (timer) clearTimeout(timer);
		timer = null;
		origin = null;
	}

	return {
		down(id, x, y) {
			// A new gesture: whatever click the last long press owed has come or
			// never will — a phone often sends none — so it must not eat this one.
			fired = false;
			if (!opts.enabled()) return;
			origin = { x, y };
			timer = setTimeout(() => {
				timer = null;
				fired = true;
				opts.onLongPress(id);
			}, opts.ms);
		},
		move(x, y) {
			if (!origin) return;
			if (Math.hypot(x - origin.x, y - origin.y) > opts.tolerancePx) cancel();
		},
		up: cancel,
		swallow() {
			if (!fired) return false;
			fired = false;
			return true;
		}
	};
}
