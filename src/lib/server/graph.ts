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
import type { DanceSlug } from '$lib/dances/dances';

/** How many 8-counts a figure may be tagged as taking. */
export const MAX_EIGHTS = 8;

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
			end: figures.endPositionId,
			eights: figures.eights
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

	return {
		neutral: neutralPosition(db, dance)?.id ?? 0,
		figures: rows.map((r) => ({
			id: r.id,
			starts: byFigure.get(r.id) ?? [],
			end: r.end,
			eights: r.eights
		}))
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

/**
 * Replace a figure's start positions, its end position and its length.
 *
 * Returns false — writing nothing — when the figure is gone, when the length is
 * out of range, or when any position belongs to another dance. That last one is
 * the wall: `positions.dance` has no CHECK pairing it to `figures.dance` (a new
 * CHECK on `figures` would force a rebuild and fail at migrate time), so it is
 * enforced here, the same way the figure's style already is.
 */
export function setFigurePositions(
	db: Db,
	figureId: number,
	startIds: number[],
	endId: number | null,
	eights: number
): boolean {
	if (!Number.isInteger(eights) || eights < 1 || eights > MAX_EIGHTS) return false;

	return db.transaction((tx) => {
		const figure = tx
			.select({ dance: figures.dance })
			.from(figures)
			.where(eq(figures.id, figureId))
			.get();
		if (!figure) return false;

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
		tx.update(figures).set({ endPositionId: endId, eights }).where(eq(figures.id, figureId)).run();
		return true;
	});
}
