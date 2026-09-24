import { error } from '@sveltejs/kit';
import { DANCE_COOKIE, getDance, isDanceSlug } from '$lib/dances/dances';
import type { LayoutServerLoad } from './$types';

/**
 * The gate for every dance-scoped page: an unknown slug is a 404, not a
 * silent fall back to salsa, so a typo can never quietly show the wrong
 * dance's data. Visiting a dance also remembers it, which is what `/`
 * redirects to next time.
 */
export const load: LayoutServerLoad = ({ params, cookies, url }) => {
	if (!isDanceSlug(params.dance)) throw error(404, 'No such dance');
	cookies.set(DANCE_COOKIE, params.dance, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 60 * 60 * 24 * 365
	});
	return { dance: getDance(params.dance) };
};
