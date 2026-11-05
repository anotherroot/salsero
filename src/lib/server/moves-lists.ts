/**
 * The three Moves lists, as the `(moves)` layout loads them: unfiltered. The
 * filters are pure (`$lib/moves/filter`, `$lib/positions/filter`) and run
 * where the list is drawn, so a search never asks the server.
 */
import type { Db } from './db';
import { defaultStyle } from './default-styles';
import { listAddedFigures, listFigures, listVersions } from './figures';
import { canonicalOf, graphFor } from './graph';
import { listPositions, positionsFrom, positionSummary } from './positions';
import { listAddedRoutines, listRoutines, routineShapes } from './routines';
import { usableOf, usablePositions } from './usable';
import { withoutShadowed } from './clones/shadow';
import { storedTwinSets } from './twins';
import { publishedReach } from './access';
import type { GroupMode } from '$lib/types';
import type { Space, Wall } from './scope';
import { coverage } from '$lib/routines/coverage';
import { breaks, loops, timingBreaks } from '$lib/routines/routines';
import { noPosition, positionCounts, taggedCount } from '$lib/graph/graph';
import { foldSections } from '$lib/clones/twins';
import { DANCES } from '$lib/dances/dances';
import { fold } from '$lib/fold';
import { byGroupName } from '$lib/positions/view';
import type { FiguresLists } from '$lib/moves/filter';
import type { PositionsLists } from '$lib/positions/filter';
import type { RoutinesLists } from '$lib/moves/routines';
import type { PositionListRow, TeamRef } from '$lib/types';
import type { PositionRow } from './db/schema';

/** The Not linked chip counts figures, as the heading does, not the moves holding them. */
const figureCount = (moves: { figures: unknown[] }[]) =>
	moves.reduce((n, m) => n + m.figures.length, 0);

export function figuresLists(db: Db, wall: Wall, mode: GroupMode | null): FiguresLists {
	const dance = wall.dance;
	const defStyle = defaultStyle(db, wall.userId, dance);
	if (mode) {
		// Group mode: the group's figures only, each marked with whether members
		// reach it. Coverage is the person's own.
		const space = { dance, teamId: mode.teamId, actorId: wall.userId };
		const reach = publishedReach(db, mode.teamId);
		const mine = listFigures(db, space).map((m) => ({
			...m,
			figures: m.figures.map((f) => ({ ...f, membersSee: reach.variations.has(f.id) }))
		}));
		return {
			mine,
			groups: [],
			sets: [],
			groupMode: true,
			unlinked: figureCount(listFigures(db, space, { unlinked: true })),
			unrouted: null,
			defaultStyle: defStyle
		};
	}
	return {
		mine: listFigures(db, wall),
		// Each group's figures from the lessons the person added, after their own.
		groups: listAddedFigures(db, wall),
		sets: storedTwinSets(db, wall.userId, 'figure'),
		groupMode: false,
		// Figures with no section or no lesson, whatever the filter: the header's
		// way into the "Not linked" filter, as `unrouted` is into coverage.
		unlinked: figureCount(listFigures(db, wall, { unlinked: true })),
		// Versions no routine can call: the Figures header's way into coverage.
		unrouted: coverage(
			listVersions(db, wall),
			routineShapes(db, wall),
			listRoutines(db, wall)
		).filter((r) => r.routines.length === 0).length,
		defaultStyle: defStyle
	};
}

export function routinesList(db: Db, wall: Wall, mode: GroupMode | null): RoutinesLists {
	// In group mode the page reads the group's side; the person's own is not shown.
	const space = mode ? { dance: wall.dance, teamId: mode.teamId, actorId: wall.userId } : wall;
	const reach = mode ? publishedReach(db, mode.teamId) : null;
	// A person's routines may hold group figures they may use (`graphFor`).
	const graph = graphFor(db, space);
	const shapes = routineShapes(db, space);
	// Derived per request, never stored — the same rule the schedule follows. A tag
	// edited on a figure page changes these answers with no routine touched.
	// Twins show as one (board C7): each set once, yours if you have one, else the
	// first by group name. Group mode folds nothing: groups have no twins.
	const added = mode ? [] : listAddedRoutines(db, wall);
	const folded = mode
		? null
		: foldSections(
				listRoutines(db, space),
				added.map((g) => ({ team: g.team, rows: g.routines })),
				storedTwinSets(db, wall.userId, 'routine')
			);
	return {
		groups: folded ? folded.groups.map((g) => ({ team: g.team, routines: g.rows })) : [],
		/** The routines that stand for their twins: the "Twins" chip. */
		twinned: folded ? [...folded.twinOf.keys()] : ([] as number[]),
		routines: (folded ? folded.mine : listRoutines(db, space)).map((r) => {
			const shape = shapes.get(r.id) ?? { slots: [] };
			return {
				...r,
				...(reach ? { membersSee: reach.routines.has(r.id) } : {}),
				loops: loops(graph, shape),
				// A seam that breaks in the hands AND on the count is one problem, not two.
				breaks: new Set([...breaks(graph, shape), ...timingBreaks(graph, shape)]).size
			};
		})
	};
}

const hasGap = (r: PositionListRow) => r.deadEnd || r.orphan || r.island;

export function positionsLists(db: Db, wall: Wall, mode: GroupMode | null): PositionsLists {
	const dance = wall.dance;
	// In group mode the page reads the group's side; the person's own is not shown.
	const space: Space = mode ? { dance, teamId: mode.teamId, actorId: wall.userId } : wall;
	const styles = DANCES[dance].styles;

	// The graph is the viewer's (ruling 14): a person's own figures plus the group
	// figures they may use; in group mode, the group's.
	const usable = mode ? undefined : usableOf(db, wall);
	const graph = graphFor(db, space, usable);
	const own = listPositions(db, space);
	// Each group's positions the person may use. Yours replaces theirs: a group
	// position with your own copy shows as yours.
	const theirs = mode
		? []
		: withoutShadowed(db, wall, 'position', usablePositions(db, wall, usable));
	// Every row's counts in one pass: the parts of the graph are worked out once.
	const counts = new Map(
		positionCounts(graph, [
			...new Set([...own, ...theirs].map((p) => canonicalOf(graph, p.id)))
		]).map((c) => [c.id, c])
	);
	const row = (p: PositionRow, from: string | null): PositionListRow => {
		const c = counts.get(canonicalOf(graph, p.id))!;
		return {
			...positionSummary(p, space),
			inCount: c.inCount,
			outCount: c.outCount,
			// The gap report is hidden in group mode.
			deadEnd: !mode && c.deadEnd,
			orphan: !mode && c.orphan,
			island: !mode && c.island,
			unused: c.unused,
			from,
			twins: false
		};
	};

	let mine = own.map((p) => row(p, null));
	let groups: { team: TeamRef; rows: PositionListRow[] }[] = [];
	if (!mode) {
		// Each group's under its heading.
		const byTeam = new Map<number, { team: TeamRef; rows: PositionRow[] }>();
		for (const p of theirs) {
			const g = byTeam.get(p.team.id) ?? { team: p.team, rows: [] };
			g.rows.push(p);
			byTeam.set(p.team.id, g);
		}
		// Sections by group name: the order twins fold in (`foldSections`) and the page shows.
		const sections = [...byTeam.values()].sort(byGroupName).map((g) => {
			const from = positionsFrom(
				db,
				wall.userId,
				g.team.id,
				g.rows.map((p) => p.id)
			);
			return { team: g.team, rows: g.rows.map((p) => row(p, from.get(p.id) ?? null)) };
		});
		// Twins show as one (Same as…): yours if you have one, else the first by group name.
		const folded = foldSections(mine, sections, storedTwinSets(db, wall.userId, 'position'));
		const twinned = (r: PositionListRow) => ({ ...r, twins: folded.twinOf.has(r.id) });
		mine = folded.mine.map(twinned);
		groups = folded.groups.map((g) => ({ team: g.team, rows: g.rows.map(twinned) }));
	}

	const none = noPosition(graph);
	const untyped = (r: PositionListRow) => r.styleTag === null;
	return {
		rows: mine,
		groups,
		none: {
			none: none.none.length,
			onlyStart: none.onlyStart.length,
			onlyEnd: none.onlyEnd.length
		},
		tagged: taggedCount(graph),
		// The Gaps chip's count, whatever the other chips.
		gaps: mine.filter(hasGap).length,
		hasOwn: own.length > 0,
		untyped: mine.some(untyped) || groups.some((g) => g.rows.some(untyped)),
		types: [...styles],
		styleLabel: DANCES[dance].styleLabel,
		// Settings' "New figures" type: where New position's type starts.
		defaultStyle: defaultStyle(db, wall.userId, dance),
		owned: own.map((p) => fold(p.name)),
		inGroupMode: mode !== null
	};
}
