import { and, asc, count, eq, inArray, isNotNull, isNull, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { Db } from './db';
import { assertUnlinked, clearPictures } from './spot-links';
import {
	exercises,
	figureGroups,
	figureEndPositions,
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
import { inSpace, isTeam, ownedBy, ownerValues, spaceOfRow, type Space, type Wall } from './scope';
import { entryFor, reconcileEntries, reviveEntries } from './entries';
import { trashRows, type ArchiveRestore } from './trash';
import { takenLine } from '$lib/teams/deleted';
import { addedReach, addedTeams, allows, figureAccess } from './access';
import { actingIn, fieldChange, logChange, variationRoot } from './changes';
import { ownedOrUsable, usableOf, type Usable } from './usable';
import { shadowedIds } from './clones/shadow';
import type { Partner } from '$lib/labels';
import type {
	CalledFigure,
	FigureRow,
	FigureVersion,
	MoveRow,
	MoveTarget,
	TeamRef
} from '$lib/types';
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
export const labelFor = (figureName: string, name: string) => `${figureName} · ${name}`;

/**
 * The space a figure or group row stands in, for a check that reads only its
 * owner (a name, a move target): no one acts through it.
 */
const ownerSpace = (row: { dance: string; userId: string | null; teamId: number | null }) =>
	spaceOfRow(row, '');

/** A figure's root in History: the figure (`figure_groups`), a variation its subject. */
const ofFigure = (groupId: number, subjectId: number | null = null) => ({
	rootKind: 'figure' as const,
	rootId: groupId,
	subjectId
});

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
export function syncExerciseNames(tx: Db, where: SQL | undefined) {
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

export function getGroup(db: Db, groupId: number): FigureGroup | null {
	return db.select().from(figureGroups).where(eq(figureGroups.id, groupId)).get() ?? null;
}

/** Whether another live figure in the space has the name (trimmed, case-insensitive). */
export function figureNameTaken(
	db: Db,
	space: Space,
	name: string,
	exceptGroupId: number | null
): boolean {
	const wanted = norm(name);
	return db
		.select({ id: figureGroups.id, name: figureGroups.name })
		.from(figureGroups)
		.where(and(ownedBy(figureGroups, space), isNull(figureGroups.archivedAt)))
		.all()
		.some((g) => g.id !== exceptGroupId && norm(g.name) === wanted);
}

/**
 * The live move in `space` with this name (trimmed, any case: the rule
 * `figureNameTaken` keeps unique), or a new one of that name. An archived move
 * of the name is not revived. Where a clone files its figure; inside the
 * caller's transaction, and logs nothing (the clone logs its own line).
 */
export function moveFor(tx: Db, space: Space, name: string): number {
	const wanted = norm(name);
	const found = tx
		.select({ id: figureGroups.id, name: figureGroups.name })
		.from(figureGroups)
		.where(and(ownedBy(figureGroups, space), isNull(figureGroups.archivedAt)))
		.orderBy(asc(figureGroups.id))
		.all()
		.find((g) => norm(g.name) === wanted);
	if (found) return found.id;
	return tx
		.insert(figureGroups)
		.values({ ...ownerValues(space), name: name.trim() })
		.returning({ id: figureGroups.id })
		.get().id;
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
	space: Space,
	input: FigureInput & { figureName: string }
): { figure: Figure; group: FigureGroup } | null {
	const { figureName, ...rest } = input;
	if (!isStyleOf(space.dance, rest.style)) return null;
	if (!figureName.trim() || !rest.name.trim()) return null;
	if (figureNameTaken(db, space, figureName, null)) return null;
	return db.transaction((tx) => {
		const group = tx
			.insert(figureGroups)
			.values({ ...ownerValues(space), name: figureName })
			.returning()
			.get();
		const figure = tx
			.insert(figures)
			.values({
				...values(rest),
				...ownerValues(space),
				groupId: group.id,
				startCount: 1,
				lengthCounts: DEFAULT_LENGTH_COUNTS
			})
			.returning()
			.get();
		logChange(
			tx,
			space,
			{
				...ofFigure(group.id, group.id),
				verb: 'add',
				subject: 'figure',
				after: { name: figureName }
			},
			Date.now()
		);
		return { figure, group };
	});
}

/**
 * A blank variation in an existing figure — the shape `createFigure` gives a
 * first one (starts on 1, 8 counts, no positions), nothing copied
 * from a sibling, and no exercise. Null when the figure is gone or archived,
 * the style is not of its dance, or the name is empty or taken.
 */
export function createVariationIn(
	db: Db,
	groupId: number,
	input: FigureInput,
	by?: string
): Figure | null {
	if (!input.name.trim()) return null;
	return db.transaction((tx) => {
		const group = getGroup(tx, groupId);
		if (!group || group.archivedAt !== null) return null;
		if (!isStyleOf(group.dance as DanceSlug, input.style)) return null;
		if (variationNameTaken(tx, group.id, input.name, null)) return null;
		const made = tx
			.insert(figures)
			.values({
				...values(input),
				dance: group.dance,
				userId: group.userId,
				teamId: group.teamId,
				groupId: group.id,
				startCount: 1,
				lengthCounts: DEFAULT_LENGTH_COUNTS
			})
			.returning()
			.get();
		logVariation(tx, actingIn(group, by), made, Date.now());
		return made;
	});
}

/**
 * Copy a variation within its figure: partner, style, notes, start and end
 * positions, start count and length. Nothing that belongs to the source
 * itself — recordings, links, lesson links, its exercise. Null when the source
 * is gone or archived, or the name is empty or taken.
 */
export function createVariationFrom(
	db: Db,
	fromId: number,
	name: string,
	by?: string
): Figure | null {
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
				teamId: src.teamId,
				styleTag: src.styleTag,
				groupId: src.groupId,
				startCount: src.startCount,
				lengthCounts: src.lengthCounts
			})
			.returning()
			.get();
		// Both sides' tags, archived ones too: the copy is danced as the source is.
		// Raw ids are right here: the copy has the source's owner, so every tag
		// the source may hold (its owner's, or a group's it may use) the copy may
		// hold too. The clone engine, which copies across places, maps them
		// (`copyFigure`, `Mapper.ref`).
		for (const table of [figureStartPositions, figureEndPositions]) {
			const tags = tx
				.select({ positionId: table.positionId })
				.from(table)
				.where(eq(table.figureId, fromId))
				.all();
			if (tags.length > 0) {
				tx.insert(table)
					.values(tags.map((t) => ({ figureId: copy.id, positionId: t.positionId })))
					.run();
			}
		}
		logVariation(tx, actingIn(copy, by), copy, Date.now());
		return copy;
	});
}

/**
 * Edit a variation. Its exercise, if any, is renamed to the label so the two
 * never drift. Null when it is gone or archived, the style is not of its own
 * dance, the name is empty, or a sibling has the name. In a group, `by` is
 * who, for History (`verb` is `restore` for History's own Restore).
 */
export function updateVariation(
	db: Db,
	id: number,
	input: FigureInput,
	by?: string,
	now = Date.now(),
	verb: 'change' | 'restore' = 'change'
): Figure | null {
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
		// The keys are the edit form's, as the clash check's `variationSeen` has them.
		const fields = (f: Figure) => ({
			name: f.name,
			partner: f.partner,
			style: f.styleTag,
			notes: f.notes
		});
		const change = fieldChange(fields(current), fields(figure), 'variation');
		if (change) {
			logChange(
				tx,
				actingIn(current, by),
				{ ...ofFigure(current.groupId, id), verb, ...change },
				now
			);
		}
		return figure;
	});
}

/**
 * Rename a figure. False for an empty name or another figure's; every
 * exercise of its variations follows. `by` and `verb` as `updateVariation`.
 */
export function renameFigure(
	db: Db,
	groupId: number,
	name: string,
	by?: string,
	now = Date.now(),
	verb: 'change' | 'restore' = 'change'
): boolean {
	return db.transaction((tx) => {
		const group = tx.select().from(figureGroups).where(eq(figureGroups.id, groupId)).get();
		if (!group || !name.trim()) return false;
		if (figureNameTaken(tx, ownerSpace(group), name, groupId)) return false;
		tx.update(figureGroups).set({ name }).where(eq(figureGroups.id, groupId)).run();
		syncExerciseNames(tx, eq(figures.groupId, groupId));
		const change = fieldChange({ figureName: group.name }, { figureName: name }, 'figure');
		if (change) {
			logChange(tx, actingIn(group, by), { ...ofFigure(groupId, groupId), verb, ...change }, now);
		}
		return true;
	});
}

/** History's line for a new variation in a figure. */
function logVariation(tx: Db, space: Space, made: Figure, now: number): void {
	if (made.groupId === null) return;
	logChange(
		tx,
		space,
		{
			...ofFigure(made.groupId, made.id),
			verb: 'add',
			subject: 'variation',
			after: { name: made.name }
		},
		now
	);
}

/**
 * Give a person their own exercise for a variation, so it shows on Today;
 * named with its label. Null for a missing or archived variation, one the
 * person cannot see, and one this person already has a live exercise for. A
 * group's variation also has to be in a lesson the person ADDED (ruling R8,
 * editors included): an entry lives only while an added lesson holds its
 * target, which is what `reconcileEntries` keeps. An
 * archived entry of theirs comes back (the same row, so its sets stay) instead
 * of a second one, keeping its old `everyDays` (the argument is ignored then).
 * The only writer of `source: 'figure'`. The entry is always
 * the caller's, never the figure's owner's.
 */
export function addFigureExercise(db: Db, userId: string, figureId: number, everyDays = 3) {
	return db.transaction((tx) => {
		const figure = tx.select().from(figures).where(eq(figures.id, figureId)).get();
		if (!figure || figure.archivedAt !== null) return null;
		// The person's own variation, or a group's they may read (risk 21): the id
		// comes from a form, and an entry hands out the variation's content.
		if (!allows(figureAccess(tx, userId, figure), 'read')) return null;
		if (figure.teamId !== null && !addedReach(tx, userId, figure.teamId).variations.has(figureId)) {
			return null;
		}
		const label = labelOf(tx, figureId);
		if (label === null) return null;
		const existing = entryFor(tx, userId, { figureId });
		if (existing) {
			if (existing.archivedAt === null) return null;
			return (
				tx
					.update(exercises)
					.set({ archivedAt: null, name: label })
					.where(eq(exercises.id, existing.id))
					.returning()
					.get() ?? null
			);
		}
		return tx
			.insert(exercises)
			.values({
				name: label,
				source: 'figure',
				figureId,
				dance: figure.dance,
				userId,
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
 * is already archived or gone. A group's takes every person's entry for it,
 * and what only it brought into their added lessons (`reconcileEntries`).
 */
export function archiveVariation(
	db: Db,
	id: number,
	now: number,
	by?: string
): { figureRemoved: boolean } | null {
	return db.transaction((tx) => {
		const row = tx.select().from(figures).where(eq(figures.id, id)).get();
		if (!row || row.archivedAt !== null || row.groupId === null) return null;
		tx.update(figures).set({ archivedAt: now }).where(eq(figures.id, id)).run();
		tx.update(exercises)
			.set({ archivedAt: now })
			.where(and(eq(exercises.figureId, id), isNull(exercises.archivedAt)))
			.run();
		const figureRemoved = archiveGroupIfEmpty(tx, row.groupId, now);
		// A group's: members' entries follow its shrunken reach (risk 25).
		if (row.teamId !== null) reconcileEntries(tx, row.teamId, now);
		logChange(
			tx,
			actingIn(row, by),
			{
				...ofFigure(row.groupId, id),
				verb: 'archive',
				subject: 'variation',
				before: { name: row.name }
			},
			now
		);
		return { figureRemoved };
	});
}

/**
 * Bring an archived variation back (Recently deleted), and its figure with it
 * when that went too, with exactly the entries its archive took: those
 * archived at the variation's own `archived_at` (risk 6). Refused, changing
 * nothing, when its name — or its figure's, for a figure that went with it —
 * was taken since: "Enchufla is taken; rename that one first".
 */
export function restoreVariation(db: Db, space: Space, id: number, now: number): ArchiveRestore {
	return db.transaction((tx) => {
		const row = tx.select().from(figures).where(eq(figures.id, id)).get();
		const group = row?.groupId ? getGroup(tx, row.groupId) : null;
		if (!row || !group || row.archivedAt === null || !inSpace(row, space)) {
			return { ok: false, reason: 'gone' } as const;
		}
		if (group.archivedAt !== null && figureNameTaken(tx, space, group.name, group.id)) {
			return { ok: false, reason: 'taken', message: takenLine(group.name) } as const;
		}
		if (variationNameTaken(tx, group.id, row.name, row.id)) {
			return {
				ok: false,
				reason: 'taken',
				message: takenLine(labelFor(group.name, row.name))
			} as const;
		}
		const at = row.archivedAt;
		tx.update(figures).set({ archivedAt: null }).where(eq(figures.id, id)).run();
		if (group.archivedAt !== null) {
			tx.update(figureGroups).set({ archivedAt: null }).where(eq(figureGroups.id, group.id)).run();
		}
		tx.update(exercises)
			.set({ archivedAt: null })
			.where(and(eq(exercises.figureId, id), eq(exercises.archivedAt, at)))
			.run();
		if (isTeam(space)) reviveEntries(tx, space.teamId, at);
		logChange(
			tx,
			space,
			{
				...ofFigure(group.id, id),
				verb: 'restore',
				subject: 'variation',
				after: { name: row.name }
			},
			now
		);
		return { ok: true } as const;
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
export function moveVariation(db: Db, id: number, to: MoveTo, by?: string): MoveResult {
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
			if (!g || g.archivedAt !== null || !inSpace(g, ownerSpace(row))) {
				return { ok: false, reason: 'gone' };
			}
			if (g.id === from) return { ok: false, reason: 'same-figure' };
			if (to.name?.trim()) name = to.name.trim();
			if (variationNameTaken(tx, g.id, name, id)) return { ok: false, reason: 'name-taken' };
			target = g.id;
		} else {
			const name = to.newFigure.trim();
			if (!name || figureNameTaken(tx, ownerSpace(row), name, null)) {
				return { ok: false, reason: 'figure-name-taken' };
			}
			target = tx
				.insert(figureGroups)
				.values({ dance: row.dance, userId: row.userId, teamId: row.teamId, name })
				.returning()
				.get().id;
		}
		tx.update(figures).set({ groupId: target, name }).where(eq(figures.id, id)).run();
		syncExerciseNames(tx, eq(figures.id, id));
		const now = Date.now();
		// Filed under the figure it joined: that is where its page now leads.
		logChange(
			tx,
			actingIn(row, by),
			{
				...ofFigure(target, id),
				verb: 'add',
				subject: 'variation',
				after: { name, from: getGroup(tx, from)?.name ?? null }
			},
			now
		);
		return { ok: true, groupId: target, figureRemoved: archiveGroupIfEmpty(tx, from, now) };
	});
}

export interface FigureFilter {
	q?: string;
	style?: string;
	partner?: Partner;
	/** Only figures with no section, or no lesson, among their variations. */
	unlinked?: boolean;
	/** Only these variations count (a group's, as far as the person's added lessons reach). */
	only?: ReadonlySet<number>;
}

/**
 * The variation ids in `space` linked to a section of one of the space's own
 * videos, and those a live lesson of the space reaches — by hand or through a
 * section of one of its videos (the rule `lesson-links.ts` reads per lesson,
 * here in bulk for the whole list). A member's own section or lesson linked
 * to a group's variation counts for the member, never in the group's list.
 */
function linkedVariations(db: Db, space: Space): { section: Set<number>; lesson: Set<number> } {
	const ids = (rows: { id: number | null }[]) =>
		new Set(rows.flatMap((r) => (r.id === null ? [] : [r.id])));
	const ofDance = and(ownedBy(figures, space), isNotNull(spotLinks.figureId));
	// The section's video: a recording's variation or a lesson video's lesson.
	const recordingOf = alias(figures, 'recording_of');
	const section = ids(
		db
			.selectDistinct({ id: spotLinks.figureId })
			.from(spotLinks)
			.innerJoin(figures, eq(figures.id, spotLinks.figureId))
			.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
			.leftJoin(recordings, eq(recordings.id, videoSpots.recordingId))
			.leftJoin(recordingOf, eq(recordingOf.id, recordings.figureId))
			.leftJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
			.leftJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
			.where(
				and(
					ofDance,
					or(
						and(isNotNull(videoSpots.recordingId), ownedBy(recordingOf, space)),
						and(isNotNull(videoSpots.lessonVideoId), ownedBy(lessons, space))
					)
				)
			)
			.all()
	);
	const byHand = db
		.selectDistinct({ id: lessonFigures.figureId })
		.from(lessonFigures)
		.innerJoin(figures, eq(figures.id, lessonFigures.figureId))
		.innerJoin(lessons, eq(lessons.id, lessonFigures.lessonId))
		.where(and(ownedBy(figures, space), ownedBy(lessons, space), isNull(lessons.archivedAt)))
		.all();
	const viaSections = db
		.selectDistinct({ id: spotLinks.figureId })
		.from(spotLinks)
		.innerJoin(figures, eq(figures.id, spotLinks.figureId))
		.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
		.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(and(ofDance, ownedBy(lessons, space), isNull(lessons.archivedAt)))
		.all();
	return { section, lesson: ids([...byHand, ...viaSections]) };
}

/**
 * Moves with the live figures that match the filter (a move with none is left
 * out). `q` also matches the move's name, which lists all its figures. Not
 * linked keeps a figure that lacks a section or a lesson.
 */
export function listFigures(db: Db, space: Space, filter: FigureFilter = {}): MoveRow[] {
	const groups = db
		.select()
		.from(figureGroups)
		.where(and(ownedBy(figureGroups, space), isNull(figureGroups.archivedAt)))
		.orderBy(asc(figureGroups.name))
		.all();
	const rows = db
		.select({
			id: figures.id,
			groupId: figures.groupId,
			name: figures.name,
			partner: figures.partner,
			style: figures.styleTag,
			startCount: figures.startCount,
			lengthCounts: figures.lengthCounts,
			recordings: count(recordings.id)
		})
		.from(figures)
		.leftJoin(recordings, eq(recordings.figureId, figures.id))
		.where(and(ownedBy(figures, space), isNull(figures.archivedAt), isNotNull(figures.groupId)))
		.groupBy(figures.id)
		.orderBy(asc(figures.id))
		.all();
	const linked = linkedVariations(db, space);
	const q = filter.q ? filter.q.trim().toLowerCase() : '';
	const items: MoveRow[] = [];
	for (const g of groups) {
		const vs = rows.filter((r) => r.groupId === g.id && (!filter.only || filter.only.has(r.id)));
		const moveMatches = !q || g.name.toLowerCase().includes(q);
		const listed: FigureRow[] = [];
		for (const v of vs) {
			if (
				!(moveMatches || v.name.toLowerCase().includes(q)) ||
				(filter.style && v.style !== filter.style) ||
				(filter.partner && v.partner !== filter.partner)
			) {
				continue;
			}
			const hasSection = linked.section.has(v.id);
			const hasLesson = linked.lesson.has(v.id);
			if (filter.unlinked && hasSection && hasLesson) continue;
			listed.push({
				id: v.id,
				name: v.name,
				label: labelFor(g.name, v.name),
				startCount: v.startCount,
				lengthCounts: v.lengthCounts,
				recordings: v.recordings,
				hasSection,
				hasLesson
			});
		}
		if (listed.length > 0) items.push({ id: g.id, name: g.name, figures: listed });
	}
	return items;
}

/**
 * Moves' group sections: for each group of this dance whose lessons the
 * person added, the figures those lessons reach (only their reached
 * variations), groups by name. Never in the person's own list, the gap report
 * or coverage: those read the person's wall. The filter applies as to their
 * own; Not linked is about their own figures and is not passed here.
 */
export function listAddedFigures(
	db: Db,
	wall: Wall,
	filter: Omit<FigureFilter, 'only' | 'unlinked'> = {}
): { team: TeamRef; moves: MoveRow[] }[] {
	const out: { team: TeamRef; moves: MoveRow[] }[] = [];
	for (const team of addedTeams(db, wall)) {
		const only = addedReach(db, wall.userId, team.id).variations;
		if (only.size === 0) continue;
		const space = { dance: wall.dance, teamId: team.id, actorId: wall.userId };
		// Yours replaces theirs: a figure you made your own copy of shows in your
		// own list; a move left with none disappears from this section.
		const hidden = shadowedIds(db, wall, 'figure', [...only]);
		const moves = listFigures(db, space, { ...filter, only })
			.map((m) => ({ ...m, figures: m.figures.filter((fig) => !hidden.has(fig.id)) }))
			.filter((m) => m.figures.length > 0);
		if (moves.length > 0) out.push({ team, moves });
	}
	return out;
}

/**
 * The variations a routine can call, by id, with what the player shows (the
 * label) and says (the figure's name — a spoken call has three counts to fit
 * in). Archived ones are excluded: the planner will never reach one. A
 * person's routine may call the group figures they may use (`usableOf`).
 */
export function listFiguresForCall(
	db: Db,
	space: Space,
	ids: number[],
	usable?: Usable
): CalledFigure[] {
	if (ids.length === 0) return [];
	return db
		.select({ id: figures.id, figure: figureGroups.name, name: figures.name })
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(
			and(whoseFigures(db, space, usable), isNull(figures.archivedAt), inArray(figures.id, ids))
		)
		.orderBy(asc(figureGroups.name), asc(figures.id))
		.all()
		.map((r) => ({ id: r.id, name: labelFor(r.figure, r.name), say: r.figure }));
}

/**
 * Live figures of the dance with their variations' names, by name — where a
 * variation can move to (every figure but its own), or where a lesson can add
 * one (`exceptGroupId` null: every figure).
 */
export function listMoveTargets(db: Db, space: Space, exceptGroupId: number | null): MoveTarget[] {
	return listFigures(db, space)
		.filter((g) => g.id !== exceptGroupId)
		.map((g) => ({
			id: g.id,
			name: g.name,
			variations: listGroupVariations(db, g.id).map((v) => v.name)
		}));
}

export function getFigure(db: Db, id: number, userId: string) {
	const figure = db.select().from(figures).where(eq(figures.id, id)).get();
	if (!figure) return null;
	const exercise = entryFor(db, userId, { figureId: id });
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

/** A variation's new recording; in a group, History says who added it (`by`). */
export function addRecording(db: Db, input: RecordingInput, by?: string) {
	return db.transaction((tx) => {
		const rec = tx.insert(recordings).values(input).returning().get();
		logRecording(tx, rec, 'add', by);
		return rec;
	});
}

/** History's line for a recording added or deleted, filed under its figure. */
function logRecording(
	tx: Db,
	rec: { id: number; figureId: number },
	verb: 'add' | 'remove',
	by: string | undefined,
	trashId: number | null = null
): void {
	const root = variationRoot(tx, rec.figureId);
	if (!root) return;
	const { row, ...at } = root;
	logChange(
		tx,
		actingIn(row, by),
		{ ...at, verb, subject: 'recording', subjectId: rec.id, trashId },
		Date.now()
	);
}

/**
 * Delete a recording row and return it, with `trashId`, so the caller knows
 * whether to remove the file. Its spots go first, in the same transaction —
 * the foreign key would refuse the recording otherwise. Throws
 * `SpotLinkedError`, deleting nothing, while one of its sections is linked to
 * a figure or drill.
 *
 * A group's recording goes to Recently deleted first, with its sections and
 * its file: `trashId` is set and the caller leaves the file on disk (risk 19).
 */
export function deleteRecording(db: Db, id: number, by?: string, now = Date.now()) {
	return db.transaction((tx) => {
		assertUnlinked(tx, { recordingId: id });
		const spots = tx.select().from(videoSpots).where(eq(videoSpots.recordingId, id)).all();
		clearPictures(
			tx,
			spots.map((s) => s.id)
		);
		tx.delete(videoSpots).where(eq(videoSpots.recordingId, id)).run();
		const rec = tx.delete(recordings).where(eq(recordings.id, id)).returning().get() ?? null;
		if (!rec) return null;
		const root = variationRoot(tx, rec.figureId);
		const space = root ? actingIn(root.row, by) : null;
		const trashId =
			root && space && isTeam(space)
				? trashRows(
						tx,
						space,
						'recording',
						labelOf(tx, rec.figureId) ?? 'Figure',
						{ rootKind: root.rootKind, rootId: root.rootId },
						{ recordings: [rec], video_spots: spots },
						[{ dir: 'recordings', file: rec.file }],
						rec.sizeBytes,
						now
					)
				: null;
		logRecording(tx, rec, 'remove', by, trashId);
		return { ...rec, trashId };
	});
}

/**
 * The variations a space's routines may hold: its own, and for a person the
 * group variations they may use, of the same dance. A group's: its own only.
 */
function whoseFigures(db: Db, space: Space, usable?: Usable): SQL {
	if (isTeam(space)) return ownedBy(figures, space);
	return ownedOrUsable(figures, space, (usable ?? usableOf(db, space)).figures);
}

/**
 * Every variation of a dance by id, and how to show it — always
 * "Enchufla · Doble", even for a figure with one variation. Archived rows
 * included: a routine slot can still name one, and a name beats "archived".
 * A person's also names the group figures they may use (`usableOf`): their
 * routines may hold those.
 */
export function figureLabels(db: Db, space: Space, usable?: Usable): Map<number, string> {
	return new Map(
		db
			.select({ id: figures.id, figure: figureGroups.name, name: figures.name })
			.from(figures)
			.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
			.where(whoseFigures(db, space, usable))
			.all()
			.map((r) => [r.id, labelFor(r.figure, r.name)])
	);
}

/** Live variations of live figures, by figure name then variation id — what a picker offers. */
export function listVersions(db: Db, space: Space): FigureVersion[] {
	return db
		.select({
			id: figures.id,
			groupId: figureGroups.id,
			figure: figureGroups.name,
			name: figures.name
		})
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(
			and(ownedBy(figures, space), isNull(figures.archivedAt), isNull(figureGroups.archivedAt))
		)
		.orderBy(asc(figureGroups.name), asc(figures.id))
		.all()
		.map((r) => ({ ...r, label: labelFor(r.figure, r.name) }));
}
