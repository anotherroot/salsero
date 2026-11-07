import { deviceOf } from '$lib/app-update/agent';
import { getAppCards } from '$lib/app-update/get-app';
import { inviteQr } from '$lib/server/invites';
import { currentRelease } from '$lib/server/releases';
import type { PageServerLoad } from './$types';

/** Get the app: the app of this host's dance only (each dance is its own app, the dance split). */
export const load: PageServerLoad = async ({ request, url, parent }) => {
	const device = deviceOf(request.headers.get('user-agent'));
	const { appDance: dance } = await parent();
	return {
		device,
		cards: getAppCards(device, { [dance]: currentRelease(dance) }),
		qr: device === 'other' ? inviteQr(`${url.origin}/app`) : null
	};
};
