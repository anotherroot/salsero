import { and, asc, count, eq, isNull, like } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures, recordings } from './db/schema';
import type { Partner, Style } from '$lib/labels';

export interface FigureInput {
	name: string;
	partner: Partner;
	style: Style;
	notes: string | null;
}

/**
 * Create a figure AND its exercise, in one transaction. A figure without an
 * exercise would never show up on the Today page, which is the whole point of
 * adding it.
 */
export function createFigure(db: Db, input: FigureInput, everyDays = 3) {
	return db.transaction((tx) => {
		const figure = tx.insert(figures).values(input).returning().get();
		const exercise = tx
			.insert(exercises)
			.values({ name: figure.name, source: 'figure', figureId: figure.id, everyDays })
			.returning()
			.get();
		return { figure, exercise };
	});
}

/** Edit a figure. A rename carries over to its exercise so the two never drift. */
export function updateFigure(db: Db, id: number, input: FigureInput) {
	return db.transaction((tx) => {
		const figure = tx.update(figures).set(input).where(eq(figures.id, id)).returning().get();
		if (!figure) return null;
		tx.update(exercises).set({ name: figure.name }).where(eq(exercises.figureId, id)).run();
		return figure;
	});
}

/** Archive a figure and its exercise together. Sets and recordings are kept. */
export function archiveFigure(db: Db, id: number, now: number): boolean {
	return db.transaction((tx) => {
		const res = tx
			.update(figures)
			.set({ archivedAt: now })
			.where(and(eq(figures.id, id), isNull(figures.archivedAt)))
			.run();
		if (res.changes === 0) return false;
		tx.update(exercises).set({ archivedAt: now }).where(eq(exercises.figureId, id)).run();
		return true;
	});
}

export interface FigureFilter {
	q?: string;
	style?: Style;
	partner?: Partner;
}

export function listFigures(db: Db, filter: FigureFilter = {}) {
	const where = [isNull(figures.archivedAt)];
	if (filter.q) where.push(like(figures.name, `%${filter.q.replace(/[%_]/g, '')}%`));
	if (filter.style) where.push(eq(figures.style, filter.style));
	if (filter.partner) where.push(eq(figures.partner, filter.partner));

	return db
		.select({
			id: figures.id,
			name: figures.name,
			partner: figures.partner,
			style: figures.style,
			recordings: count(recordings.id)
		})
		.from(figures)
		.leftJoin(recordings, eq(recordings.figureId, figures.id))
		.where(and(...where))
		.groupBy(figures.id)
		.orderBy(asc(figures.name))
		.all();
}

export function getFigure(db: Db, id: number) {
	const figure = db.select().from(figures).where(eq(figures.id, id)).get();
	if (!figure) return null;
	const exercise = db.select().from(exercises).where(eq(exercises.figureId, id)).get() ?? null;
	const recs = db
		.select()
		.from(recordings)
		.where(eq(recordings.figureId, id))
		.orderBy(asc(recordings.createdAt))
		.all();
	return { figure, exercise, recordings: recs };
}

export interface RecordingInput {
	figureId: number;
	file: string;
	mime: string;
	kind: 'video' | 'audio';
	sizeBytes: number;
	note: string | null;
}

export function addRecording(db: Db, input: RecordingInput) {
	return db.insert(recordings).values(input).returning().get();
}

/** Delete a recording row and return it, so the caller can remove the file. */
export function deleteRecording(db: Db, id: number) {
	return db.delete(recordings).where(eq(recordings.id, id)).returning().get() ?? null;
}

export function getRecordingByFile(db: Db, file: string) {
	return db.select().from(recordings).where(eq(recordings.file, file)).get() ?? null;
}
