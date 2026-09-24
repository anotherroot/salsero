import { and, asc, count, eq, isNull, like } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures, recordings } from './db/schema';
import { isStyleOf, type DanceSlug } from '$lib/dances/dances';
import type { Partner } from '$lib/labels';
import type { CallableFigure } from '$lib/types';

export interface FigureInput {
	name: string;
	partner: Partner;
	/** Validated against `DANCES[dance].styles`; stored in `style_tag`. */
	style: string;
	notes: string | null;
	callable: boolean;
	callText: string | null;
}

/** The columns a `FigureInput` writes. `style` is vestigial and never set. */
function values(input: FigureInput) {
	const { style, ...rest } = input;
	return { ...rest, styleTag: style };
}

/**
 * Create a figure AND its exercise, in one transaction. A figure without an
 * exercise would never show up on the Today page, which is the whole point of
 * adding it. The exercise carries the figure's dance, so Today stays walled.
 *
 * Returns null when the style is not one of the dance's — the pairing has no
 * CHECK to enforce it (see `schema.ts`), so it is enforced here.
 */
export function createFigure(
	db: Db,
	dance: DanceSlug,
	input: FigureInput,
	everyDays = 3
): { figure: typeof figures.$inferSelect; exercise: typeof exercises.$inferSelect } | null {
	if (!isStyleOf(dance, input.style)) return null;
	return db.transaction((tx) => {
		const figure = tx
			.insert(figures)
			.values({ ...values(input), dance })
			.returning()
			.get();
		const exercise = tx
			.insert(exercises)
			.values({ name: figure.name, source: 'figure', figureId: figure.id, dance, everyDays })
			.returning()
			.get();
		return { figure, exercise };
	});
}

/**
 * Edit a figure. A rename carries over to its exercise so the two never drift.
 * Returns null when the figure is gone, or when the style does not belong to
 * the figure's own dance — a figure never changes dance.
 */
export function updateFigure(db: Db, id: number, input: FigureInput) {
	return db.transaction((tx) => {
		const current = tx.select().from(figures).where(eq(figures.id, id)).get();
		if (!current) return null;
		if (!isStyleOf(current.dance, input.style)) return null;
		const figure = tx
			.update(figures)
			.set(values(input))
			.where(eq(figures.id, id))
			.returning()
			.get();
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
	style?: string;
	partner?: Partner;
}

export function listFigures(db: Db, dance: DanceSlug, filter: FigureFilter = {}) {
	const where = [isNull(figures.archivedAt), eq(figures.dance, dance)];
	if (filter.q) where.push(like(figures.name, `%${filter.q.replace(/[%_]/g, '')}%`));
	if (filter.style) where.push(eq(figures.styleTag, filter.style));
	if (filter.partner) where.push(eq(figures.partner, filter.partner));

	return db
		.select({
			id: figures.id,
			name: figures.name,
			partner: figures.partner,
			style: figures.styleTag,
			recordings: count(recordings.id)
		})
		.from(figures)
		.leftJoin(recordings, eq(recordings.figureId, figures.id))
		.where(and(...where))
		.groupBy(figures.id)
		.orderBy(asc(figures.name))
		.all();
}

/** Figures the player may call, alphabetical. Archived and non-callable excluded. */
export function listCallableFigures(db: Db, dance: DanceSlug): CallableFigure[] {
	return db
		.select({
			id: figures.id,
			name: figures.name,
			callText: figures.callText,
			partner: figures.partner,
			style: figures.styleTag
		})
		.from(figures)
		.where(and(isNull(figures.archivedAt), eq(figures.callable, true), eq(figures.dance, dance)))
		.orderBy(figures.name)
		.all()
		.map(({ callText, ...f }) => ({ ...f, say: callText ?? f.name }));
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
