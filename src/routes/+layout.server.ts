import { APP_COOKIE, APP_PARAM, APP_VALUE } from '$lib/app-mode';
import { requestDanceOf } from '$lib/server/hosts';
import { THEME_COOKIE, themeChoice } from '$lib/theme/scheme';
import { updateState } from '$lib/app-update/agent';
import type { AppUpdate } from '$lib/app-update/view';
import { currentRelease } from '$lib/server/releases';
import type { LayoutServerLoad } from './$types';

/**
 * The shell's data, for every page including the ones outside `[dance]`.
 *
 * `appDance` is the dance this request belongs to (the dance split): the
 * signed-in account's, else the host's, else, on an unmapped host (dev), the
 * path's, `next`'s or `?dance=`. The shared pages (`/settings`, `/voice`, login)
 * have no dance in their URL and draw it from this.
 *
 * `app` is true inside the Android app (see `$lib/app-mode.ts`): pages then
 * hand videos to the native side by link instead of uploading them themselves.
 *
 * `locale` is the language this request is drawn in; the root layout hands it to
 * `setClientLocale` before anything renders.
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
	return {
		user: locals.user,
		appUpdate,
		appDance: requestDanceOf(url, locals.user),
		// Light, dark or system (Settings): the theme-color tags and the Settings row read it.
		theme: themeChoice(cookies.get(THEME_COOKIE)),
		// The language the hook chose for this request (`requestLocale`): the client draws in it too.
		locale: locals.locale,
		// The query too: the hook sets the cookie on this very response, so the
		// first page of a launch cannot read it back yet.
		app: cookies.get(APP_COOKIE) === APP_VALUE || url.searchParams.get(APP_PARAM) === APP_VALUE
	};
};
