import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { youSettingsOf } from '$lib/server/you';
import type { PageServerLoad } from './$types';

/**
 * You at Follow my class: the settings rows alone (My class is its own tab).
 * Above it You is the Groups tab, and this page, reached by its address, still
 * shows the rows (levels hide entry points, never routes).
 */
export const load: PageServerLoad = ({ params, locals }) => {
	const wall = wallOf(params, locals);
	return { you: youSettingsOf(getDb(), wall.userId) };
};
