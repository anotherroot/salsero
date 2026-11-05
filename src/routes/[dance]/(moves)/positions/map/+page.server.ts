import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { wallOf } from '$lib/server/scope';
import { groupModeOf } from '$lib/server/group-mode';
import { mapData } from '$lib/server/positions-map';
import type { PageServerLoad } from './$types';

/** The map (`mapData`), under its own key: the layouts' `groupMode` is another thing. */
export const load: PageServerLoad = ({ params, locals, cookies }) => {
	if (!locals.user) throw error(401);
	const wall = wallOf(params, locals);
	const db = getDb();
	return { map: mapData(db, wall, groupModeOf(db, wall.userId, wall.dance, cookies)) };
};
