import { redirect } from '@sveltejs/kit';
import { requestDanceOf } from '$lib/server/hosts';
import type { PageServerLoad } from './$types';

/**
 * `/` is not a page, it is the door: it opens the dance of this request, the
 * signed-in account's (an account belongs to one dance, the dance split), else
 * the host's, else the default.
 */
export const load: PageServerLoad = ({ locals, url }) => {
	throw redirect(303, `/${requestDanceOf(url, locals.user)}`);
};
