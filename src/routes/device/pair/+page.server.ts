import { error } from '@sveltejs/kit';
import { pairedLink } from '$lib/app-mode';
import { getDance } from '$lib/dances/dances';
import { getDb } from '$lib/server/db';
import { createDeviceToken } from '$lib/server/devices';
import type { Actions } from './$types';
import { serverNow } from '$lib/server/server-clock';

/**
 * Pairing an Android app. The app opens this page when it holds no token;
 * its WebView is already signed in, so one tap mints a token and hands it to
 * the app through `salsa://paired`. A POST rather than a load, so a prefetch or
 * a reload never mints a token nobody asked for.
 *
 * Each dance is its own app with its own accounts, paired on its own, so
 * Settings names the app a token belongs to by the account's dance.
 */
export const actions: Actions = {
	default: ({ locals }) => {
		if (!locals.user) throw error(401);
		// The account's own dance names the app (the dance split): "Bachata app".
		const label = `${getDance(locals.user.dance).label} app`;
		const { token } = createDeviceToken(getDb(), locals.user.id, label, serverNow());
		return { link: pairedLink(token) };
	}
};
