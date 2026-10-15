import { APP_COOKIE, APP_PARAM, APP_VALUE } from '$lib/app-mode';
import { DANCE_COOKIE, DEFAULT_DANCE, isDanceSlug } from '$lib/dances/dances';
import type { LayoutServerLoad } from './$types';

/**
 * The shell's data, for every page including the ones outside `[dance]`.
 *
 * `lastDance` is what the tab bar points at on the shared pages — `/settings`
 * and `/voice` have no dance in their URL, and a tab bar that led nowhere would
 * strand you there. It reads the same cookie `/` redirects by, so Settings
 * sends you back to the dance you came from rather than always to salsa.
 *
 * `app` is true inside the Android app (see `$lib/app-mode.ts`): pages then
 * hand videos to the native side by link instead of uploading them themselves.
 */
export const load: LayoutServerLoad = ({ locals, cookies, url }) => {
	const last = cookies.get(DANCE_COOKIE);
	return {
		user: locals.user,
		lastDance: last && isDanceSlug(last) ? last : DEFAULT_DANCE,
		// The query too: the hook sets the cookie on this very response, so the
		// first page of a launch cannot read it back yet.
		app: cookies.get(APP_COOKIE) === APP_VALUE || url.searchParams.get(APP_PARAM) === APP_VALUE
	};
};
