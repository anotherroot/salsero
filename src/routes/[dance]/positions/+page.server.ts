import { getDb } from '$lib/server/db';
import { buildGraph, taggedFigures } from '$lib/server/graph';
import { positionCounts } from '$lib/graph/graph';
import { listPositions, positionSummary } from '$lib/server/positions';
import { spaceOf } from '$lib/server/group-mode';
import type { PageServerLoad } from './$types';

/** A load-only stub until the list is rewritten: the space's own positions, read-only. */
export const load: PageServerLoad = ({ params, locals, cookies }) => {
	const db = getDb();
	const space = spaceOf(db, params, locals, cookies);
	const inGroup = 'teamId' in space;
	const rows = listPositions(db, space);
	const counts = positionCounts(
		buildGraph(db, space),
		rows.map((p) => p.id)
	);
	const byId = new Map(counts.map((c) => [c.id, c]));
	return {
		isAdmin: locals.user?.isAdmin === true,
		positions: rows.map((p) => ({
			...positionSummary(p, space),
			...byId.get(p.id)!,
			// The gap report is hidden in group mode.
			...(inGroup ? { deadEnd: false, orphan: false } : {})
		})),
		groupMode: inGroup,
		tagged: taggedFigures(db, space)
	};
};
