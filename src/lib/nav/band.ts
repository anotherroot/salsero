/** The band's height at the top of a screen: the 46 px title, or the 30 px one. */
export const BAND_FULL_H = 148;
export const BAND_COMPACT_H = 112;

export type BandMode = 'full' | 'compact' | 'slim';

/** Which band to show: the big one at the top, the slim one once it has scrolled away. */
export function bandMode(scrollY: number, compact: boolean): BandMode {
	if (scrollY >= (compact ? BAND_COMPACT_H : BAND_FULL_H)) return 'slim';
	return compact ? 'compact' : 'full';
}
