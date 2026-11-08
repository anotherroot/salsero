import { eq, inArray } from 'drizzle-orm';
import { figureGroups, figures, positions as positionsTable } from '$lib/server/db/schema';
import { graphFor } from '$lib/server/graph';
import { figureLabels } from '$lib/server/figures';
import { teamRefs, usableOf } from '$lib/server/usable';
import type { Db } from '$lib/server/db';
import type { Space, Wall } from '$lib/server/scope';
import { noPosition, positionCounts } from '$lib/graph/graph';
import { DANCES } from '$lib/dances/dances';
import { layoutMap, mapInputOf, mapLabel } from '$lib/positions/map';
import { legendTypes, styleTone, type MapData, type MapFig } from '$lib/positions/map-view';
import { mapTwinsLine } from '$lib/positions/view';
import { t } from '$lib/i18n/catalog';
import type { GroupMode } from '$lib/types';

/**
 * The map of a person's positions (or, in group mode, the group's): the
 * graph laid out, what each node is called and coloured, the arrows' figure
 * counts, the tray, the summary and the legend. The map route loads it, and so
 * does the Positions list, whose pane on the desktop is the map.
 */
export function mapData(db: Db, wall: Wall, mode: GroupMode | null): MapData {
	const dance = wall.dance;
	// The graph is the viewer's (ruling 14): their figures plus the group figures
	// they may use; in group mode, the group's.
	const space: Space = mode ? { dance, teamId: mode.teamId, actorId: wall.userId } : wall;
	const usable = mode ? undefined : usableOf(db, wall);
	const graph = graphFor(db, space, usable);

	// Twins (Same as…) are a person's own, and the graph reads each set as one
	// position (ruling 16): one node, marked, whose line names who it stands for.
	const input = mapInputOf(graph);
	const twinsLines = twinsLinesOf(db, graph.twinned);
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
			twinsLine: twinsLines.get(p.id) ?? null,
			ariaLabel: t().map.nodeName({
				name: p.name,
				ins: c.inCount,
				outs: c.outCount,
				mark: marks.get(p.id) ?? null,
				twins: twinsLines.get(p.id) ?? null
			})
		};
	});
	const figuresOf = new Map(input.edges.map((e) => [`${e.from}:${e.to}`, e.figures]));

	// Each figure on its arrows, from the same graph (ids already folded).
	const labels = figureLabels(db, space, usable);
	const moves = new Map<number, string>(
		graph.figures.length === 0
			? []
			: db
					.select({ id: figures.id, move: figureGroups.name })
					.from(figures)
					.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
					.where(
						inArray(
							figures.id,
							graph.figures.map((f) => f.id)
						)
					)
					.all()
					.map((r) => [r.id, r.move])
	);
	const figOf = (id: number): MapFig => ({
		id,
		label: labels.get(id) ?? '',
		move: moves.get(id) ?? ''
	});
	const byMove = (a: MapFig, b: MapFig) =>
		a.move.localeCompare(b.move) || a.label.localeCompare(b.label) || a.id - b.id;
	const drawn = new Set(input.positions.map((p) => p.id));
	const onEdge = new Map<string, MapFig[]>();
	const anyFromMap = new Map<number, MapFig[]>();
	const noStart: { fig: MapFig; ends: number[] }[] = [];
	for (const f of graph.figures) {
		const fig = figOf(f.id);
		if (f.starts.length === 0) {
			noStart.push({ fig, ends: f.ends.filter((p) => drawn.has(p)) });
			continue;
		}
		for (const from of f.starts) {
			if (!drawn.has(from)) continue;
			if (f.ends.length === 0) anyFromMap.set(from, [...(anyFromMap.get(from) ?? []), fig]);
			for (const to of f.ends) {
				if (!drawn.has(to)) continue;
				const key = `${from}:${to}`;
				onEdge.set(key, [...(onEdge.get(key) ?? []), fig]);
			}
		}
	}
	noStart.sort((a, b) => byMove(a.fig, b.fig));
	const anyFrom = [...anyFromMap]
		.sort((a, b) => a[0] - b[0])
		.map(([from, figs]) => ({ from, figs: figs.sort(byMove) }));
	const edges = layout.edges.map((e) => ({
		...e,
		figures: figuresOf.get(`${e.from}:${e.to}`)!,
		figs: (onEdge.get(`${e.from}:${e.to}`) ?? []).sort(byMove)
	}));

	const none = noPosition(graph);
	// One count everywhere: what is not drawn as an arrow (no start, no end, or only one),
	// as the list's No position row and /positions/none count it.
	const missing = none.none.length + none.onlyStart.length + none.onlyEnd.length;
	const stranded = mode
		? 0
		: input.positions.filter((p) => p.gaps && (p.gaps.deadEnd || p.gaps.orphan || p.gaps.island))
				.length;
	return {
		empty: positions.length === 0,
		layout,
		positions,
		edges,
		anyFrom,
		noStart,
		noPosition: missing,
		summary: t().map.summary({
			positions: positions.length,
			between: graph.figures.filter((f) => f.starts.length > 0 && f.ends.length > 0).length,
			none: missing,
			stranded
		}),
		types: legendTypes(
			styles,
			DANCES[dance].styleLabel,
			positions.some((p) => p.tone === 'muted' && !styles.includes(p.styleTag ?? ''))
		),
		mapLabel: t().map.label(mode !== null),
		inGroupMode: mode !== null
	};
}

/**
 * Each twinned node's line ("Twins: your Cerrada, Salsa Tuesdays’ Closed"):
 * the node's own row first, then the others by id, each named by its place.
 */
function twinsLinesOf(db: Db, twinned: Map<number, number[]>): Map<number, string> {
	const ids = [...twinned.values()].flat();
	if (ids.length === 0) return new Map();
	const rows = new Map(
		db
			.select({ id: positionsTable.id, name: positionsTable.name, teamId: positionsTable.teamId })
			.from(positionsTable)
			.where(inArray(positionsTable.id, ids))
			.all()
			.map((r) => [r.id, r])
	);
	const teams = teamRefs(
		db,
		[...rows.values()].flatMap((r) => (r.teamId === null ? [] : [r.teamId]))
	);
	const lines = new Map<number, string>();
	for (const [canon, members] of twinned) {
		const ordered = [...members].sort((a, b) => (a === canon ? -1 : b === canon ? 1 : a - b));
		lines.set(
			canon,
			mapTwinsLine(
				ordered.flatMap((id) => {
					const r = rows.get(id);
					if (!r) return [];
					return [{ name: r.name, team: r.teamId === null ? null : (teams.get(r.teamId) ?? null) }];
				})
			)
		);
	}
	return lines;
}
