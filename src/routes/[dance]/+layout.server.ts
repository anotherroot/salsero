import { error } from '@sveltejs/kit';
import { DANCE_COOKIE, getDance, isDanceSlug } from '$lib/dances/dances';
import { getDb } from '$lib/server/db';
import { whatsNew } from '$lib/server/whats-new';
import { groupChoices, groupModeOf } from '$lib/server/group-mode';
import { groupCookie, leavesGroupMode } from '$lib/teams/mode';
import type { GroupChoice, GroupMode } from '$lib/types';
import type { LayoutServerLoad } from './$types';

/**
 * The gate for every dance-scoped page: an unknown slug is a 404, not a
 * silent fall back to salsa, so a typo can never quietly show the wrong
 * dance's data. Visiting a dance also remembers it, which is what `/`
 * redirects to next time. It also says whether group mode is on (Today
 * always switches it off) and which groups the person may switch into.
 */
export const load: LayoutServerLoad = ({ params, cookies, url, locals }) => {
	if (!isDanceSlug(params.dance)) throw error(404, 'No such dance');
	const dance = params.dance;
	cookies.set(DANCE_COOKIE, dance, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 60 * 60 * 24 * 365
	});
	let groupMode: GroupMode | null = null;
	let choices: GroupChoice[] = [];
	let groupsNew = false;
	if (locals.user) {
		const db = getDb();
		if (leavesGroupMode(url.pathname, dance)) cookies.delete(groupCookie(dance), { path: '/' });
		else groupMode = groupModeOf(db, locals.user.id, dance, cookies);
		choices = groupChoices(db, locals.user.id, dance);
		// Read from the path so it reruns on every navigation: the item this
		// response opens must not count itself (the page records the open).
		const opened = /^\/[^/]+\/(lessons|songs)\/(\d+)\/?$/.exec(url.pathname);
		const opening = opened
			? {
					kind: opened[1] === 'lessons' ? ('lesson' as const) : ('song' as const),
					id: Number(opened[2])
				}
			: undefined;
		groupsNew = whatsNew(db, locals.user.id, dance, opening).byTeam.size > 0;
	}
	return { dance: getDance(dance), groupMode, groupChoices: choices, groupsNew };
};
