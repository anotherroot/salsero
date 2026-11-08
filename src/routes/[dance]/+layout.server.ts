import { error } from '@sveltejs/kit';
import { getDance, isDanceSlug } from '$lib/dances/dances';
import { getDb } from '$lib/server/db';
import { whatsNew } from '$lib/server/whats-new';
import { importsWaiting } from '$lib/server/song-imports';
import { groupChoices, groupModeOf } from '$lib/server/group-mode';
import { outsideGroupMode } from '$lib/teams/mode';
import type { GroupChoice, GroupMode } from '$lib/types';
import type { LayoutServerLoad } from './$types';

/**
 * The gate for every dance-scoped page: an unknown slug is a 404, not a
 * silent fall back to salsa, so a typo can never quietly show the wrong
 * dance's data, and a dance not the account's own is a 404 too. It also says
 * whether group mode is on (never on Today's pages) and which groups the
 * person may switch into.
 *
 * It never sets or deletes the group cookie on its own account: a load also
 * runs on hover and touch preload, so brushing a tab would switch modes
 * behind the person's back. Only the switch action does (Mine, Work in);
 * `groupModeOf` drops a cookie that is no longer valid, and that is all.
 */
export const load: LayoutServerLoad = ({ params, cookies, url, locals }) => {
	if (!isDanceSlug(params.dance)) throw error(404, 'No such dance');
	const dance = params.dance;
	// An account belongs to one dance (the dance split): the other is a stranger's.
	if (locals.user && locals.user.dance !== dance) throw error(404, 'Not found');
	let groupMode: GroupMode | null = null;
	let choices: GroupChoice[] = [];
	let groupsNew = false;
	let musicToPick = false;
	if (locals.user) {
		const db = getDb();
		if (!outsideGroupMode(url.pathname, dance))
			groupMode = groupModeOf(db, locals.user.id, dance, cookies, locals.user.level);
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
		// Derived, never stored: a read playlist of theirs, or of a group they edit, not yet picked.
		musicToPick = importsWaiting(db, locals.user.id, dance);
	}
	return { dance: getDance(dance), groupMode, groupChoices: choices, groupsNew, musicToPick };
};
