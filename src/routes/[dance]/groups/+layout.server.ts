import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { listMyTeams } from '$lib/server/teams';
import { whatsNew } from '$lib/server/whats-new';
import type { LayoutServerLoad } from './$types';

/**
 * The Groups list, once, for the list page and for a group (or its People,
 * storage, History, Recently deleted) open beside it (desktop: the list column
 * is the layout's). Only the person's own groups in this dance, as the list
 * page always read them. Reads `params.dance` and `locals` only, so opening
 * another group does not rerun it; a form in the pane reruns it (`invalidateAll`),
 * so renaming, leaving, deleting and restoring refresh the column.
 */
export const load: LayoutServerLoad = ({ params, locals }) => {
	const wall = wallOf(params, locals);
	const db = getDb();
	const fresh = whatsNew(db, wall.userId, wall.dance).byTeam;
	return {
		teams: listMyTeams(db, wall.userId, wall.dance).map((t) => ({
			...t,
			newCount: fresh.get(t.id) ?? 0
		}))
	};
};
