import { requireAdmin } from '$lib/server/scope';
import { getDb } from '$lib/server/db';
import { createInvite, inviteQr } from '$lib/server/invites';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
	requireAdmin(locals);
	const { lastDance } = await parent();
	return { dance: lastDance };
};

export const actions: Actions = {
	/** Makes a new code (and ends the previous unused one); the code is only in this response. */
	invite: async ({ locals, url }) => {
		requireAdmin(locals);
		const { code, expiresAt } = createInvite(getDb(), locals.user!.id, Date.now());
		const link = `${url.origin}/join?code=${code}`;
		return { url: link, qr: inviteQr(link), expiresAt };
	}
};
