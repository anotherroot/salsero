/** The band's height at the top of a screen: the 46 px title, or the 30 px one. */
export const BAND_FULL_H = 148;
export const BAND_COMPACT_H = 112;

export type BandMode = 'full' | 'compact' | 'slim';

/**
 * Which band to show: the big one at the top, the slim one once it has scrolled
 * away. On the desktop the band is the fixed 88 px row and never goes slim.
 */
export function bandMode(scrollY: number, compact: boolean, desk: boolean): BandMode {
	if (!desk && scrollY >= (compact ? BAND_COMPACT_H : BAND_FULL_H)) return 'slim';
	return compact ? 'compact' : 'full';
}
