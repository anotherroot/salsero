/**
 * The three Moves lists, as the `(moves)` layout loads them: unfiltered. The
 * filters are pure (`$lib/moves/filter`, `$lib/positions/filter`) and run
 * where the list is drawn, so a search never asks the server.
 */
import type { Db } from './db';
import { defaultStyle } from './default-styles';
import { listAddedFigures, listFigures, listMoveTargets, listVersions } from './figures';
import { canonicalOf, graphFor } from './graph';
import { listPositions, positionsFrom, positionSummary } from './positions';
import { copiedFromPlaces } from './clones/genes';
import { listAddedRoutines, listRoutines, routineShapes } from './routines';
import { usableOf, usablePositions } from './usable';
import { mineIdsFor, withoutShadowed } from './clones/shadow';
import { storedTwinSets } from './twins';
import { publishedReach } from './access';
import { routineClassDays } from './lessons';
import { classDayLabel } from '$lib/format';
import type { CloneKind, GroupMode, MoveRow } from '$lib/types';
import type { Space, Wall } from './scope';
import { copyCounts, outOfStep } from './clones/step';
import { coverage } from '$lib/routines/coverage';
import {
	breaks,
	loops,
	routineEnds,
	routineSize,
	routineStarts,
	timingBreaks
} from '$lib/routines/routines';
import { noPosition, positionCounts, taggedCount } from '$lib/graph/graph';
import { foldMoves, foldSections } from '$lib/clones/twins';
import { DANCES } from '$lib/dances/dances';
import { fold } from '$lib/fold';
import { byGroupName } from '$lib/positions/view';
import { mergeGroups, moveKey, type FiguresLists, type MergedFigure } from '$lib/moves/filter';
import type { PositionsLists } from '$lib/positions/filter';
import type { RoutinesLists } from '$lib/moves/routines';
import type { PositionListRow, TeamRef } from '$lib/types';
import type { PositionRow } from './db/schema';

/** The Not linked chip counts figures, as the heading does, not the moves holding them. */
const figureCount = (moves: { figures: unknown[] }[]) =>
	moves.reduce((n, m) => n + m.figures.length, 0);

/**
 * The rows with `differ` (how many other copies of each disagree with it) and
 * `copies` (how many other copies the person reads: the row's Clone chip).
 */
function withDiffer<T extends { id: number }>(
	db: Db,
	userId: string,
	kind: CloneKind,
	rows: T[]
): (T & { differ: number; copies: number })[] {
	const ids = rows.map((r) => r.id);
	const n = outOfStep(db, userId, kind, ids);
	const copies = copyCounts(db, userId, kind, ids);
	return rows.map((r) => ({ ...r, differ: n.get(r.id) ?? 0, copies: copies.get(r.id) ?? 0 }));
}

/** A list's figures with `differ` and `copies`. */
const figureDiffer = (db: Db, userId: string, moves: MoveRow[]): MoveRow[] => {
	const all = withDiffer(
		db,
		userId,
		'figure',
		moves.flatMap((m) => m.figures)
	);
	const by = new Map(all.map((f) => [f.id, f]));
	return moves.map((m) => ({ ...m, figures: m.figures.map((f) => by.get(f.id) ?? f) }));
};

export function figuresLists(db: Db, wall: Wall, mode: GroupMode | null): FiguresLists {
	const dance = wall.dance;
	const defStyle = defaultStyle(db, wall.userId, dance);
	if (mode) {
		// Group mode: the group's figures only, each marked with whether members
		// reach it. Coverage is the person's own.
		const space = { dance, teamId: mode.teamId, actorId: wall.userId };
		const reach = publishedReach(db, mode.teamId);
		const mine = figureDiffer(
			db,
			wall.userId,
			listFigures(db, space).map((m) => ({
				...m,
				figures: m.figures.map((f) => ({ ...f, membersSee: reach.variations.has(f.id) }))
			}))
		);
		return {
			mine,
			groups: [],
			sets: [],
			groupMode: true,
			unlinked: figureCount(listFigures(db, space, { unlinked: true })),
			unrouted: null,
			defaultStyle: defStyle,
			moveTargets: listMoveTargets(db, space, null)
		};
	}
	return {
		mine: figureDiffer(db, wall.userId, listFigures(db, wall)),
		// Each group's figures from the lessons the person added, after their own.
		groups: listAddedFigures(db, wall).map((g) => ({
			...g,
			moves: figureDiffer(db, wall.userId, g.moves)
		})),
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
		defaultStyle: defStyle,
		moveTargets: listMoveTargets(db, wall, null)
	};
}

/**
 * The figures the Figures list shows under the move named `name`: the person's
 * own and those of the groups whose lessons they added, merged by name
 * (`mergeGroups`), twins folded, as the list draws them. Empty when the list
 * has no such move. `twinOf`: a folded twin's id → the id shown for it. A
 * figure's switcher steps through these.
 */
export function mergedMoveFigures(
	db: Db,
	wall: Wall,
	name: string
): { figures: MergedFigure[]; twinOf: Map<number, number> } {
	const folded = foldMoves(
		listFigures(db, wall),
		listAddedFigures(db, wall),
		storedTwinSets(db, wall.userId, 'figure')
	);
	const key = moveKey(name);
	const twinOf = new Map<number, number>();
	for (const [shown, hidden] of folded.twinOf) for (const h of hidden) twinOf.set(h, shown);
	const move = mergeGroups(folded.mine, folded.groups).find((m) => moveKey(m.name) === key);
	return { figures: move?.figures ?? [], twinOf };
}

/**
 * One move as the Figures list shows it, for its own page and its figures'
 * switcher: the person's own and the added groups' moves of the same name as
 * one (`mergeGroups`), each group's figure marked (`team`). This move's own
 * figures stay as the page reads them (`own`: an editor's drafts too, a
 * reader's reach), where the list puts them. A figure the list folds into
 * another row (your own copy replaces the group's; a twin stands for its set)
 * is that row: `standIn` names it, and `twinned` holds the rows that stand
 * for twins. `live`: every live figure of this move. In group mode
 * (`merge` false) the move is its own figures, unmarked.
 */
export function mergedMoveRows<F extends { id: number }>(
	db: Db,
	wall: Wall,
	move: { name: string; teamId: number | null },
	own: F[],
	live: number[],
	merge: boolean,
	team: TeamRef | null
): {
	rows: ((F & { team: TeamRef | null }) | MergedFigure)[];
	standIn: (id: number) => number | null;
	twinned: Set<number>;
} {
	const twinned = new Set<number>();
	if (!merge) return { rows: own.map((f) => ({ ...f, team: null })), standIn: () => null, twinned };
	const merged = mergedMoveFigures(db, wall, move.name);
	for (const shown of merged.twinOf.values()) twinned.add(shown);
	const listed = new Set(merged.figures.map((f) => f.id));
	const yours =
		move.teamId === null
			? new Map<number, number>()
			: mineIdsFor(
					db,
					wall,
					'figure',
					own.map((f) => f.id)
				);
	const standIn = (id: number) => {
		if (listed.has(id)) return null;
		const to = merged.twinOf.get(id) ?? yours.get(id);
		return to !== undefined && listed.has(to) ? to : null;
	};
	const mine = own.filter((f) => standIn(f.id) === null).map((f) => ({ ...f, team }));
	const ofThis = new Set(live);
	const rows: ((F & { team: TeamRef | null }) | MergedFigure)[] = [];
	for (const f of merged.figures) {
		if (!ofThis.has(f.id)) rows.push(f);
		else if (mine.length > 0) rows.push(...mine.splice(0));
	}
	rows.push(...mine);
	return { rows, standIn, twinned };
}

export function routinesList(
	db: Db,
	wall: Wall,
	mode: GroupMode | null,
	today: string
): RoutinesLists {
	// In group mode the page reads the group's side; the person's own is not shown.
	const space = mode ? { dance: wall.dance, teamId: mode.teamId, actorId: wall.userId } : wall;
	const reach = mode ? publishedReach(db, mode.teamId) : null;
	// A person's routines may hold group figures they may use (`graphFor`).
	const graph = graphFor(db, space);
	/** Positions by name, several joined; null when the routine has none to name. */
	const placeName = (ids: number[]) => {
		const names = ids.flatMap((id) => graph.positions.find((p) => p.id === id)?.name ?? []);
		return names.length === 0 ? null : names.join(' / ');
	};
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
	const own = withDiffer(
		db,
		wall.userId,
		'routine',
		folded ? folded.mine : listRoutines(db, space)
	);
	const groupRows = (folded ? folded.groups : []).map((g) => ({
		...g,
		rows: withDiffer(db, wall.userId, 'routine', g.rows)
	}));
	// Spec A5: the latest class a routine is from, as its row says it.
	const days = routineClassDays(
		db,
		[...own.map((r) => r.id), ...groupRows.flatMap((g) => g.rows.map((r) => r.id))],
		{ userId: wall.userId, editsTeamId: mode?.teamId ?? null }
	);
	const classDay = (id: number) => {
		const day = days.get(id);
		return day ? classDayLabel(day, today) : null;
	};
	return {
		groups: groupRows.map((g) => ({
			team: g.team,
			routines: g.rows.map((r) => ({ ...r, classDay: classDay(r.id) }))
		})),
		/** The routines that stand for their twins: the "Twins" chip. */
		twinned: folded ? [...folded.twinOf.keys()] : ([] as number[]),
		routines: own.map((r) => {
			const shape = shapes.get(r.id) ?? { slots: [] };
			return {
				...r,
				classDay: classDay(r.id),
				...(reach ? { membersSee: reach.routines.has(r.id) } : {}),
				loops: loops(graph, shape),
				// A seam that breaks in the hands AND on the count is one problem, not two.
				breaks: new Set([...breaks(graph, shape), ...timingBreaks(graph, shape)]).size,
				// L4 (spec 2026-11-12): where it starts and ends, and how big it is.
				start: placeName(routineStarts(graph, shape)),
				end: placeName(routineEnds(graph, shape) ?? []),
				...routineSize(graph, shape)
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
	const origins = copiedFromPlaces(
		db,
		wall.userId,
		'position',
		[...own, ...theirs].map((p) => p.id)
	);
	const row = (p: PositionRow, from: string | null): PositionListRow => {
		const c = counts.get(canonicalOf(graph, p.id))!;
		return {
			...positionSummary(p, space),
			copiedFrom: origins.get(p.id) ?? null,
			inCount: c.inCount,
			outCount: c.outCount,
			// The gap report is hidden in group mode.
			deadEnd: !mode && c.deadEnd,
			orphan: !mode && c.orphan,
			island: !mode && c.island,
			unused: c.unused,
			from,
			twins: false,
			differ: differ.get(p.id) ?? 0,
			copies: copies.get(p.id) ?? 0
		};
	};

	const differ = outOfStep(
		db,
		wall.userId,
		'position',
		[...own, ...theirs].map((p) => p.id)
	);
	const copies = copyCounts(
		db,
		wall.userId,
		'position',
		[...own, ...theirs].map((p) => p.id)
	);
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
