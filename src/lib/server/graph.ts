/**
 * Turning rows into a `Graph`, and writing a figure's tags.
 *
 * The dance wall lives here, not in `src/lib/graph/`: that module is pure and
 * never learns what a dance or a person is, so this one scopes first and hands it a graph
 * of one space only (a person's or a group's side of one dance), plus, for a person's
 * routines, the group figures and positions they may use (`graphFor`).
 *
 * Positions are compared by FAMILY, not by row: a group's Cerrada and a
 * person's copy of it (one `gene_id`) are the same hold, so a person's figure
 * ending in theirs is followed by the group's figure starting in the group's.
 * The graph carries one CANONICAL id per family (`canonicalId` below); every
 * tag is mapped to it before the pure code sees it.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from './db';
import {
	figureEndPositions,
	figureGroups,
	figures,
	figureStartPositions,
	positions
} from './db/schema';
import { taggedCount, type Graph } from '$lib/graph/graph';
import {
	DEFAULT_LENGTH_COUNTS,
	DEFAULT_START_COUNT,
	isLengthCounts,
	isStartCount
} from '$lib/graph/timing';
import { inSpace, isTeam, spaceOfRow, type Space, type Wall } from './scope';
import { ownedOrUsable, usableBy, usableOf, type Usable } from './usable';
import { actingIn, fieldChange, logChange } from './changes';

/** A graph as `buildGraph` makes it: plus each real position id's canonical id. */
export type SpaceGraph = Graph & { canon: Map<number, number> };

/** What joins a space's own rows in its graph: figures and positions of others it may use. */
export interface GraphExtra {
	figures?: Set<number>;
	positions?: Set<number>;
}

/**
 * The canonical id of each live position in `rows`, by family: the space's own
 * member of the family when there is one, else the family's lowest id among
 * `rows`. A position with no gene is a family of its own.
 */
function canonicalIds(
	rows: {
		id: number;
		geneId: string | null;
		dance: string;
		userId: string | null;
		teamId: number | null;
	}[],
	space: Space
): Map<number, number> {
	const byFamily = new Map<string, number>();
	const sorted = [...rows].sort((a, b) => a.id - b.id);
	const key = (r: (typeof rows)[number]) => (r.geneId === null ? `#${r.id}` : `g:${r.geneId}`);
	// The space's own members first: they win their family outright.
	for (const r of sorted) if (inSpace(r, space)) byFamily.set(key(r), r.id);
	for (const r of sorted) if (!byFamily.has(key(r))) byFamily.set(key(r), r.id);
	return new Map(sorted.map((r) => [r.id, byFamily.get(key(r))!]));
}

/**
 * The live variations (of live figures) of one space as a graph.
 *
 * Starts come from `figure_start_positions`, ends from `figure_end_positions`,
 * each mapped to its family's canonical id. A tag to an archived position, or
 * to one the space neither owns nor may use (`extra.positions`), is dropped:
 * that side reads as no position, which fits anywhere (ruling 4).
 *
 * `extra.figures` are other variations of the same dance that join the graph
 * when live, in a live figure: the group figures a person's routines may use
 * (`graphFor`). The gap report and coverage pass none: they are about the
 * space's own figures.
 *
 * `positions` holds one entry per canonical id, named from that row; `canon`
 * maps every live real id in reach to it, for pages that start from a real id
 * (`canonicalOf`).
 */
export function buildGraph(db: Db, space: Space, extra: GraphExtra = {}): SpaceGraph {
	const whose = ownedOrUsable(figures, space, extra.figures);
	const rows = db
		.select({
			id: figures.id,
			startCount: figures.startCount,
			lengthCounts: figures.lengthCounts
		})
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(and(whose, isNull(figures.archivedAt), isNull(figureGroups.archivedAt)))
		.orderBy(figureGroups.name, figures.name, figures.id)
		.all();

	const live = db
		.select({
			id: positions.id,
			name: positions.name,
			styleTag: positions.styleTag,
			geneId: positions.geneId,
			dance: positions.dance,
			userId: positions.userId,
			teamId: positions.teamId
		})
		.from(positions)
		.where(and(ownedOrUsable(positions, space, extra.positions), isNull(positions.archivedAt)))
		.orderBy(asc(positions.id))
		.all();
	const canon = canonicalIds(live, space);

	const ids = rows.map((r) => r.id);
	const tagsOf = (table: typeof figureStartPositions | typeof figureEndPositions) => {
		const byFigure = new Map<number, number[]>();
		if (ids.length === 0) return byFigure;
		const tags = db
			.select({ figureId: table.figureId, positionId: table.positionId })
			.from(table)
			.where(inArray(table.figureId, ids))
			.all();
		for (const row of tags) {
			const id = canon.get(row.positionId);
			if (id === undefined) continue;
			const list = byFigure.get(row.figureId);
			if (!list) byFigure.set(row.figureId, [id]);
			else if (!list.includes(id)) list.push(id);
		}
		return byFigure;
	};
	const starts = tagsOf(figureStartPositions);
	const ends = tagsOf(figureEndPositions);

	return {
		figures: rows.map((r) => ({
			id: r.id,
			starts: starts.get(r.id) ?? [],
			ends: ends.get(r.id) ?? [],
			start: r.startCount ?? DEFAULT_START_COUNT,
			length: r.lengthCounts ?? DEFAULT_LENGTH_COUNTS
		})),
		positions: live
			.filter((p) => canon.get(p.id) === p.id)
			.map((p) => ({ id: p.id, name: p.name, styleTag: p.styleTag })),
		canon
	};
}

/**
 * The graph's id for a real position id: its family's canonical id, or the id
 * itself when the graph does not hold it (archived, or out of reach).
 */
export function canonicalOf(g: Graph & { canon: Map<number, number> }, positionId: number): number {
	return g.canon.get(positionId) ?? positionId;
}

/**
 * The graph a space's routines are walked on. A person's: their own figures
 * and positions, and the group figures and positions they may use
 * (`usableOf`; its positions hold what the usable figures are tagged with),
 * since their routines may hold those. A group's: its own, as ever — a
 * group's routine only holds its group's figures. Pass `usable` when the
 * caller has it already.
 */
export function graphFor(db: Db, space: Space, usable?: Usable): SpaceGraph {
	if (isTeam(space)) return buildGraph(db, space);
	const u = usable ?? usableOf(db, space);
	return buildGraph(db, space, { figures: u.figures, positions: u.positions });
}

/** A figure's tags, live and archived, each side sorted: what the edit form and History read. */
export function figurePositions(
	db: Db,
	figureId: number
): { startIds: number[]; endIds: number[] } {
	const read = (table: typeof figureStartPositions | typeof figureEndPositions) =>
		db
			.select({ positionId: table.positionId })
			.from(table)
			.where(eq(table.figureId, figureId))
			.all()
			.map((r) => r.positionId)
			.sort((a, b) => a - b);
	return { startIds: read(figureStartPositions), endIds: read(figureEndPositions) };
}

/** Everything the figure page's one form writes about how a figure is danced. */
export interface FigureShape {
	startIds: number[];
	endIds: number[];
	/** 1..8. */
	startCount: number;
	/** 1..MAX_LENGTH_COUNTS counts. */
	lengthCounts: number;
}

/**
 * Replace a variation's start positions, end positions, start count and
 * length, in one transaction.
 *
 * Returns false — writing nothing — on the refusals `writeFigureShape` names.
 *
 * The figure page calls this BEFORE `updateFigure`, because this is the half
 * that can refuse: a refusal must leave the name untouched too. In a group,
 * `by` is who, for History.
 */
export function setFigureShape(db: Db, figureId: number, shape: FigureShape, by?: string): boolean {
	return db.transaction((tx) => {
		const written = writeFigureShape(tx, figureId, shape);
		if (!written) return false;
		const { figure, before, after } = written;
		const change = fieldChange(before, after, 'variation');
		if (change && figure.groupId !== null) {
			const root = { rootKind: 'figure' as const, rootId: figure.groupId, subjectId: figureId };
			logChange(tx, actingIn(figure, by), { ...root, verb: 'change', ...change }, Date.now());
		}
		return true;
	});
}

/**
 * `setFigureShape`'s write, with no History line: a Take or Send writes the
 * shape among other fields and logs once for all of them. Null, writing
 * nothing, when the figure is gone, a timing value is out of range, or a
 * wanted position may not tag it. `before` and `after` are the shape as
 * History keeps it.
 *
 * A wanted position must be live, of the figure's dance, and the figure's own
 * owner's, or, on a person's figure, a group position they may use
 * (`usableBy(…, 'positions', …)`). Ruling 15: a group's figure only with its
 * group's positions.
 * `positions.dance` has no CHECK pairing it to `figures.dance` (a new CHECK
 * on `figures` would force a rebuild and fail at migrate time), so the wall is
 * enforced here, the same way the figure's style is.
 *
 * Only the tags to such positions are replaced. A tag to an archived position
 * is never deleted (ruling 4): the edit form cannot show it, so saving must
 * not drop it. An archived id the figure is already tagged with on that side
 * may be posted back (an older page does): it is kept, not refused.
 */
export function writeFigureShape(tx: Db, figureId: number, shape: FigureShape) {
	const { startCount, lengthCounts } = shape;
	if (!isStartCount(startCount)) return null;
	if (!isLengthCounts(lengthCounts)) return null;

	// Every refusal comes before the first write: the caller's transaction needs no savepoint.
	const figure = tx.select().from(figures).where(eq(figures.id, figureId)).get();
	if (!figure) return null;
	const current = figurePositions(tx, figureId);
	const before = shapeFields({
		...current,
		startCount: figure.startCount ?? DEFAULT_START_COUNT,
		lengthCounts: figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
	});

	const owner = spaceOfRow(figure, '');
	const all = [
		...new Set([...current.startIds, ...current.endIds, ...shape.startIds, ...shape.endIds])
	];
	const rows =
		all.length === 0 ? [] : tx.select().from(positions).where(inArray(positions.id, all)).all();
	const byId = new Map(rows.map((p) => [p.id, p]));
	// What the figure's owner may use of the groups, read once and only when a
	// group's position is in play (never for a group's figure: `usableBy`).
	let usable: Usable | undefined;
	const usableFor = () => (usable ??= usableOf(tx, owner as Wall));
	/** A position this save may write or replace: live, and the figure's owner's or usable by them. */
	const ours = (id: number) => {
		const p = byId.get(id);
		if (p === undefined || p.archivedAt !== null) return false;
		if (inSpace(p, owner)) return true;
		if (isTeam(owner) || p.teamId === null) return false;
		return usableBy(tx, owner, 'positions', p, usableFor());
	};

	const side = (wanted: number[], had: number[]) => {
		const want = [...new Set(wanted)];
		// An archived (or otherwise kept) tag posted back is a no-op, not a refusal.
		if (want.some((id) => !ours(id) && !had.includes(id))) return null;
		return want.filter(ours);
	};
	const starts = side(shape.startIds, current.startIds);
	const ends = side(shape.endIds, current.endIds);
	if (!starts || !ends) return null;

	for (const [table, write, had] of [
		[figureStartPositions, starts, current.startIds],
		[figureEndPositions, ends, current.endIds]
	] as const) {
		const replace = had.filter(ours);
		if (replace.length > 0) {
			tx.delete(table)
				.where(and(eq(table.figureId, figureId), inArray(table.positionId, replace)))
				.run();
		}
		if (write.length > 0) {
			tx.insert(table)
				.values(write.map((positionId) => ({ figureId, positionId })))
				.run();
		}
	}
	tx.update(figures).set({ startCount, lengthCounts }).where(eq(figures.id, figureId)).run();
	const after = shapeFields({ ...figurePositions(tx, figureId), startCount, lengthCounts });
	return { figure, before, after };
}

/** A shape as History and the clash check keep it: each side's ids sorted and joined. */
function shapeFields(s: FigureShape) {
	return {
		startIds: [...s.startIds].sort((a, b) => a - b).join(','),
		endIds: [...s.endIds].sort((a, b) => a - b).join(','),
		startCount: s.startCount,
		lengthCounts: s.lengthCounts
	};
}

/**
 * How much of the repertoire carries handhold tags, counted per live
 * variation of a live figure: a figure with either side tagged, to a live
 * position, is done.
 */
export function taggedFigures(db: Db, space: Space): { done: number; total: number } {
	return taggedCount(buildGraph(db, space));
}
