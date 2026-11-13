/**
 * The picture on a picker row (picker preview, revision 2026-11-13): what the
 * tile draws and when its clip may play. PURE and client-safe; the component
 * is `components/picker/PreviewButton.svelte`, the scheduler `motion.ts`.
 */
import type { Picture } from '$lib/types';

/**
 * How a row offers its preview: the moving picture (option C), or an eye
 * before the + (option A, the fallback the user asked for if C does not work
 * well). One switch; the sheet is the same either way.
 */
export const PREVIEW_LOOK: 'tile' | 'eye' = 'tile';

/** At most this many tiles play their clip at once; the rest show their still (older phones). */
export const MAX_PLAYING = 4;

/**
 * Stills only, never a clip: Reduce motion, Data Saver, or a weak phone (2 GB of
 * memory or less, 4 cores or fewer, as the browser reports them; unknown is not weak).
 */
export function stillOnly(env: {
	reducedMotion: boolean;
	saveData: boolean;
	deviceMemory?: number;
	cores?: number;
}): boolean {
	if (env.reducedMotion || env.saveData) return true;
	if (env.deviceMemory !== undefined && env.deviceMemory <= 2) return true;
	return env.cores !== undefined && env.cores <= 4;
}

/** The tiles that may play: the first `MAX_PLAYING` on screen, in list order; none while the list scrolls. */
export function granted<T>(onScreen: readonly T[], scrolling: boolean): Set<T> {
	return new Set(scrolling ? [] : onScreen.slice(0, MAX_PLAYING));
}

export type TileShows =
	| { kind: 'empty' }
	| { kind: 'still'; still: string }
	| { kind: 'clip'; clip: string; still: string };

/** What the tile draws: the clip over its still while it may play, the still, or the empty tile. */
export function tileShows(
	picture: Picture,
	s: { playing: boolean; failed: 'clip' | 'still' | null }
): TileShows {
	if (!picture || s.failed === 'still') return { kind: 'empty' };
	if (s.playing && s.failed !== 'clip') return { kind: 'clip', ...picture };
	return { kind: 'still', still: picture.still };
}

/**
 * What of this picture would not load: the tile remembers WHICH picture failed
 * (`for`, its clip), since a row's tile is reused for another figure as a search
 * narrows the list.
 */
export const failedNow = (
	failed: { for: string; what: 'clip' | 'still' } | null,
	picture: Picture
): 'clip' | 'still' | null =>
	picture !== null && failed !== null && failed.for === picture.clip ? failed.what : null;
