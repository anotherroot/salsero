import { error } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { canonicalOf, graphFor } from '$lib/server/graph';
import { usableOf } from '$lib/server/usable';
import { storedTwinSets } from '$lib/server/twins';
import { wallOf, type Space } from '$lib/server/scope';
import { groupModeOf } from '$lib/server/group-mode';
import { noPosition, positionCounts } from '$lib/graph/graph';
import { DANCES } from '$lib/dances/dances';
import { layoutMap, mapInputOf, mapLabel } from '$lib/positions/map';
import { legendTypes, styleTone } from '$lib/positions/map-view';
import { mapLabelFor, mapNodeName, mapSummary } from '$lib/positions/view';
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

	// Twins (Same as…) are a person's own; Task 27 draws a set as one node, until
	// then each member carries the mark.
	const twinIds = new Set<number>(
		mode
			? []
			: storedTwinSets(db, wall.userId, 'position')
					.flat()
					.map((id) => canonicalOf(graph, id))
	);
	const input = mapInputOf(graph, twinIds);
	if (mode) {
		// The gap report is the person's own, as on the list: group mode marks no
		// dead end or orphan. An island still goes to the tray: it cannot be drawn.
		for (const p of input.positions)
			if (p.gaps) p.gaps = { ...p.gaps, deadEnd: false, orphan: false };
	}
	const layout = layoutMap(input);

	const styles = DANCES[dance].styles;
	const counts = new Map(
		positionCounts(
			graph,
			input.positions.map((p) => p.id)
		).map((c) => [c.id, c])
	);
	const marks = new Map(layout.nodes.map((nd) => [nd.id, nd.mark]));
	const positions = input.positions.map((p) => {
		const c = counts.get(p.id)!;
		return {
			id: p.id,
			name: p.name,
			label: mapLabel(p.name),
			styleTag: p.styleTag,
			tone: styleTone(p.styleTag, styles),
			ins: c.inCount,
			outs: c.outCount,
			ariaLabel: mapNodeName({
				name: p.name,
				ins: c.inCount,
				outs: c.outCount,
				mark: marks.get(p.id) ?? null,
				twins: p.twins ?? false
			})
		};
	});
	const figuresOf = new Map(input.edges.map((e) => [`${e.from}:${e.to}`, e.figures]));
	const edges = layout.edges.map((e) => ({ ...e, figures: figuresOf.get(`${e.from}:${e.to}`)! }));

	const none = noPosition(graph);
	const stranded = mode
		? 0
		: input.positions.filter((p) => p.gaps && (p.gaps.deadEnd || p.gaps.orphan || p.gaps.island))
				.length;
	return {
		empty: positions.length === 0,
		layout,
		positions,
		edges,
		noPosition: none.none.length + none.onlyStart.length + none.onlyEnd.length,
		summary: mapSummary({
			positions: positions.length,
			between: graph.figures.filter((f) => f.starts.length > 0 && f.ends.length > 0).length,
			none: none.none.length,
			stranded
		}),
		types: legendTypes(
			styles,
			DANCES[dance].styleLabel,
			positions.some((p) => p.tone === 'muted' && !styles.includes(p.styleTag ?? ''))
		),
		mapLabel: mapLabelFor(mode !== null),
		groupMode: mode !== null
	};
};
