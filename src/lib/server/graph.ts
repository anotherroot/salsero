/**
 * Turning rows into a `Graph`, and writing a figure's tags.
 *
 * The dance wall lives here, not in `src/lib/graph/`: that module is pure and
 * never learns what a dance is, so this one scopes first and hands it a graph
 * of one dance only.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { figures, figureStartPositions, positions } from './db/schema';
import { neutralPosition } from './positions';
import type { Graph } from '$lib/graph/graph';
import {
	DEFAULT_LENGTH_COUNTS,
	DEFAULT_START_COUNT,
	isLengthCounts,
	isStartCount
} from '$lib/graph/timing';
import type { DanceSlug } from '$lib/dances/dances';

/**
 * The unarchived figures of one dance as a graph.
 *
 * `neutral` falls back to 0 only before the seed has run, which no route can
 * observe — `bootstrap` seeds before the first request resolves. A 0 there
 * would make every untagged figure share one position anyway, which is the
 * same answer, so it degrades rather than throwing.
 *
 * Not filtered on `callable`: the graph holds every unarchived figure so the
 * player's pool (`listCallableFigures`) is always a subset of it. Filtering
 * here would let a callable figure vanish from the graph it is walked on.
 */
export function buildGraph(db: Db, dance: DanceSlug): Graph {
	const rows = db
		.select({
			id: figures.id,
			parentId: figures.parentId,
			end: figures.endPositionId,
			startCount: figures.startCount,
			lengthCounts: figures.lengthCounts
		})
		.from(figures)
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt)))
		.orderBy(figures.name)
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

	// A variation takes whatever it leaves unset from its figure. Resolved HERE,
	// so `src/lib/graph/` never learns that variations exist — the same way it
	// never learns that dances do.
	const byId = new Map(rows.map((r) => [r.id, r]));
	const nodes: Graph['figures'] = [];
	for (const r of rows) {
		const parent = r.parentId === null ? null : (byId.get(r.parentId) ?? null);
		// A variation whose figure is not in the graph — archived by hand, or gone
		// — has nothing to fill from. `archiveFigure` archives both together.
		if (r.parentId !== null && parent === null) continue;
		const own = byFigure.get(r.id) ?? [];
		nodes.push({
			id: r.id,
			starts: own.length > 0 || parent === null ? own : (byFigure.get(parent.id) ?? []),
			end: r.end ?? parent?.end ?? null,
			start: r.startCount ?? parent?.startCount ?? DEFAULT_START_COUNT,
			length: r.lengthCounts ?? parent?.lengthCounts ?? DEFAULT_LENGTH_COUNTS
		});
	}

	return {
		neutral: neutralPosition(db, dance)?.id ?? 0,
		figures: nodes
	};
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
	/** 1..8, or null on a variation for "the figure's". */
	startCount: number | null;
	/** 1..MAX_LENGTH_COUNTS counts, or null on a variation for "the figure's". */
	lengthCounts: number | null;
}

/**
 * Replace a figure's start positions, end position, start count and length, in
 * one transaction. On a variation, null timing and no start rows mean the
 * figure's.
 *
 * Returns false — writing nothing — when the figure is gone, when a timing
 * value is out of range, or when any position belongs to another dance. That
 * last one is the wall: `positions.dance` has no CHECK pairing it to
 * `figures.dance` (a new CHECK on `figures` would force a rebuild and fail at
 * migrate time), so it is enforced here, the same way the figure's style is.
 *
 * The figure page calls this BEFORE `updateFigure`, because this is the half
 * that can refuse: a refusal must leave the name untouched too.
 */
export function setFigureShape(db: Db, figureId: number, shape: FigureShape): boolean {
	const { startIds, endId, startCount, lengthCounts } = shape;
	if (startCount !== null && !isStartCount(startCount)) return false;
	if (lengthCounts !== null && !isLengthCounts(lengthCounts)) return false;

	return db.transaction((tx) => {
		const figure = tx
			.select({ dance: figures.dance, parentId: figures.parentId })
			.from(figures)
			.where(eq(figures.id, figureId))
			.get();
		if (!figure) return false;
		// Null means "the figure's", which only a variation has a figure to take
		// from. A base figure always states its own timing.
		if (figure.parentId === null && (startCount === null || lengthCounts === null)) {
			return false;
		}

		const wanted = [...new Set(endId === null ? startIds : [...startIds, endId])];
		if (wanted.length > 0) {
			const ours = tx
				.select({ id: positions.id })
				.from(positions)
				.where(and(inArray(positions.id, wanted), eq(positions.dance, figure.dance)))
				.all();
			// Every id must exist AND be of this figure's dance. A count comparison
			// covers both, since the ids were de-duplicated above.
			if (ours.length !== wanted.length) return false;
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
		return true;
	});
}

/**
 * How much of the repertoire carries handhold tags — figures only. A variation
 * inherits its figure's tags, so counting it would make an untagged figure with
 * three variations look four times as untagged.
 */
export function taggedFigures(db: Db, dance: DanceSlug): { done: number; total: number } {
	const rows = db
		.select({ id: figures.id, end: figures.endPositionId })
		.from(figures)
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt), isNull(figures.parentId)))
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
