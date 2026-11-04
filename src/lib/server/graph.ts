/**
 * Turning rows into a `Graph`, and writing a figure's tags.
 *
 * The dance wall lives here, not in `src/lib/graph/`: that module is pure and
 * never learns what a dance or a person is, so this one scopes first and hands it a graph
 * of one space only (a person's or a group's side of one dance), plus, for a person's
 * routines, the group figures they may use (`graphFor`); positions stay shared.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { figureGroups, figures, figureStartPositions, positions } from './db/schema';
import { neutralPosition } from './positions';
import type { Graph } from '$lib/graph/graph';
import {
	DEFAULT_LENGTH_COUNTS,
	DEFAULT_START_COUNT,
	isLengthCounts,
	isStartCount
} from '$lib/graph/timing';
import { isTeam, ownedBy, type Space } from './scope';
import { ownedOrUsable, usableOf, type Usable } from './usable';
import { actingIn, fieldChange, logChange } from './changes';

/**
 * The live variations (of live figures) of one dance as a graph.
 *
 * `neutral` falls back to 0 only before the seed has run, which no route can
 * observe — `bootstrap` seeds before the first request resolves. A 0 there
 * would make every untagged figure share one position anyway, which is the
 * same answer, so it degrades rather than throwing.
 *
 * `extra` are other variations of the same dance that join the graph when
 * live, in a live figure: the group figures a person's routines may use
 * (`graphFor`). The gap report and coverage pass none: they are about the
 * space's own figures.
 */
export function buildGraph(db: Db, space: Space, extra?: Set<number>): Graph {
	const whose = ownedOrUsable(figures, space, extra);
	const rows = db
		.select({
			id: figures.id,
			end: figures.endPositionId,
			startCount: figures.startCount,
			lengthCounts: figures.lengthCounts
		})
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(and(whose, isNull(figures.archivedAt), isNull(figureGroups.archivedAt)))
		.orderBy(figureGroups.name, figures.name, figures.id)
		.all();

	const ids = rows.map((r) => r.id);
	const starts =
		ids.length === 0
			? []
			: db
					.select({
						figureId: figureStartPositions.figureId,
						positionId: figureStartPositions.positionId
					})
					.from(figureStartPositions)
					.where(inArray(figureStartPositions.figureId, ids))
					.all();

	const byFigure = new Map<number, number[]>();
	for (const row of starts) {
		const list = byFigure.get(row.figureId);
		if (list) list.push(row.positionId);
		else byFigure.set(row.figureId, [row.positionId]);
	}

	const nodes: Graph['figures'] = rows.map((r) => ({
		id: r.id,
		starts: byFigure.get(r.id) ?? [],
		end: r.end,
		start: r.startCount ?? DEFAULT_START_COUNT,
		length: r.lengthCounts ?? DEFAULT_LENGTH_COUNTS
	}));

	return {
		neutral: neutralPosition(db, space.dance)?.id ?? 0,
		figures: nodes
	};
}

/**
 * The graph a space's routines are walked on. A person's: their own figures
 * and the group figures they may use (`usableOf`), since their routines may
 * hold those. A group's: its own, as ever — a group's routine only holds its
 * group's figures. Pass `usable` when the caller has it already.
 */
export function graphFor(db: Db, space: Space, usable?: Usable): Graph {
	if (isTeam(space)) return buildGraph(db, space);
	return buildGraph(db, space, (usable ?? usableOf(db, space)).figures);
}

/** A figure's tags as the edit form needs them. */
export function figurePositions(db: Db, figureId: number) {
	const figure = db
		.select({ end: figures.endPositionId })
		.from(figures)
		.where(eq(figures.id, figureId))
		.get();
	const startIds = db
		.select({ positionId: figureStartPositions.positionId })
		.from(figureStartPositions)
		.where(eq(figureStartPositions.figureId, figureId))
		.all()
		.map((r) => r.positionId)
		.sort((a, b) => a - b);
	return { startIds, endId: figure?.end ?? null };
}

/** Everything the figure page's one form writes about how a figure is danced. */
export interface FigureShape {
	startIds: number[];
	endId: number | null;
	/** 1..8. */
	startCount: number;
	/** 1..MAX_LENGTH_COUNTS counts. */
	lengthCounts: number;
}

/**
 * Replace a variation's start positions, end position, start count and length,
 * in one transaction.
 *
 * Returns false — writing nothing — when the figure is gone, when a timing
 * value is out of range, or when any position belongs to another dance. That
 * last one is the wall: `positions.dance` has no CHECK pairing it to
 * `figures.dance` (a new CHECK on `figures` would force a rebuild and fail at
 * migrate time), so it is enforced here, the same way the figure's style is.
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
 * nothing, on the refusals `setFigureShape` names. `before` and `after` are
 * the shape as History keeps it.
 */
export function writeFigureShape(tx: Db, figureId: number, shape: FigureShape) {
	const { startIds, endId, startCount, lengthCounts } = shape;
	if (!isStartCount(startCount)) return null;
	if (!isLengthCounts(lengthCounts)) return null;

	// Every refusal comes before the first write: the caller's transaction needs no savepoint.
	const figure = tx.select().from(figures).where(eq(figures.id, figureId)).get();
	if (!figure) return null;
	const before = shapeFields({
		startIds: figurePositions(tx, figureId).startIds,
		endId: figure.endPositionId,
		startCount: figure.startCount ?? DEFAULT_START_COUNT,
		lengthCounts: figure.lengthCounts ?? DEFAULT_LENGTH_COUNTS
	});

	const wanted = [...new Set(endId === null ? startIds : [...startIds, endId])];
	if (wanted.length > 0) {
		const ours = tx
			.select({ id: positions.id })
			.from(positions)
			.where(and(inArray(positions.id, wanted), eq(positions.dance, figure.dance)))
			.all();
		// Every id must exist AND be of this figure's dance. A count comparison
		// covers both, since the ids were de-duplicated above.
		if (ours.length !== wanted.length) return null;
	}

	tx.delete(figureStartPositions).where(eq(figureStartPositions.figureId, figureId)).run();
	if (startIds.length > 0) {
		tx.insert(figureStartPositions)
			.values([...new Set(startIds)].map((positionId) => ({ figureId, positionId })))
			.run();
	}
	tx.update(figures)
		.set({ endPositionId: endId, startCount, lengthCounts })
		.where(eq(figures.id, figureId))
		.run();
	const after = shapeFields({ startIds: [...new Set(startIds)], endId, startCount, lengthCounts });
	return { figure, before, after };
}

/** A shape as History and the clash check keep it: the start positions sorted and joined. */
function shapeFields(s: FigureShape) {
	return {
		startIds: [...s.startIds].sort((a, b) => a - b).join(','),
		endId: s.endId,
		startCount: s.startCount,
		lengthCounts: s.lengthCounts
	};
}

/**
 * How much of the repertoire carries handhold tags, counted per live variation of a live figure.
 */
export function taggedFigures(db: Db, space: Space): { done: number; total: number } {
	const rows = db
		.select({ id: figures.id, end: figures.endPositionId })
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(
			and(ownedBy(figures, space), isNull(figures.archivedAt), isNull(figureGroups.archivedAt))
		)
		.all();
	const ids = rows.map((r) => r.id);
	const withStarts = new Set(
		ids.length === 0
			? []
			: db
					.select({ id: figureStartPositions.figureId })
					.from(figureStartPositions)
					.where(inArray(figureStartPositions.figureId, ids))
					.all()
					.map((r) => r.id)
	);
	return {
		done: rows.filter((r) => r.end !== null || withStarts.has(r.id)).length,
		total: rows.length
	};
}
