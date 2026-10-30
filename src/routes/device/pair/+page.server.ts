import { error } from '@sveltejs/kit';
import { pairedLink } from '$lib/app-mode';
import { getDance, isDanceSlug } from '$lib/dances/dances';
import { getDb } from '$lib/server/db';
import { createDeviceToken } from '$lib/server/devices';
import type { Actions } from './$types';

/**
 * Pairing an Android app. The app opens this page when it holds no token;
 * its WebView is already signed in, so one tap mints a token and hands it to
 * the app through `salsa://paired`. A POST rather than a load, so a prefetch or
 * a reload never mints a token nobody asked for.
 *
 * Each dance is its own app (`?dance=` says which), paired on its own, so
 * Settings names the app a token belongs to.
 */
export const actions: Actions = {
	default: ({ locals, url }) => {
		if (!locals.user) throw error(401);
		const dance = url.searchParams.get('dance') ?? '';
		const label = isDanceSlug(dance) ? `${getDance(dance).label} app` : 'Android app';
		const { token } = createDeviceToken(getDb(), locals.user.id, label, Date.now());
		return { link: pairedLink(token) };
	}
};
