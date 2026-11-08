import { error } from '@sveltejs/kit';
import { count, eq, inArray } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { figures, recordings } from '$lib/server/db/schema';
import { canonicalOf, graphFor } from '$lib/server/graph';
import { figureLabels } from '$lib/server/figures';
import { figureAccess } from '$lib/server/access';
import { usableOf } from '$lib/server/usable';
import { wallOf, type Space } from '$lib/server/scope';
import { groupModeOf } from '$lib/server/group-mode';
import { noPosition } from '$lib/graph/graph';
import { DANCES } from '$lib/dances/dances';
import { styleLabelsOf } from '$lib/moves/figures';
import {
	noPositionGroups,
	noPositionHead,
	noPositionMeta,
	noPositionTag
} from '$lib/positions/view';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals, cookies }) => {
	if (!locals.user) throw error(401);
	const wall = wallOf(params, locals);
	const dance = wall.dance;
	const db = getDb();
	const mode = groupModeOf(db, wall.userId, dance, cookies);
	// The graph is the viewer's (ruling 14): their figures plus the group figures
	// they may use; in group mode, the group's.
	const space: Space = mode ? { dance, teamId: mode.teamId, actorId: wall.userId } : wall;
	const usable = mode ? undefined : usableOf(db, wall);
	const graph = graphFor(db, space, usable);

	const ids = graph.figures.map((f) => f.id);
	const rowsById = new Map(
		(ids.length === 0
			? []
			: db
					.select({
						id: figures.id,
						userId: figures.userId,
						teamId: figures.teamId,
						styleTag: figures.styleTag,
						startCount: figures.startCount,
						lengthCounts: figures.lengthCounts,
						recordings: count(recordings.id)
					})
					.from(figures)
					.leftJoin(recordings, eq(recordings.figureId, figures.id))
					.where(inArray(figures.id, ids))
					.groupBy(figures.id)
					.all()
		).map((r) => [r.id, r])
	);
	const labels = figureLabels(db, space, usable);
	const access = new Map<number, 'edit' | 'read'>();
	for (const f of graph.figures) {
		const row = rowsById.get(f.id);
		const a = row ? figureAccess(db, wall.userId, { ...row, id: f.id }) : null;
		if (a) access.set(f.id, a);
	}
	// Defence in depth: the graph is already the viewer's (a non-editor's group cookie
	// is refused, and `usableOf` holds only what they reach), so this drops nothing today.
	const shown = noPosition({
		...graph,
		figures: graph.figures.filter((f) => access.has(f.id))
	});
	const names = (ps: number[]) =>
		ps.map((p) => graph.positions.find((x) => x.id === canonicalOf(graph, p))?.name ?? '');
	const labelOf = styleLabelsOf(DANCES[dance].styleLabel);
	const byId = new Map(graph.figures.map((f) => [f.id, f]));

	const row = (id: number) => {
		const r = rowsById.get(id)!;
		const f = byId.get(id)!;
		const tag =
			f.ends.length > 0
				? noPositionTag('end', names(f.ends))
				: f.starts.length > 0
					? noPositionTag('start', names(f.starts))
					: null;
		return {
			id,
			label: labels.get(id) ?? '',
			meta: noPositionMeta(labelOf[r.styleTag ?? 'other'] ?? labelOf.other ?? '', r),
			tag,
			canEdit: access.get(id) === 'edit'
		};
	};
	const groups = noPositionGroups(shown).map((g) => ({
		title: g.title,
		rows: g.ids.map(row)
	}));
	return {
		head: noPositionHead({
			none: shown.none.length,
			onlyStart: shown.onlyStart.length,
			onlyEnd: shown.onlyEnd.length
		}),
		groups,
		empty: groups.length === 0,
		groupMode: mode !== null
	};
};
