/*
 * Wi-Fi, mobile data and free space (offline phase 4b). PURE, client-safe:
 * the device worker and the page pass their own `navigator` and estimate.
 * Android's WebView says what it is on (`navigator.connection.type`); the
 * iPhone and desktop browsers don't, and the page says so instead of the
 * Only on Wi-Fi switch.
 */

type Nav = { connection?: { type?: string } };
export type Link = 'unmetered' | 'metered' | 'unknown';

const UNMETERED = ['wifi', 'ethernet'];
const METERED = ['cellular', 'bluetooth', 'wimax'];

export function linkOf(nav: Nav): Link {
	const type = nav.connection?.type;
	if (type && UNMETERED.includes(type)) return 'unmetered';
	if (type && METERED.includes(type)) return 'metered';
	return 'unknown';
}

/** Whether this browser says what it is on at all. */
export function canTellWifi(nav: Nav): boolean {
	return typeof nav.connection?.type === 'string';
}

/** Videos may come now. Unknown counts as allowed: the page says so where it can't tell. */
export function videosMayCome(link: Link, wifiOnly: boolean): boolean {
	return !(wifiOnly && link === 'metered');
}

/** Below this much free, the phone is short of space and no download starts. */
export const LOW_SPACE_BYTES = 500 * 1024 * 1024;

/** Free for this app, from `navigator.storage.estimate()`; null when it says nothing. */
export function freeOf(e: { quota?: number; usage?: number } | null): number | null {
	if (!e || typeof e.quota !== 'number') return null;
	return Math.max(0, e.quota - (e.usage ?? 0));
}

export function isLow(free: number | null): boolean {
	return free !== null && free < LOW_SPACE_BYTES;
}

/** Whether `bytes` more still leave LOW_SPACE_BYTES free; true when free is unknown. */
export function fits(free: number | null, bytes: number): boolean {
	return free === null || free - bytes >= LOW_SPACE_BYTES;
}
