import { redirect } from '@sveltejs/kit';
import { DANCE_COOKIE, DEFAULT_DANCE, isDanceSlug } from '$lib/dances/dances';
import type { PageServerLoad } from './$types';

/**
 * `/` is not a page, it is the door: it sends you to whichever dance you were
 * last in. The memory is a cookie rather than a column on `users`, deliberately
 * — per-device is the behaviour wanted, with the work PC parked on salsa while
 * the phone is on bachata.
 */
export const load: PageServerLoad = ({ cookies }) => {
	const last = cookies.get(DANCE_COOKIE);
	throw redirect(303, `/${last && isDanceSlug(last) ? last : DEFAULT_DANCE}`);
};
