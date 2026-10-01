/**
 * The arithmetic of dragging a card through a list. DOM-free, in the manner of
 * `src/lib/longpress.ts`: the component measures, feeds numbers in, and draws
 * what comes out — so the part that is easy to get wrong is the part tested.
 */

/**
 * Where the dragged card would land: the number of OTHER cards whose middle it
 * has passed. `centers` are measured once, at the start of the drag, in page
 * coordinates; `y` is the dragged card's middle now.
 */
export function dropIndex(centers: number[], y: number, from: number): number {
	let to = 0;
	centers.forEach((c, i) => {
		if (i !== from && c < y) to++;
	});
	return to;
}

/** How far card `i` slides to open a gap at `to`: one card-and-gap `step`, or nothing. */
export function shiftFor(i: number, from: number, to: number, step: number): number {
	if (i === from) return 0;
	if (from < to && i > from && i <= to) return -step;
	if (to < from && i >= to && i < from) return step;
	return 0;
}

/**
 * Pixels to scroll this frame while the pointer is within `edge` of the
 * viewport's top or bottom — faster the closer it gets, up to `max`.
 */
export function autoScroll(y: number, top: number, bottom: number, edge = 72, max = 16): number {
	if (y < top + edge) return -Math.round(max * Math.min(1, (top + edge - y) / edge));
	if (y > bottom - edge) return Math.round(max * Math.min(1, (y - (bottom - edge)) / edge));
	return 0;
}

/** A copy of `list` with the item at `from` moved to `to`. */
export function moved<T>(list: T[], from: number, to: number): T[] {
	const out = [...list];
	const [item] = out.splice(from, 1);
	out.splice(to, 0, item);
	return out;
}
