/**
 * Which of the player's three layouts a viewport gets. PURE.
 *
 * - portrait: the video at full width, every control below it;
 * - landscape (a phone on its side): the video fills the screen, controls
 *   float over it, the editor and the list are a panel beside it;
 * - desktop: the video, a sidebar, and the keys.
 */
export type PlayerLayout = 'portrait' | 'landscape' | 'desktop';

/** A landscape viewport shorter than this is a phone on its side. */
export const LANDSCAPE_MAX_H = 520;

export function layoutFor(width: number, height: number): PlayerLayout {
	if (height > width) return 'portrait';
	return height < LANDSCAPE_MAX_H ? 'landscape' : 'desktop';
}
