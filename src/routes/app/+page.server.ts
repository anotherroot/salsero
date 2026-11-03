import { deviceOf } from '$lib/app-update/agent';
import { getAppCards } from '$lib/app-update/get-app';
import { DANCE_SLUGS, type DanceSlug } from '$lib/dances/dances';
import { inviteQr } from '$lib/server/invites';
import { currentRelease } from '$lib/server/releases';
import type { Release } from '$lib/app-update/agent';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, url }) => {
	const device = deviceOf(request.headers.get('user-agent'));
	const releases = Object.fromEntries(DANCE_SLUGS.map((d) => [d, currentRelease(d)])) as Record<
		DanceSlug,
		Release | null
	>;
	return {
		device,
		cards: getAppCards(device, releases),
		qr: device === 'other' ? inviteQr(`${url.origin}/app`) : null
	};
};
