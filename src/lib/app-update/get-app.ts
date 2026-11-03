/** What the Get the app page offers a device. PURE and client-safe. */
import { DANCES, DANCE_SLUGS, type DanceSlug } from '$lib/dances/dances';
import { byteSize } from '$lib/format';
import type { Device, Release } from './agent';

export interface AppCard {
	dance: DanceSlug;
	label: string;
	download: { url: string; size: string } | null;
	open: string;
}

export function getAppCards(
	device: Device,
	releases: Record<DanceSlug, Release | null>
): AppCard[] {
	return DANCE_SLUGS.map((dance) => {
		const r = releases[dance];
		return {
			dance,
			label: DANCES[dance].label,
			download:
				device === 'android' && r
					? { url: `/releases/${dance}/${r.versionCode}.apk`, size: byteSize(r.size) }
					: null,
			open: `/${dance}`
		};
	});
}

/** Where a new account lands: inside the app it goes on; in a browser it is offered the app. */
export function joinLanding(inApp: boolean): '/' | '/app' {
	return inApp ? '/' : '/app';
}
