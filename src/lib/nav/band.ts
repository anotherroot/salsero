/** Where the slim band takes over before the page has measured itself: the big band's height. */
export const BAND_FULL_H = 148;
export const BAND_COMPACT_H = 112;

export type BandMode = 'full' | 'compact' | 'slim';

/**
 * Which band to show: the big one at the top, the slim one from `pinAt` on. The
 * slim band takes the big one over where it would leave the screen: when the
 * sheet's top edge reaches the slim band's bottom (`pinAt` = the sheet's top
 * minus the slim band's height, measured by `Screen`), so the band stops and
 * stays rather than scrolling away first. Null before it is measured: the big
 * band's height. On the desktop the band is the fixed 88 px row and never goes slim.
 */
export function bandMode(
	scrollY: number,
	compact: boolean,
	desk: boolean,
	pinAt: number | null = null
): BandMode {
	if (!desk && scrollY >= pinFrom(compact, pinAt)) return 'slim';
	return compact ? 'compact' : 'full';
}

/**
 * How far the big band has folded into the slim one, 0 at the top to 1 where it
 * pins: the title shrinks and moves into the slim band's place over the whole
 * way (`components/shell/band-collapse.ts`), so at the pin the two are one.
 */
export function bandProgress(
	scrollY: number,
	compact: boolean,
	pinAt: number | null = null
): number {
	const at = pinFrom(compact, pinAt);
	if (at <= 0) return 1;
	return Math.min(1, Math.max(0, scrollY / at));
}

/** `a` at 0, `b` at 1. */
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

const pinFrom = (compact: boolean, pinAt: number | null) =>
	pinAt ?? (compact ? BAND_COMPACT_H : BAND_FULL_H);
