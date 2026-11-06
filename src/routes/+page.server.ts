import { redirect } from '@sveltejs/kit';
import { DANCE_COOKIE, DANCE_SLUGS, DEFAULT_DANCE, isDanceSlug } from '$lib/dances/dances';
import { getDb } from '$lib/server/db';
import { danceWithClass } from '$lib/server/join-code';
import type { PageServerLoad } from './$types';

/**
 * `/` is not a page, it is the door: it sends you to whichever dance you were
 * last in. The memory is a cookie rather than a column on `users`, deliberately
 * — per-device is the behaviour wanted, with the work PC parked on salsa while
 * the phone is on bachata. At Follow my class the dance with a class wins when
 * the last one has none (levels spec, "Dances").
 */
export const load: PageServerLoad = ({ cookies, locals }) => {
	const cookie = cookies.get(DANCE_COOKIE);
	const last = cookie && isDanceSlug(cookie) ? cookie : DEFAULT_DANCE;
	const dance =
		locals.user?.level === 'follow'
			? danceWithClass(getDb(), locals.user.id, last, DANCE_SLUGS)
			: last;
	throw redirect(303, `/${dance}`);
};
