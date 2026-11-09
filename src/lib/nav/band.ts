/** Where the slim band takes over before the page has measured itself: the big band's height. */
export const BAND_FULL_H = 148;
export const BAND_COMPACT_H = 112;

/** How many px of scroll the slim band takes to come in, ending where it pins. */
export const BAND_FADE = 40;

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
 * How far the slim band has come in, 0 to 1: it follows the scroll over the last
 * `BAND_FADE` px before it pins, so it is picked up as the page moves, never
 * popped in after.
 */
export function slimFade(scrollY: number, compact: boolean, pinAt: number | null = null): number {
	const at = pinFrom(compact, pinAt);
	// A short band pins sooner than the fade is long: the fade starts at the top, not before it.
	const from = Math.max(0, at - BAND_FADE);
	if (at <= from) return scrollY >= at ? 1 : 0;
	return Math.min(1, Math.max(0, (scrollY - from) / (at - from)));
}

const pinFrom = (compact: boolean, pinAt: number | null) =>
	pinAt ?? (compact ? BAND_COMPACT_H : BAND_FULL_H);
