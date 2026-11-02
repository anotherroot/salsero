import { and, asc, count, eq, inArray, isNotNull, isNull, type SQL } from 'drizzle-orm';
import type { Db } from './db';
import { assertUnlinked } from './spot-links';
import {
	exercises,
	figureGroups,
	figureStartPositions,
	figures,
	lessonFigures,
	lessonVideos,
	lessons,
	recordings,
	spotLinks,
	videoSpots,
	type Figure,
	type FigureGroup
} from './db/schema';
import { isStyleOf, type DanceSlug } from '$lib/dances/dances';
import type { Wall } from './scope';
import type { Partner } from '$lib/labels';
import type { CalledFigure, FigureListItem, FigureVersion, MoveTarget } from '$lib/types';
import { DEFAULT_LENGTH_COUNTS } from '$lib/graph/timing';

export interface FigureInput {
	/** The VARIATION's name; the figure's is `figureName` on `createFigure`. */
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

const norm = (name: string) => name.trim().toLowerCase();

/** "Enchufla · Doble" — the figure's name and the variation's. */
const labelFor = (figureName: string, name: string) => `${figureName} · ${name}`;

/** The wall a figure or group row stands in (its owner is never null once written). */
function wallOfRow(row: { dance: string; userId: string | null }): Wall {
	return { dance: row.dance as DanceSlug, userId: row.userId ?? '' };
}

/** The label of one variation, or null when it is gone. */
function labelOf(tx: Db, figureId: number): string | null {
	const row = tx
		.select({ figure: figureGroups.name, name: figures.name })
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(eq(figures.id, figureId))
		.get();
	return row ? labelFor(row.figure, row.name) : null;
}

/** Rename the exercises of the variations matching `where` to their labels. */
function syncExerciseNames(tx: Db, where: SQL | undefined) {
	const rows = tx
		.select({ figureId: figures.id, figure: figureGroups.name, name: figures.name })
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(where)
		.all();
	for (const r of rows) {
		tx.update(exercises)
			.set({ name: labelFor(r.figure, r.name) })
			.where(eq(exercises.figureId, r.figureId))
			.run();
	}
}

const inWallGroups = (wall: Wall) =>
	and(eq(figureGroups.dance, wall.dance), eq(figureGroups.userId, wall.userId));
const inWallFigures = (wall: Wall) =>
	and(eq(figures.dance, wall.dance), eq(figures.userId, wall.userId));

export function getGroup(db: Db, groupId: number): FigureGroup | null {
	return db.select().from(figureGroups).where(eq(figureGroups.id, groupId)).get() ?? null;
}

/** Whether another live figure in the wall has the name (trimmed, case-insensitive). */
export function figureNameTaken(
	db: Db,
	wall: Wall,
	name: string,
	exceptGroupId: number | null
): boolean {
	const wanted = norm(name);
	return db
		.select({ id: figureGroups.id, name: figureGroups.name })
		.from(figureGroups)
		.where(and(inWallGroups(wall), isNull(figureGroups.archivedAt)))
		.all()
		.some((g) => g.id !== exceptGroupId && norm(g.name) === wanted);
}

/** A figure's live variations, oldest first — the order of the variation bar and sheet. */
export function listGroupVariations(db: Db, groupId: number): Figure[] {
	return db
		.select()
		.from(figures)
		.where(and(eq(figures.groupId, groupId), isNull(figures.archivedAt)))
		.orderBy(asc(figures.id))
		.all();
}

/**
 * Whether another live variation of this figure already has the name. Exported
 * so a page can refuse a taken name BEFORE it writes the variation's shape.
 */
export function variationNameTaken(
	db: Db,
	groupId: number,
	name: string,
	exceptId: number | null
): boolean {
	const wanted = norm(name);
	return listGroupVariations(db, groupId).some((v) => v.id !== exceptId && norm(v.name) === wanted);
}

/**
 * Create a figure: its group and its first variation, in one transaction. The
 * variation is a blank shape (starts on 1, 8 counts, no positions) and has no
 * exercise — `addFigureExercise` is opt-in.
 *
 * Null when the style is not one of the dance's, a name is empty, or the figure
 * name is taken.
 */
export function createFigure(
	db: Db,
	wall: Wall,
	input: FigureInput & { figureName: string }
): { figure: Figure; group: FigureGroup } | null {
	const { figureName, ...rest } = input;
	if (!isStyleOf(wall.dance, rest.style)) return null;
	if (!figureName.trim() || !rest.name.trim()) return null;
	if (figureNameTaken(db, wall, figureName, null)) return null;
	return db.transaction((tx) => {
		const group = tx
			.insert(figureGroups)
			.values({ dance: wall.dance, userId: wall.userId, name: figureName })
			.returning()
			.get();
		const figure = tx
			.insert(figures)
			.values({
				...values(rest),
				dance: wall.dance,
				userId: wall.userId,
				groupId: group.id,
				startCount: 1,
				lengthCounts: DEFAULT_LENGTH_COUNTS
			})
			.returning()
			.get();
		return { figure, group };
	});
}

/**
 * A blank variation in an existing figure — the shape `createFigure` gives a
 * first one (starts on 1, 8 counts, neutral start and end), nothing copied
 * from a sibling, and no exercise. Null when the figure is gone or archived,
 * the style is not of its dance, or the name is empty or taken.
 */
export function createVariationIn(db: Db, groupId: number, input: FigureInput): Figure | null {
	if (!input.name.trim()) return null;
	return db.transaction((tx) => {
		const group = getGroup(tx, groupId);
		if (!group || group.archivedAt !== null) return null;
		if (!isStyleOf(group.dance as DanceSlug, input.style)) return null;
		if (variationNameTaken(tx, group.id, input.name, null)) return null;
		return tx
			.insert(figures)
			.values({
				...values(input),
				dance: group.dance,
				userId: group.userId,
				groupId: group.id,
				startCount: 1,
				lengthCounts: DEFAULT_LENGTH_COUNTS
			})
			.returning()
			.get();
	});
}

/**
 * Copy a variation within its figure: partner, style, notes, start positions,
 * end position, start count and length. Nothing that belongs to the source
 * itself — recordings, links, lesson links, its exercise. Null when the source
 * is gone or archived, or the name is empty or taken.
 */
export function createVariationFrom(db: Db, fromId: number, name: string): Figure | null {
	if (!name.trim()) return null;
	return db.transaction((tx) => {
		const src = tx.select().from(figures).where(eq(figures.id, fromId)).get();
		if (!src || src.archivedAt !== null || src.groupId === null) return null;
		if (variationNameTaken(tx, src.groupId, name, null)) return null;
		const copy = tx
			.insert(figures)
			.values({
				name,
				notes: src.notes,
				partner: src.partner,
				dance: src.dance,
				userId: src.userId,
				styleTag: src.styleTag,
				groupId: src.groupId,
				endPositionId: src.endPositionId,
				startCount: src.startCount,
				lengthCounts: src.lengthCounts
			})
			.returning()
			.get();
		const starts = tx
			.select({ positionId: figureStartPositions.positionId })
			.from(figureStartPositions)
			.where(eq(figureStartPositions.figureId, fromId))
			.all();
		if (starts.length > 0) {
			tx.insert(figureStartPositions)
				.values(starts.map((s) => ({ figureId: copy.id, positionId: s.positionId })))
				.run();
		}
		return copy;
	});
}

/**
 * Edit a variation. Its exercise, if any, is renamed to the label so the two
 * never drift. Null when it is gone or archived, the style is not of its own
 * dance, the name is empty, or a sibling has the name.
 */
export function updateVariation(db: Db, id: number, input: FigureInput): Figure | null {
	return db.transaction((tx) => {
		const current = tx.select().from(figures).where(eq(figures.id, id)).get();
		if (!current || current.archivedAt !== null || current.groupId === null) return null;
		if (!isStyleOf(current.dance, input.style) || !input.name.trim()) return null;
		if (variationNameTaken(tx, current.groupId, input.name, id)) return null;
		const figure = tx
			.update(figures)
			.set(values(input))
			.where(eq(figures.id, id))
			.returning()
			.get();
		syncExerciseNames(tx, eq(figures.id, id));
		return figure;
	});
}

/**
 * Rename a figure. False for an empty name or another figure's; every
 * exercise of its variations follows.
 */
export function renameFigure(db: Db, groupId: number, name: string): boolean {
	return db.transaction((tx) => {
		const group = tx.select().from(figureGroups).where(eq(figureGroups.id, groupId)).get();
		if (!group || !name.trim()) return false;
		if (figureNameTaken(tx, wallOfRow(group), name, groupId)) return false;
		tx.update(figureGroups).set({ name }).where(eq(figureGroups.id, groupId)).run();
		syncExerciseNames(tx, eq(figures.groupId, groupId));
		return true;
	});
}

/**
 * Give a variation its own exercise, so it shows on Today; named with its
 * label. Null for a missing or archived variation, and for one that already has
 * an exercise, archived or not. The only writer of `source: 'figure'`.
 */
export function addFigureExercise(db: Db, figureId: number, everyDays = 3) {
	return db.transaction((tx) => {
		const figure = tx.select().from(figures).where(eq(figures.id, figureId)).get();
		if (!figure || figure.archivedAt !== null) return null;
		const label = labelOf(tx, figureId);
		if (label === null) return null;
		const existing = tx
			.select({ id: exercises.id })
			.from(exercises)
			.where(eq(exercises.figureId, figureId))
			.get();
		if (existing) return null;
		return tx
			.insert(exercises)
			.values({
				name: label,
				source: 'figure',
				figureId,
				dance: figure.dance,
				userId: figure.userId,
				everyDays
			})
			.returning()
			.get();
	});
}

/** Archive the group when it has no live variation left; whether it did. */
function archiveGroupIfEmpty(tx: Db, groupId: number, now: number): boolean {
	const live = tx
		.select({ id: figures.id })
		.from(figures)
		.where(and(eq(figures.groupId, groupId), isNull(figures.archivedAt)))
		.get();
	if (live) return false;
	tx.update(figureGroups)
		.set({ archivedAt: now })
		.where(and(eq(figureGroups.id, groupId), isNull(figureGroups.archivedAt)))
		.run();
	return true;
}

/**
 * Archive one variation and its exercise; its figure goes too when it was the
 * last live variation. Sets and recordings are kept. Null when the variation
 * is already archived or gone.
 */
export function archiveVariation(
	db: Db,
	id: number,
	now: number
): { figureRemoved: boolean } | null {
	return db.transaction((tx) => {
		const row = tx.select().from(figures).where(eq(figures.id, id)).get();
		if (!row || row.archivedAt !== null || row.groupId === null) return null;
		tx.update(figures).set({ archivedAt: now }).where(eq(figures.id, id)).run();
		tx.update(exercises).set({ archivedAt: now }).where(eq(exercises.figureId, id)).run();
		return { figureRemoved: archiveGroupIfEmpty(tx, row.groupId, now) };
	});
}

/** Whether archiving or moving this variation would leave its figure empty. */
export function isLastVariation(db: Db, id: number): boolean {
	const row = db.select().from(figures).where(eq(figures.id, id)).get();
	if (!row || row.archivedAt !== null || row.groupId === null) return false;
	return listGroupVariations(db, row.groupId).every((v) => v.id === id);
}

/**
 * Where a variation moves: an existing figure — under `name` when given, so a
 * clash there can be resolved on the way in — or a new figure of its own.
 */
export type MoveTo = { groupId: number; name?: string } | { newFigure: string };
export type MoveResult =
	| { ok: true; groupId: number; figureRemoved: boolean }
	| { ok: false; reason: 'gone' | 'same-figure' | 'name-taken' | 'figure-name-taken' };

/**
 * Move a variation into another figure, or into a new one of its own. The row
 * keeps its id, so recordings, links, section links, lesson links, routine
 * options and its exercise all go with it; the exercise is renamed to the new
 * label. The figure it leaves is archived when no live variation is left.
 * Joining a figure with a non-blank `name` renames the variation in the same
 * transaction; the target's names are checked against that name.
 */
export function moveVariation(db: Db, id: number, to: MoveTo): MoveResult {
	return db.transaction((tx): MoveResult => {
		const row = tx.select().from(figures).where(eq(figures.id, id)).get();
		if (!row || row.archivedAt !== null || row.groupId === null) {
			return { ok: false, reason: 'gone' };
		}
		const from = row.groupId;
		let target: number;
		let name = row.name;
		if ('groupId' in to) {
			const g = getGroup(tx, to.groupId);
			if (!g || g.archivedAt !== null || g.dance !== row.dance || g.userId !== row.userId) {
				return { ok: false, reason: 'gone' };
			}
			if (g.id === from) return { ok: false, reason: 'same-figure' };
			if (to.name?.trim()) name = to.name.trim();
			if (variationNameTaken(tx, g.id, name, id)) return { ok: false, reason: 'name-taken' };
			target = g.id;
		} else {
			const name = to.newFigure.trim();
			if (!name || figureNameTaken(tx, wallOfRow(row), name, null)) {
				return { ok: false, reason: 'figure-name-taken' };
			}
			target = tx
				.insert(figureGroups)
				.values({ dance: row.dance, userId: row.userId, name })
				.returning()
				.get().id;
		}
		tx.update(figures).set({ groupId: target, name }).where(eq(figures.id, id)).run();
		syncExerciseNames(tx, eq(figures.id, id));
		return { ok: true, groupId: target, figureRemoved: archiveGroupIfEmpty(tx, from, Date.now()) };
	});
}

export interface FigureFilter {
	q?: string;
	style?: string;
	partner?: Partner;
	/** Only figures with no section, or no lesson, among their variations. */
	unlinked?: boolean;
}

/**
 * The variation ids of `dance` linked to a section anywhere, and those a live
 * lesson reaches — by hand or through a section of one of its videos (the rule
 * `lesson-links.ts` reads per lesson, here in bulk for the whole list).
 */
function linkedVariations(db: Db, wall: Wall): { section: Set<number>; lesson: Set<number> } {
	const ids = (rows: { id: number | null }[]) =>
		new Set(rows.flatMap((r) => (r.id === null ? [] : [r.id])));
	const ofDance = and(inWallFigures(wall), isNotNull(spotLinks.figureId));
	const section = ids(
		db
			.selectDistinct({ id: spotLinks.figureId })
			.from(spotLinks)
			.innerJoin(figures, eq(figures.id, spotLinks.figureId))
			.where(ofDance)
			.all()
	);
	const byHand = db
		.selectDistinct({ id: lessonFigures.figureId })
		.from(lessonFigures)
		.innerJoin(figures, eq(figures.id, lessonFigures.figureId))
		.innerJoin(lessons, eq(lessons.id, lessonFigures.lessonId))
		.where(and(inWallFigures(wall), eq(lessons.dance, wall.dance), isNull(lessons.archivedAt)))
		.all();
	const viaSections = db
		.selectDistinct({ id: spotLinks.figureId })
		.from(spotLinks)
		.innerJoin(figures, eq(figures.id, spotLinks.figureId))
		.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
		.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(and(ofDance, isNull(lessons.archivedAt)))
		.all();
	return { section, lesson: ids([...byHand, ...viaSections]) };
}

/**
 * One row per live figure. A filter matches when any live variation does; `q`
 * also matches the figure's own name. `hasSection`/`hasLesson` look at every
 * live variation, whatever the filter matched.
 */
export function listFigures(db: Db, wall: Wall, filter: FigureFilter = {}): FigureListItem[] {
	const groups = db
		.select()
		.from(figureGroups)
		.where(and(inWallGroups(wall), isNull(figureGroups.archivedAt)))
		.orderBy(asc(figureGroups.name))
		.all();
	const rows = db
		.select({
			id: figures.id,
			groupId: figures.groupId,
			name: figures.name,
			partner: figures.partner,
			style: figures.styleTag,
			recordings: count(recordings.id)
		})
		.from(figures)
		.leftJoin(recordings, eq(recordings.figureId, figures.id))
		.where(and(inWallFigures(wall), isNull(figures.archivedAt), isNotNull(figures.groupId)))
		.groupBy(figures.id)
		.orderBy(asc(figures.id))
		.all();
	const linked = linkedVariations(db, wall);
	const q = filter.q ? filter.q.trim().toLowerCase() : '';
	const items: FigureListItem[] = [];
	for (const g of groups) {
		const vs = rows.filter((r) => r.groupId === g.id);
		if (vs.length === 0) continue;
		const matching = vs.filter(
			(v) =>
				(!q || g.name.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)) &&
				(!filter.style || v.style === filter.style) &&
				(!filter.partner || v.partner === filter.partner)
		);
		if (matching.length === 0) continue;
		const hasSection = vs.some((v) => linked.section.has(v.id));
		const hasLesson = vs.some((v) => linked.lesson.has(v.id));
		if (filter.unlinked && hasSection && hasLesson) continue;
		items.push({
			id: g.id,
			name: g.name,
			variations: vs.length,
			recordings: vs.reduce((n, v) => n + v.recordings, 0),
			firstVariationId: vs[0].id,
			hasSection,
			hasLesson
		});
	}
	return items;
}

/**
 * The variations a routine can call, by id, with what the player shows (the
 * label) and says (the figure's name — a spoken call has three counts to fit
 * in). Archived ones are excluded: the planner will never reach one.
 */
export function listFiguresForCall(db: Db, wall: Wall, ids: number[]): CalledFigure[] {
	if (ids.length === 0) return [];
	return db
		.select({ id: figures.id, figure: figureGroups.name, name: figures.name })
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(and(inWallFigures(wall), isNull(figures.archivedAt), inArray(figures.id, ids)))
		.orderBy(asc(figureGroups.name), asc(figures.id))
		.all()
		.map((r) => ({ id: r.id, name: labelFor(r.figure, r.name), say: r.figure }));
}

/**
 * Live figures of the dance with their variations' names, by name — where a
 * variation can move to (every figure but its own), or where a lesson can add
 * one (`exceptGroupId` null: every figure).
 */
export function listMoveTargets(db: Db, wall: Wall, exceptGroupId: number | null): MoveTarget[] {
	return listFigures(db, wall)
		.filter((g) => g.id !== exceptGroupId)
		.map((g) => ({
			id: g.id,
			name: g.name,
			variations: listGroupVariations(db, g.id).map((v) => v.name)
		}));
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

/**
 * Delete a recording row and return it, so the caller can remove the file.
 * Its spots go first, in the same transaction — the foreign key would refuse
 * the recording otherwise. Throws `SpotLinkedError`, deleting nothing, while
 * one of its sections is linked to a figure or drill.
 */
export function deleteRecording(db: Db, id: number) {
	return db.transaction((tx) => {
		assertUnlinked(tx, { recordingId: id });
		tx.delete(videoSpots).where(eq(videoSpots.recordingId, id)).run();
		return tx.delete(recordings).where(eq(recordings.id, id)).returning().get() ?? null;
	});
}

export function getRecordingByFile(db: Db, file: string) {
	return db.select().from(recordings).where(eq(recordings.file, file)).get() ?? null;
}

/**
 * Every variation of a dance by id, and how to show it — always
 * "Enchufla · Doble", even for a figure with one variation. Archived rows
 * included: a routine slot can still name one, and a name beats "archived".
 */
export function figureLabels(db: Db, wall: Wall): Map<number, string> {
	return new Map(
		db
			.select({ id: figures.id, figure: figureGroups.name, name: figures.name })
			.from(figures)
			.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
			.where(inWallFigures(wall))
			.all()
			.map((r) => [r.id, labelFor(r.figure, r.name)])
	);
}

/** Live variations of live figures, by figure name then variation id — what a picker offers. */
export function listVersions(db: Db, wall: Wall): FigureVersion[] {
	return db
		.select({
			id: figures.id,
			groupId: figureGroups.id,
			figure: figureGroups.name,
			name: figures.name
		})
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(and(inWallFigures(wall), isNull(figures.archivedAt), isNull(figureGroups.archivedAt)))
		.orderBy(asc(figureGroups.name), asc(figures.id))
		.all()
		.map((r) => ({ ...r, label: labelFor(r.figure, r.name) }));
}
