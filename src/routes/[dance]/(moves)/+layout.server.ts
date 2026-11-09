import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { localDay } from '$lib/day/day';
import { viewOf } from '$lib/server/group-mode';
import { figuresLists, positionsLists, routinesList } from '$lib/server/moves-lists';
import type { LayoutServerLoad } from './$types';
import { serverNow } from '$lib/server/server-clock';

/**
 * The Figures, Routines and Positions lists, once and unfiltered, for the list
 * pages and for an item open beside one (desktop: the list column is the
 * layout's). The filters are pure and run where the list is drawn, so of the
 * URL this reads only `in` (`viewOf`): a search does not rerun it. Opening an
 * item does, since the column follows the open row's view (group view spec).
 * Namespaced under `lists`, so it never collides with an item page's own data keys.
 *
 * Forms rerun it (`invalidateAll`); a change made without one (a position made
 * from a figure's picker) reruns this load alone: `invalidate('app:moves')`.
 */
export const load: LayoutServerLoad = ({ params, locals, depends, route, url }) => {
	if (!locals.user) throw error(401);
	depends('app:moves');
	const db = getDb();
	const wall = wallOf(params, locals);
	const mode = viewOf(db, wall, locals.user?.level, { route, params, url });
	return {
		lists: {
			figures: figuresLists(db, wall, mode),
			routines: routinesList(db, wall, mode, localDay(serverNow(), locals.user.timezone)),
			positions: positionsLists(db, wall, mode)
		}
	};
};
