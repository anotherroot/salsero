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
