import type { DanceSlug } from '$lib/dances/dances';
import { tabFor, type TabId } from './tabs';

/**
 * What surrounds a page on the desktop: the side with the tabs, nothing (the
 * Practice and share screens), a centred card (sign-in and friends), or no
 * frame decision at all (the dev kit, an unknown route).
 */
export type Frame = 'side' | 'bare' | 'card' | 'none';

const SHARED_SIDE = new Set(['/settings', '/settings/storage', '/voice', '/admin']);
const BARE = new Set(['/[dance]/player', '/[dance]/share']);
const CARD = new Set(['/login', '/join', '/welcome', '/app', '/device/pair', '/g/[code]']);

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the signature the frame's callers use
export function frameOf(routeId: string | null, _signedIn: boolean): Frame {
	if (routeId === null) return 'none';
	if (BARE.has(routeId)) return 'bare';
	if (routeId === '/[dance]' || routeId.startsWith('/[dance]/')) return 'side';
	if (SHARED_SIDE.has(routeId)) return 'side';
	if (CARD.has(routeId)) return 'card';
	return 'none';
}

/** Which side entry is lit: a tab inside the dance, Settings for the shared pages. */
export function sideLit(path: string, dance: DanceSlug): TabId | 'settings' | null {
	if (SHARED_SIDE.has(path)) return 'settings';
	return tabFor(path, dance);
}

/**
 * How wide page content grows on the desktop before it stops, centred in the
 * sheet or pane (desktop spec, "The sheet"): two columns, one column, a song (a
 * lesson being edited, Practice's setup), and errors and share. Padding is extra.
 */
export const PAGE_WIDTH = { one: 720, two: 1140, song: 640, narrow: 560 } as const;
export type PageWidth = keyof typeof PAGE_WIDTH;
