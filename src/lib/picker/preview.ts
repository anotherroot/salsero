/**
 * The picture on a picker row (picker preview): what the tile draws. PURE and
 * client-safe; the component is `components/picker/PreviewButton.svelte`.
 */
import type { Picture } from '$lib/types';

/**
 * How a row offers its preview: the moving picture (option C), or an eye
 * before the + (option A, the fallback the user asked for if C does not work
 * well). One switch; the sheet is the same either way.
 */
export const PREVIEW_LOOK: 'tile' | 'eye' = 'tile';

/** The still, never the strip: Reduce motion, or the browser asked to save data. */
export const stillOnly = (env: { reducedMotion: boolean; saveData: boolean }): boolean =>
	env.reducedMotion || env.saveData;

export type TileShows = { kind: 'empty' } | { kind: 'still' | 'strip'; src: string };

/** What the tile draws: the strip, the still, or the empty tile (no picture, or it would not load). */
export function tileShows(picture: Picture, s: { still: boolean; failed: boolean }): TileShows {
	if (!picture || s.failed) return { kind: 'empty' };
	return s.still ? { kind: 'still', src: picture.still } : { kind: 'strip', src: picture.clip };
}

/**
 * Whether this picture failed to load: the tile remembers WHICH picture failed
 * (`failedFor`, its strip), since a row's tile is reused for another figure as
 * a search narrows the list.
 */
export const failedNow = (failedFor: string | null, picture: Picture): boolean =>
	picture !== null && failedFor === picture.clip;
