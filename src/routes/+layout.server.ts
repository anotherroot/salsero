import { APP_COOKIE, APP_PARAM, APP_VALUE } from '$lib/app-mode';
import { DANCE_COOKIE, DEFAULT_DANCE, isDanceSlug } from '$lib/dances/dances';
import { THEME_COOKIE, themeChoice } from '$lib/theme/scheme';
import { updateState } from '$lib/app-update/agent';
import type { AppUpdate } from '$lib/app-update/view';
import { currentRelease } from '$lib/server/releases';
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
export const load: LayoutServerLoad = ({ locals, cookies, url, depends }) => {
	depends('app:update');
	let appUpdate: AppUpdate | null = null;
	const agent = locals.appAgent;
	if (agent) {
		const release = currentRelease(agent.dance);
		appUpdate = {
			state: updateState(agent, release),
			channel: agent.channel,
			dance: agent.dance,
			installed: agent.versionCode,
			latest: release
				? {
						versionCode: release.versionCode,
						versionName: release.versionName,
						url: `/releases/${agent.dance}/${release.versionCode}.apk`
					}
				: null
		};
	}
	const last = cookies.get(DANCE_COOKIE);
	return {
		user: locals.user,
		appUpdate,
		lastDance: last && isDanceSlug(last) ? last : DEFAULT_DANCE,
		// Light, dark or system (Settings): the theme-color tags and the Settings row read it.
		theme: themeChoice(cookies.get(THEME_COOKIE)),
		// The query too: the hook sets the cookie on this very response, so the
		// first page of a launch cannot read it back yet.
		app: cookies.get(APP_COOKIE) === APP_VALUE || url.searchParams.get(APP_PARAM) === APP_VALUE
	};
};
