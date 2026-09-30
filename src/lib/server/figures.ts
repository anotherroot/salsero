import { and, asc, count, eq, inArray, isNotNull, isNull, like } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, figures, recordings, type Figure } from './db/schema';
import { isStyleOf, type DanceSlug } from '$lib/dances/dances';
import type { Partner } from '$lib/labels';
import type { CalledFigure, FigureVersion } from '$lib/types';
import { DEFAULT_LENGTH_COUNTS } from '$lib/graph/timing';

export interface FigureInput {
	name: string;
	partner: Partner;
	/** Validated against `DANCES[dance].styles`; stored in `style_tag`. */
	style: string;
	notes: string | null;
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
			.values({ ...values(input), dance, lengthCounts: DEFAULT_LENGTH_COUNTS })
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
		// A variation's partner, style and call text are its figure's; its own
		// name and directions go through `updateVariation`.
		if (current.parentId !== null) return null;
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
		// A figure's variations go with it. Archiving a variation matches nothing
		// here, so the same function archives one alone.
		tx.update(figures)
			.set({ archivedAt: now })
			.where(and(eq(figures.parentId, id), isNull(figures.archivedAt)))
			.run();
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
	// Variations are versions OF a figure, reached through it — never figures in
	// their own right in any list.
	const where = [isNull(figures.archivedAt), eq(figures.dance, dance), isNull(figures.parentId)];
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

/**
 * The figures a routine can call, by id, with what the player shows and says
 * for each. Archived ones are excluded, because `buildGraph` excludes them too
 * and the planner will never reach one.
 *
 * A variation is shown as "Enchufla · Doble" and SAID as its figure — a spoken
 * call has three counts to fit in.
 */
export function listFiguresForCall(db: Db, dance: DanceSlug, ids: number[]): CalledFigure[] {
	if (ids.length === 0) return [];
	const rows = db
		.select({ id: figures.id, name: figures.name, parentId: figures.parentId })
		.from(figures)
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt), inArray(figures.id, ids)))
		.orderBy(figures.name)
		.all();
	const parentIds = [...new Set(rows.flatMap((r) => (r.parentId === null ? [] : [r.parentId])))];
	const parents = new Map(
		(parentIds.length === 0
			? []
			: db
					.select({ id: figures.id, name: figures.name })
					.from(figures)
					.where(inArray(figures.id, parentIds))
					.all()
		).map((p) => [p.id, p.name])
	);
	return rows.map(({ id, name, parentId }) => {
		const parent = parentId === null ? undefined : parents.get(parentId);
		return parent === undefined
			? { id, name, say: name }
			: { id, name: `${parent} · ${name}`, say: parent };
	});
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

/* ── Variations ─────────────────────────────────────────────────────────── */

export interface VariationInput {
	name: string;
	/** The variation's own directions. */
	notes: string | null;
}

/** A figure's unarchived variations, oldest first — the order of its version tabs. */
export function listVariations(db: Db, parentId: number): Figure[] {
	return db
		.select()
		.from(figures)
		.where(and(eq(figures.parentId, parentId), isNull(figures.archivedAt)))
		.orderBy(asc(figures.id))
		.all();
}

/**
 * Whether another unarchived variation of this figure already has the name,
 * ignoring case and surrounding space. Exported so the page can refuse a taken
 * name BEFORE it writes the variation's shape, not after.
 */
export function variationNameTaken(
	db: Db,
	parentId: number,
	name: string,
	exceptId: number | null
): boolean {
	const wanted = name.trim().toLowerCase();
	return listVariations(db, parentId).some(
		(v) => v.id !== exceptId && v.name.trim().toLowerCase() === wanted
	);
}

/**
 * A variation of a figure: a `figures` row with `parent_id` set, and deliberately
 * NO exercise — a variation is practised through its figure.
 *
 * Its dance, partner and style are copied from the figure, never taken from a
 * form. Everything that can differ starts unset, which reads as "the figure's".
 * Null when the figure is gone, archived, or itself a variation (one level
 * only), or when one of its variations already has the name.
 */
export function createVariation(db: Db, parentId: number, input: VariationInput): Figure | null {
	const parent = db.select().from(figures).where(eq(figures.id, parentId)).get();
	if (!parent || parent.archivedAt !== null || parent.parentId !== null) return null;
	if (variationNameTaken(db, parentId, input.name, null)) return null;
	return db
		.insert(figures)
		.values({
			name: input.name,
			notes: input.notes,
			parentId,
			dance: parent.dance,
			partner: parent.partner,
			styleTag: parent.styleTag
		})
		.returning()
		.get();
}

/**
 * Rename a variation or change its directions. Null for a base figure, a gone
 * or archived variation, or a name a sibling already uses.
 */
export function updateVariation(db: Db, id: number, input: VariationInput): Figure | null {
	const current = db.select().from(figures).where(eq(figures.id, id)).get();
	if (!current || current.parentId === null || current.archivedAt !== null) return null;
	if (variationNameTaken(db, current.parentId, input.name, id)) return null;
	return (
		db
			.update(figures)
			.set({ name: input.name, notes: input.notes })
			.where(eq(figures.id, id))
			.returning()
			.get() ?? null
	);
}

/**
 * Every figure of a dance by id, and how to show it: a variation reads
 * "Enchufla · Doble". Archived rows included — a routine slot can still name
 * one, and a name beats "archived figure".
 */
export function figureLabels(db: Db, dance: DanceSlug): Map<number, string> {
	const rows = db
		.select({ id: figures.id, name: figures.name, parentId: figures.parentId })
		.from(figures)
		.where(eq(figures.dance, dance))
		.all();
	const names = new Map(rows.map((r) => [r.id, r.name]));
	return new Map(
		rows.map((r) => [
			r.id,
			r.parentId === null ? r.name : `${names.get(r.parentId) ?? '?'} · ${r.name}`
		])
	);
}

/**
 * The unarchived figures of a dance, alphabetically, each followed by its
 * unarchived variations oldest first — what a picker that chooses a VERSION
 * offers.
 */
export function listVersions(db: Db, dance: DanceSlug): FigureVersion[] {
	const variations = db
		.select({ id: figures.id, parentId: figures.parentId, name: figures.name })
		.from(figures)
		.where(and(eq(figures.dance, dance), isNull(figures.archivedAt), isNotNull(figures.parentId)))
		.orderBy(asc(figures.id))
		.all();
	return listFigures(db, dance).flatMap((f) => [
		{ id: f.id, parentId: null, name: f.name, label: f.name },
		...variations
			.filter((v) => v.parentId === f.id)
			.map((v) => ({ id: v.id, parentId: f.id, name: v.name, label: `${f.name} · ${v.name}` }))
	]);
}
