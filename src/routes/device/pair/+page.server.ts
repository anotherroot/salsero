import { error } from '@sveltejs/kit';
import { pairedLink } from '$lib/app-mode';
import { getDb } from '$lib/server/db';
import { createDeviceToken } from '$lib/server/devices';
import type { Actions } from './$types';

/**
 * Pairing the Android app. The app opens this page when it holds no token;
 * Chrome is already signed in, so one tap mints a token and hands it to the
 * app through `salsa://paired`. A POST rather than a load, so a prefetch or a
 * reload never mints a token nobody asked for.
 */
export const actions: Actions = {
	default: ({ locals }) => {
		if (!locals.user) throw error(401);
		const { token } = createDeviceToken(getDb(), locals.user.id, 'Android app', Date.now());
		return { link: pairedLink(token) };
	}
};
