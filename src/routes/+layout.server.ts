import { DANCE_COOKIE, DEFAULT_DANCE, isDanceSlug } from '$lib/dances/dances';
import type { LayoutServerLoad } from './$types';

/**
 * The shell's data, for every page including the ones outside `[dance]`.
 *
 * `lastDance` is what the tab bar points at on the shared pages — `/settings`
 * and `/voice` have no dance in their URL, and a tab bar that led nowhere would
 * strand you there. It reads the same cookie `/` redirects by, so Settings
 * sends you back to the dance you came from rather than always to salsa.
 */
export const load: LayoutServerLoad = ({ locals, cookies }) => {
	const last = cookies.get(DANCE_COOKIE);
	return {
		user: locals.user,
		lastDance: last && isDanceSlug(last) ? last : DEFAULT_DANCE
	};
};
