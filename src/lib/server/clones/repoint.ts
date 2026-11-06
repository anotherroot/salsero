/**
 * Re-point a person's own rows from one row to another, in one transaction:
 * Edit (make it mine), Drop my copy, Move to…, leaving a group and the rescue
 * all move "everything of mine that used X" onto Y with it.
 *
 * Only rows the person owns move: their personal routines' slot options and
 * embeds, their personal lessons' hand links, the section links on their own
 * videos (a recording of their figure, a video of their lesson), their own
 * exercises (practice entries with their sets, song picks), their twin rows,
 * and a lesson add. For a position: their figures' start and end tags, their
 * lessons' hand links and the position links on their own sections and
 * points (a position has no practice; their positions' pictures stay). A group's rows and another person's rows are never read
 * for writing. Archived rows of the person's move too, so restoring one never
 * brings back a pointer at a dropped copy.
 *
 * `repoint` never archives a root (`fromId` itself, or a personal drill):
 * the caller does, when its flow says so. It does archive an entry that was
 * merged into another, since one person has one entry per target.
 */
import { and, asc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import type { AddPicks, CloneKind, TwinKind } from '$lib/types';
import type { DanceSlug } from '$lib/dances/dances';
import type { Db } from '../db';
import {
	exercises,
	figureEndPositions,
	figureGroups,
	figures,
	figureStartPositions,
	lessonExercises,
	lessonFigures,
	lessonPositions,
	lessonRoutines,
	lessons,
	lessonVideos,
	positions,
	recordings,
	routines,
	routineStepOptions,
	routineSteps,
	sets,
	songDrops,
	songLinks,
	songs,
	spotLinks,
	spotPositionLinks,
	todayPicks,
	twins,
	videoSpots
} from '../db/schema';
import { inSpace, ownedBy, type Wall } from '../scope';
import { ownLinks } from '../song-links';
import { labelFor } from '../figures';
import { reviewName } from '../lessons';
import { addLesson } from '../entries';

export type RepointReport = {
	/** The person's routines whose slots or embeds moved, archived included, by name. */
	routines: { id: number; name: string }[];
	/** The person's lessons whose hand links moved, archived included, by title. */
	lessons: { id: number; title: string }[];
	/** Section links on the person's videos that moved. */
	sections: number;
	/** Practice that moved: entries (and a personal drill's sets), or song picks. */
	entries: number;
	/** The person's twin row for the source: 0 or 1. */
	twins: number;
	/** A position: the person's figures whose start or end tags moved, archived included, by label. */
	figures: { id: number; label: string }[];
};

export type RepointOptions = {
	/** Move practice too: entries with their sets, song picks. Without it, practice stays. */
	entries: boolean;
	/** A lesson only: add the target (a group lesson) to the person's own, as `touch:false`. */
	addLesson?: boolean;
};

type Exercise = typeof exercises.$inferSelect;
type Owned = { id: number; dance: string; userId: string | null; teamId: number | null };
type Root = Owned & { name: string };

const TWIN_KINDS: Partial<Record<CloneKind, TwinKind>> = {
	figure: 'figure',
	routine: 'routine',
	lesson: 'lesson',
	song: 'song',
	position: 'position'
};

/** A root row of the kind with the name its entries carry, or null. Drills are `custom` exercises. */
function rootOf(db: Db, kind: CloneKind, id: number): Root | null {
	const owner = (
		t:
			| typeof figures
			| typeof routines
			| typeof exercises
			| typeof songs
			| typeof lessons
			| typeof positions
	) => ({ id: t.id, dance: t.dance, userId: t.userId, teamId: t.teamId }) as const;
	switch (kind) {
		case 'figure': {
			const row = db
				.select({ ...owner(figures), move: figureGroups.name, variation: figures.name })
				.from(figures)
				.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
				.where(eq(figures.id, id))
				.get();
			return row ? { ...row, name: labelFor(row.move, row.variation) } : null;
		}
		case 'routine':
			return (
				db
					.select({ ...owner(routines), name: routines.name })
					.from(routines)
					.where(eq(routines.id, id))
					.get() ?? null
			);
		case 'drill':
			return (
				db
					.select({ ...owner(exercises), name: exercises.name })
					.from(exercises)
					.where(and(eq(exercises.id, id), eq(exercises.source, 'custom')))
					.get() ?? null
			);
		case 'song':
			return (
				db
					.select({ ...owner(songs), name: songs.title })
					.from(songs)
					.where(eq(songs.id, id))
					.get() ?? null
			);
		case 'lesson': {
			const row = db
				.select({ ...owner(lessons), title: lessons.title })
				.from(lessons)
				.where(eq(lessons.id, id))
				.get();
			return row ? { ...row, name: reviewName(row.title) } : null;
		}
		case 'position':
			return (
				db
					.select({ ...owner(positions), name: positions.name })
					.from(positions)
					.where(eq(positions.id, id))
					.get() ?? null
			);
	}
}

/** Everything of the person's that points at `fromId`, found once for the preview and the move. */
type Found = {
	/** Figure: slot options in the person's routines. */
	options: { stepId: number; routineId: number }[];
	/** Routine: slots of the person's routines embedding it. */
	embeds: { stepId: number; routineId: number }[];
	/** The person's lessons linking it by hand. */
	lessonIds: number[];
	/** Section links on the person's videos. */
	spotLinkIds: number[];
	/** The person's exercises practising it (for a personal drill: the drill itself, when live). */
	entries: Exercise[];
	/** Song: the person's exercises using it, and those whose drop remembers it. */
	songPicks: number[];
	songDropIds: number[];
	/** Song: the Music rows of the person's own lessons, drills and routines suggesting it. */
	songLinkIds: number[];
	twin: { setId: string } | null;
	/** Position: the person's figures starting in it, and ending in it. */
	starts: number[];
	ends: number[];
	/** Position: its links on the person's sections and points. */
	spotPositionLinkIds: number[];
};

function find(db: Db, wall: Wall, kind: CloneKind, from: Root): Found {
	const fromId = from.id;
	const found: Found = {
		options: [],
		embeds: [],
		lessonIds: [],
		spotLinkIds: [],
		entries: [],
		songPicks: [],
		songDropIds: [],
		songLinkIds: [],
		twin: null,
		starts: [],
		ends: [],
		spotPositionLinkIds: []
	};
	const mine = ownedBy(exercises, wall);

	if (kind === 'figure') {
		found.options = db
			.select({ stepId: routineStepOptions.stepId, routineId: routineSteps.routineId })
			.from(routineStepOptions)
			.innerJoin(routineSteps, eq(routineSteps.id, routineStepOptions.stepId))
			.innerJoin(routines, eq(routines.id, routineSteps.routineId))
			.where(and(eq(routineStepOptions.figureId, fromId), ownedBy(routines, wall)))
			.all();
	}
	if (kind === 'routine') {
		found.embeds = db
			.select({ stepId: routineSteps.id, routineId: routineSteps.routineId })
			.from(routineSteps)
			.innerJoin(routines, eq(routines.id, routineSteps.routineId))
			.where(and(eq(routineSteps.childRoutineId, fromId), ownedBy(routines, wall)))
			.all();
	}

	if (kind === 'position') {
		for (const [table, list] of [
			[figureStartPositions, found.starts],
			[figureEndPositions, found.ends]
		] as const) {
			for (const r of db
				.select({ id: table.figureId })
				.from(table)
				.innerJoin(figures, eq(figures.id, table.figureId))
				.where(and(eq(table.positionId, fromId), ownedBy(figures, wall)))
				.all())
				list.push(r.id);
		}
		found.spotPositionLinkIds = db
			.select({ id: spotPositionLinks.id })
			.from(spotPositionLinks)
			.innerJoin(videoSpots, eq(videoSpots.id, spotPositionLinks.spotId))
			.leftJoin(recordings, eq(recordings.id, videoSpots.recordingId))
			.leftJoin(figures, eq(figures.id, recordings.figureId))
			.leftJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
			.leftJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
			.where(
				and(
					eq(spotPositionLinks.positionId, fromId),
					or(ownedBy(figures, wall), ownedBy(lessons, wall))
				)
			)
			.all()
			.map((r) => r.id);
	}

	const hand =
		kind === 'figure'
			? { table: lessonFigures, col: lessonFigures.figureId, lesson: lessonFigures.lessonId }
			: kind === 'routine'
				? { table: lessonRoutines, col: lessonRoutines.routineId, lesson: lessonRoutines.lessonId }
				: kind === 'drill'
					? {
							table: lessonExercises,
							col: lessonExercises.exerciseId,
							lesson: lessonExercises.lessonId
						}
					: kind === 'position'
						? {
								table: lessonPositions,
								col: lessonPositions.positionId,
								lesson: lessonPositions.lessonId
							}
						: null;
	if (hand) {
		found.lessonIds = db
			.select({ id: hand.lesson })
			.from(hand.table)
			.innerJoin(lessons, eq(lessons.id, hand.lesson))
			.where(and(eq(hand.col, fromId), ownedBy(lessons, wall)))
			.all()
			.map((r) => r.id);
	}

	const spotCol =
		kind === 'figure' ? spotLinks.figureId : kind === 'drill' ? spotLinks.exerciseId : null;
	if (spotCol) {
		found.spotLinkIds = db
			.select({ id: spotLinks.id })
			.from(spotLinks)
			.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
			.leftJoin(recordings, eq(recordings.id, videoSpots.recordingId))
			.leftJoin(figures, eq(figures.id, recordings.figureId))
			.leftJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
			.leftJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
			.where(and(eq(spotCol, fromId), or(ownedBy(figures, wall), ownedBy(lessons, wall))))
			.all()
			.map((r) => r.id);
	}

	if (kind === 'figure' || kind === 'routine' || kind === 'lesson') {
		const col =
			kind === 'figure'
				? exercises.figureId
				: kind === 'routine'
					? exercises.routineId
					: exercises.lessonId;
		found.entries = db
			.select()
			.from(exercises)
			.where(and(mine, eq(col, fromId)))
			.all();
	}
	if (kind === 'drill') {
		if (inSpace(from, wall)) {
			const drill = db.select().from(exercises).where(eq(exercises.id, fromId)).get()!;
			found.entries = drill.archivedAt === null ? [drill] : [];
		} else {
			found.entries = db
				.select()
				.from(exercises)
				.where(and(mine, eq(exercises.drillId, fromId)))
				.all();
		}
	}
	if (kind === 'song') {
		found.songLinkIds = db
			.select({ id: songLinks.id })
			.from(songLinks)
			.where(and(ownLinks(db, wall), eq(songLinks.songId, fromId)))
			.all()
			.map((r) => r.id);
		found.songPicks = db
			.select({ id: exercises.id })
			.from(exercises)
			.where(and(mine, eq(exercises.songId, fromId)))
			.all()
			.map((r) => r.id);
		found.songDropIds = db
			.select({ id: songDrops.exerciseId })
			.from(songDrops)
			.innerJoin(exercises, eq(exercises.id, songDrops.exerciseId))
			.where(and(mine, eq(songDrops.songId, fromId)))
			.all()
			.map((r) => r.id);
	}

	const twinKind = TWIN_KINDS[kind];
	if (twinKind) {
		found.twin =
			db
				.select({ setId: twins.setId })
				.from(twins)
				.where(
					and(eq(twins.userId, wall.userId), eq(twins.kind, twinKind), eq(twins.itemId, fromId))
				)
				.get() ?? null;
	}
	return found;
}

function reportOf(db: Db, kind: CloneKind, found: Found, entries: boolean): RepointReport {
	const routineIds = [...new Set([...found.options, ...found.embeds].map((s) => s.routineId))];
	const lessonIds = [...new Set(found.lessonIds)];
	const practice = kind === 'song' ? found.songPicks.length : found.entries.length;
	const figureIds = [...new Set([...found.starts, ...found.ends])];
	return {
		routines:
			routineIds.length === 0
				? []
				: db
						.select({ id: routines.id, name: routines.name })
						.from(routines)
						.where(inArray(routines.id, routineIds))
						.all()
						.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id),
		lessons:
			lessonIds.length === 0
				? []
				: db
						.select({ id: lessons.id, title: lessons.title })
						.from(lessons)
						.where(inArray(lessons.id, lessonIds))
						.all()
						.sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id),
		sections: found.spotLinkIds.length + found.spotPositionLinkIds.length,
		entries: entries ? practice : 0,
		twins: found.twin ? 1 : 0,
		figures:
			figureIds.length === 0
				? []
				: db
						.select({ id: figures.id, move: figureGroups.name, name: figures.name })
						.from(figures)
						.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
						.where(inArray(figures.id, figureIds))
						.all()
						.map((f) => ({ id: f.id, label: labelFor(f.move, f.name) }))
						.sort((a, b) => a.label.localeCompare(b.label) || a.id - b.id)
	};
}

function rootOrThrow(db: Db, wall: Wall, kind: CloneKind, id: number): Root {
	const row = rootOf(db, kind, id);
	if (!row || row.dance !== wall.dance)
		throw new Error(`repoint: no ${kind} ${id} in ${wall.dance}`);
	return row;
}

/**
 * What `repoint` would move off `fromId`, reading only: equal to the report of
 * a following `repoint` with `entries: true` (it does not depend on the target:
 * a row that would clash with the target is still a row that moves).
 */
export function repointPreview(
	db: Db,
	userId: string,
	dance: DanceSlug,
	kind: CloneKind,
	fromId: number
): RepointReport {
	const wall: Wall = { userId, dance };
	return reportOf(db, kind, find(db, wall, kind, rootOrThrow(db, wall, kind, fromId)), true);
}

/**
 * Practice carried from one exercise onto another: the sets and the day's picks move. When `from`
 * is live (not archived) and `into` is archived, or `into` is paused while
 * `from` is active (a copy starts paused while its source is practised, R23),
 * `revive` gives `into` `from`'s schedule, practice settings and active state,
 * unarchived: the live practice wins. `archiveFrom` archives a live `from` at
 * `now`, so one person never has two live exercises on one target.
 */
function carry(
	tx: Db,
	from: Exercise,
	into: Exercise,
	opts: { archiveFrom: boolean; revive: boolean; name: string | null },
	now: number
): void {
	tx.update(sets).set({ exerciseId: into.id }).where(eq(sets.exerciseId, from.id)).run();
	// The day's picks go with the sets, so Today keeps the row (and a skip stays a skip).
	tx.update(todayPicks)
		.set({ exerciseId: into.id })
		.where(eq(todayPicks.exerciseId, from.id))
		.run();
	const patch: Partial<Exercise> = opts.name === null ? {} : { name: opts.name };
	const wins =
		from.archivedAt === null && (into.archivedAt !== null || (!into.active && from.active));
	if (wins && opts.revive) {
		Object.assign(patch, {
			archivedAt: null,
			everyDays: from.everyDays,
			active: from.active,
			practiceMode: from.practiceMode,
			songId: from.songId,
			countBpm: from.countBpm,
			practiceJson: from.practiceJson
		});
	}
	if (Object.keys(patch).length > 0) {
		tx.update(exercises).set(patch).where(eq(exercises.id, into.id)).run();
	}
	if (from.archivedAt === null && opts.archiveFrom) {
		tx.update(exercises).set({ archivedAt: now }).where(eq(exercises.id, from.id)).run();
	}
}

type EntryCol = 'figureId' | 'routineId' | 'lessonId' | 'drillId';

/** The person's exercise on a target, archived included (the unique index counts both). */
function entryOn(tx: Db, wall: Wall, col: EntryCol, id: number): Exercise | null {
	return (
		tx
			.select()
			.from(exercises)
			.where(and(ownedBy(exercises, wall), eq(exercises[col], id)))
			.get() ?? null
	);
}

/** An entry moved to `toId`, or merged into the person's exercise already there. */
function moveEntry(
	tx: Db,
	wall: Wall,
	entry: Exercise,
	col: EntryCol,
	to: Root,
	now: number
): void {
	const there = entryOn(tx, wall, col, to.id);
	if (!there) {
		tx.update(exercises)
			.set({ [col]: to.id, name: to.name })
			.where(eq(exercises.id, entry.id))
			.run();
		return;
	}
	carry(tx, entry, there, { archiveFrom: true, revive: true, name: to.name }, now);
}

/**
 * A drill's practice. From a group drill the person's `added` entry goes: onto
 * a personal drill (sets moved, the entry archived, its settings taken when the
 * drill is paused: `carry`; never an archived drill, `repoint` refuses one) or
 * a group drill (moved or merged). From a personal drill its own sets go: onto a personal drill, or
 * onto the person's entry for a group drill, made or brought back with the
 * personal drill's settings.
 */
function moveDrillPractice(
	tx: Db,
	wall: Wall,
	practice: Exercise,
	from: Root,
	to: Root,
	now: number
): void {
	const toRow = tx.select().from(exercises).where(eq(exercises.id, to.id)).get()!;
	const toMine = inSpace(to, wall);
	if (!inSpace(from, wall)) {
		if (toMine) carry(tx, practice, toRow, { archiveFrom: true, revive: true, name: null }, now);
		else moveEntry(tx, wall, practice, 'drillId', to, now);
		return;
	}
	if (toMine) {
		carry(tx, practice, toRow, { archiveFrom: false, revive: false, name: null }, now);
		return;
	}
	const there =
		entryOn(tx, wall, 'drillId', to.id) ??
		tx
			.insert(exercises)
			.values({
				name: to.name,
				source: 'added',
				drillId: to.id,
				dance: wall.dance,
				userId: wall.userId,
				everyDays: practice.everyDays,
				active: practice.active,
				practiceMode: practice.practiceMode,
				songId: practice.songId,
				countBpm: practice.countBpm,
				practiceJson: practice.practiceJson
			})
			.returning()
			.get();
	carry(tx, practice, there, { archiveFrom: false, revive: true, name: to.name }, now);
}

/**
 * The person's twin row for `fromId` names `toId` instead. When `toId` already
 * has a row, the old one goes and its set joins the target's (what was the
 * same as the source is now the same as the target); a set left with one row
 * is gone, since a twin of nothing means nothing.
 */
function moveTwin(tx: Db, userId: string, kind: TwinKind, fromId: number, toId: number): void {
	const mine = and(eq(twins.userId, userId), eq(twins.kind, kind));
	const row = tx
		.select()
		.from(twins)
		.where(and(mine, eq(twins.itemId, fromId)))
		.get();
	if (!row) return;
	const there = tx
		.select()
		.from(twins)
		.where(and(mine, eq(twins.itemId, toId)))
		.get();
	if (!there) {
		tx.update(twins)
			.set({ itemId: toId })
			.where(and(mine, eq(twins.itemId, fromId)))
			.run();
		return;
	}
	tx.delete(twins)
		.where(and(mine, eq(twins.itemId, fromId)))
		.run();
	if (there.setId !== row.setId) {
		tx.update(twins)
			.set({ setId: there.setId })
			.where(and(mine, eq(twins.setId, row.setId)))
			.run();
	}
	const left = tx
		.select()
		.from(twins)
		.where(and(mine, eq(twins.setId, there.setId)))
		.all();
	if (left.length === 1) {
		tx.delete(twins)
			.where(and(mine, eq(twins.setId, there.setId)))
			.run();
	}
}

const NO_PICKS: AddPicks = { lesson: false, routineIds: [], drillIds: [], figureIds: [] };

/**
 * The embedding slots that may take `toId`: none when `toId` embeds a routine
 * itself (one level of embedding). That covers a slot of `toId` itself, which
 * would make it embed itself: such a slot already makes `toId` a nesting
 * routine. A skipped slot stays on `fromId` and is in no report, so here a
 * `repointPreview` (which cannot know the target) counts what `repoint` skips.
 */
function embeddable(
	db: Db,
	toId: number,
	embeds: { stepId: number; routineId: number }[]
): { stepId: number; routineId: number }[] {
	if (embeds.length === 0) return embeds;
	const nests = db
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.where(and(eq(routineSteps.routineId, toId), isNotNull(routineSteps.childRoutineId)))
		.get();
	return nests ? [] : embeds;
}

/**
 * Move the person's own rows from `fromId` to `toId` (see the module comment
 * for which), in one transaction. A row that would duplicate one already on
 * the target (a slot holding both, a lesson linking both, a section linked to
 * both, two entries) is merged into it. `toId` must be of the same kind and
 * dance; the caller has checked the person may use it.
 */
export function repoint(
	tx: Db,
	userId: string,
	dance: DanceSlug,
	kind: CloneKind,
	fromId: number,
	toId: number,
	opts: RepointOptions,
	now: number
): RepointReport {
	if (fromId === toId) throw new Error('repoint: a row onto itself');
	const wall: Wall = { userId, dance };
	return tx.transaction((db) => {
		const from = rootOrThrow(db, wall, kind, fromId);
		const to = rootOrThrow(db, wall, kind, toId);
		if (kind === 'drill' && !inSpace(from, wall) && inSpace(to, wall)) {
			const drill = db.select().from(exercises).where(eq(exercises.id, toId)).get()!;
			if (drill.archivedAt !== null) throw new Error(`repoint: drill ${toId} is archived`);
		}
		const found = find(db, wall, kind, from);
		if (kind === 'routine') found.embeds = embeddable(db, toId, found.embeds);
		const report = reportOf(db, kind, found, opts.entries);

		for (const { stepId } of found.options) {
			// Main figure first (routines.ts' MAIN_FIRST): on a clash the earlier row keeps its place.
			const order = db
				.select({ figureId: routineStepOptions.figureId })
				.from(routineStepOptions)
				.where(eq(routineStepOptions.stepId, stepId))
				.orderBy(asc(routineStepOptions.createdAt), sql`routine_step_options.rowid`)
				.all()
				.map((o) => o.figureId);
			const at = (id: number) =>
				and(eq(routineStepOptions.stepId, stepId), eq(routineStepOptions.figureId, id));
			const held = order.indexOf(toId);
			if (held !== -1 && held < order.indexOf(fromId)) {
				db.delete(routineStepOptions).where(at(fromId)).run();
				continue;
			}
			if (held !== -1) db.delete(routineStepOptions).where(at(toId)).run();
			db.update(routineStepOptions).set({ figureId: toId }).where(at(fromId)).run();
		}

		if (found.embeds.length > 0) {
			db.update(routineSteps)
				.set({ childRoutineId: toId })
				.where(
					inArray(
						routineSteps.id,
						found.embeds.map((s) => s.stepId)
					)
				)
				.run();
		}

		for (const lessonId of new Set(found.lessonIds)) {
			if (kind === 'figure') {
				const of = (id: number) =>
					and(eq(lessonFigures.lessonId, lessonId), eq(lessonFigures.figureId, id));
				if (db.select().from(lessonFigures).where(of(toId)).get())
					db.delete(lessonFigures).where(of(fromId)).run();
				else db.update(lessonFigures).set({ figureId: toId }).where(of(fromId)).run();
			} else if (kind === 'routine') {
				const of = (id: number) =>
					and(eq(lessonRoutines.lessonId, lessonId), eq(lessonRoutines.routineId, id));
				if (db.select().from(lessonRoutines).where(of(toId)).get())
					db.delete(lessonRoutines).where(of(fromId)).run();
				else db.update(lessonRoutines).set({ routineId: toId }).where(of(fromId)).run();
			} else if (kind === 'drill') {
				const of = (id: number) =>
					and(eq(lessonExercises.lessonId, lessonId), eq(lessonExercises.exerciseId, id));
				if (db.select().from(lessonExercises).where(of(toId)).get())
					db.delete(lessonExercises).where(of(fromId)).run();
				else db.update(lessonExercises).set({ exerciseId: toId }).where(of(fromId)).run();
			} else if (kind === 'position') {
				const of = (id: number) =>
					and(eq(lessonPositions.lessonId, lessonId), eq(lessonPositions.positionId, id));
				if (db.select().from(lessonPositions).where(of(toId)).get())
					db.delete(lessonPositions).where(of(fromId)).run();
				else db.update(lessonPositions).set({ positionId: toId }).where(of(fromId)).run();
			}
		}

		// A figure's tags: one row per figure and position, so a tag already on the target merges.
		for (const [table, list] of [
			[figureStartPositions, found.starts],
			[figureEndPositions, found.ends]
		] as const) {
			for (const figureId of new Set(list)) {
				const of = (id: number) => and(eq(table.figureId, figureId), eq(table.positionId, id));
				if (db.select().from(table).where(of(toId)).get()) db.delete(table).where(of(fromId)).run();
				else db.update(table).set({ positionId: toId }).where(of(fromId)).run();
			}
		}

		for (const id of found.spotPositionLinkIds) {
			const link = db.select().from(spotPositionLinks).where(eq(spotPositionLinks.id, id)).get()!;
			const held = db
				.select()
				.from(spotPositionLinks)
				.where(
					and(eq(spotPositionLinks.spotId, link.spotId), eq(spotPositionLinks.positionId, toId))
				)
				.get();
			if (held) db.delete(spotPositionLinks).where(eq(spotPositionLinks.id, id)).run();
			else
				db.update(spotPositionLinks)
					.set({ positionId: toId })
					.where(eq(spotPositionLinks.id, id))
					.run();
		}

		// A figure's or a drill's only: `find` leaves `spotLinkIds` empty for the other kinds.
		const spotCol = kind === 'figure' ? spotLinks.figureId : spotLinks.exerciseId;
		for (const id of found.spotLinkIds) {
			const link = db.select().from(spotLinks).where(eq(spotLinks.id, id)).get()!;
			const held = db
				.select()
				.from(spotLinks)
				.where(and(eq(spotLinks.spotId, link.spotId), eq(spotCol, toId)))
				.get();
			if (held) db.delete(spotLinks).where(eq(spotLinks.id, id)).run();
			else
				db.update(spotLinks)
					.set(kind === 'figure' ? { figureId: toId } : { exerciseId: toId })
					.where(eq(spotLinks.id, id))
					.run();
		}

		if (opts.entries) {
			for (const entry of found.entries) {
				if (kind === 'drill') moveDrillPractice(db, wall, entry, from, to, now);
				else if (kind === 'figure' || kind === 'routine' || kind === 'lesson') {
					const col =
						kind === 'figure' ? 'figureId' : kind === 'routine' ? 'routineId' : 'lessonId';
					moveEntry(db, wall, entry, col, to, now);
				}
			}
			if (found.songPicks.length > 0) {
				db.update(exercises)
					.set({ songId: toId })
					.where(inArray(exercises.id, found.songPicks))
					.run();
			}
			// A Music row moves to the new song, or goes where its parent already suggests that one.
			for (const linkId of found.songLinkIds) {
				const link = db.select().from(songLinks).where(eq(songLinks.id, linkId)).get();
				if (!link) continue;
				const parent =
					link.lessonId !== null
						? eq(songLinks.lessonId, link.lessonId)
						: link.exerciseId !== null
							? eq(songLinks.exerciseId, link.exerciseId)
							: eq(songLinks.routineId, link.routineId!);
				const there = db
					.select({ id: songLinks.id })
					.from(songLinks)
					.where(and(parent, eq(songLinks.songId, toId)))
					.get();
				if (there) db.delete(songLinks).where(eq(songLinks.id, linkId)).run();
				else db.update(songLinks).set({ songId: toId }).where(eq(songLinks.id, linkId)).run();
			}
			if (found.songDropIds.length > 0) {
				db.delete(songDrops)
					.where(
						and(eq(songDrops.songId, fromId), inArray(songDrops.exerciseId, found.songDropIds))
					)
					.run();
			}
		}

		const twinKind = TWIN_KINDS[kind];
		if (twinKind) moveTwin(db, userId, twinKind, fromId, toId);

		if (kind === 'lesson' && opts.addLesson) {
			addLesson(db, userId, toId, NO_PICKS, now, { touch: false });
		}
		return report;
	});
}
