import { pendingCount } from '$lib/server/ai-queue/store';
import { t } from '$lib/i18n/catalog';
import { error } from '@sveltejs/kit';
import { getDance, isDanceSlug } from '$lib/dances/dances';
import { getDb } from '$lib/server/db';
import { whatsNew } from '$lib/server/whats-new';
import { importsWaiting } from '$lib/server/song-imports';
import { groupChoices, viewOf } from '$lib/server/group-mode';
import type { GroupChoice, GroupMode } from '$lib/types';
import type { LayoutServerLoad } from './$types';

/**
 * The gate for every dance-scoped page: an unknown slug is a 404, not a
 * silent fall back to salsa, so a typo can never quietly show the wrong
 * dance's data, and a dance not the account's own is a 404 too. It also says
 * which group's view the page is in (`viewOf`: a page of one thing by its row,
 * a list by its `in`, never Today's pages) and which groups the person may
 * switch into. It writes nothing: a load also runs on hover and touch preload.
 */
export const load: LayoutServerLoad = ({ params, url, route, locals }) => {
	if (!isDanceSlug(params.dance)) throw error(404, t().refusals.noDance);
	const dance = params.dance;
	// An account belongs to one dance (the dance split): the other is a stranger's.
	if (locals.user && locals.user.dance !== dance) throw error(404, t().refusals.notFound);
	let groupMode: GroupMode | null = null;
	let choices: GroupChoice[] = [];
	let groupsNew = false;
	let musicToPick = false;
	let aiPending = 0;
	if (locals.user) {
		const db = getDb();
		groupMode = viewOf(db, { userId: locals.user.id, dance }, locals.user.level, {
			route,
			params,
			url
		});
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
		// The AI's suggestions waiting to be run (the You tab's dot and its row).
		aiPending = pendingCount(db, locals.user.id, dance);
	}
	return {
		dance: getDance(dance),
		groupMode,
		groupChoices: choices,
		groupsNew,
		musicToPick,
		aiPending
	};
};
