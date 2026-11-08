import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import {
	FACES,
	effectiveComesBack,
	parseComesBack,
	comesBackWords,
	serializeComesBack,
	type ComesBack
} from '$lib/schedule/comes-back';
import { alias } from 'drizzle-orm/sqlite-core';
import type { Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	lessons,
	routines,
	sets,
	songDrops,
	songs,
	teams
} from './db/schema';
import { inSpace, isTeam, ownerValues, type Space, type Wall } from './scope';
import { reconcileEntries, reviveEntries } from './entries';
import { practiceSong } from './access';
import type { ArchiveRestore } from './trash';
import { actingIn, fieldChange, logChange } from './changes';
import type { PracticeInput } from '$lib/exercises/practice';
import { deletedGroupName } from '$lib/exercises/today';
import { withLocale } from '$lib/i18n/current';
import { localDay, noonOf } from '$lib/day/day';
import type {
	DaySet,
	ExerciseItem,
	ExerciseSummary,
	HistorySet,
	PickExercise,
	SetSnapshot
} from '$lib/types';

/**
 * Every exercise that has not been archived, with its figure's partner flag
 * and, for an entry on a group's thing, that group (read through the target:
 * the entry itself is the person's).
 */
export function listExercises(db: Db, wall: Wall): ExerciseItem[] {
	const drills = alias(exercises, 'drills');
	const rows = db
		.select({
			id: exercises.id,
			name: exercises.name,
			source: exercises.source,
			figureId: exercises.figureId,
			lessonId: exercises.lessonId,
			routineId: exercises.routineId,
			partner: figures.partner,
			practiceMode: exercises.practiceMode,
			songId: exercises.songId,
			countBpm: exercises.countBpm,
			practiceJson: exercises.practiceJson,
			everyDays: exercises.everyDays,
			active: exercises.active,
			notes: exercises.notes,
			createdAt: exercises.createdAt,
			ownComesBack: exercises.comesBack,
			drillComesBack: drills.comesBack,
			warmup: exercises.warmup,
			warmupOrder: exercises.warmupOrder,
			teamId: sql<
				number | null
			>`coalesce(${lessons.teamId}, ${routines.teamId}, ${figures.teamId}, ${drills.teamId})`
		})
		.from(exercises)
		.leftJoin(figures, eq(figures.id, exercises.figureId))
		.leftJoin(lessons, eq(lessons.id, exercises.lessonId))
		.leftJoin(routines, eq(routines.id, exercises.routineId))
		.leftJoin(drills, eq(drills.id, exercises.drillId))
		.where(
			and(
				isNull(exercises.archivedAt),
				eq(exercises.dance, wall.dance),
				eq(exercises.userId, wall.userId)
			)
		)
		.all();
	const ids = [...new Set(rows.flatMap((r) => (r.teamId === null ? [] : [r.teamId])))];
	const names = new Map(
		ids.length === 0
			? []
			: db
					.select({ id: teams.id, name: teams.name })
					.from(teams)
					.where(inArray(teams.id, ids))
					.all()
					.map((t) => [t.id, t.name] as [number, string])
	);
	return rows.map(({ teamId, ownComesBack, drillComesBack, ...r }) => {
		const own = parseComesBack(ownComesBack);
		const teacher = r.source === 'added' ? parseComesBack(drillComesBack) : null;
		return {
			...r,
			comesBack: effectiveComesBack(r.source, own, teacher),
			comesBackOwn: own,
			comesBackTeacher: teacher,
			archived: false,
			team: teamId === null ? null : { id: teamId, name: names.get(teamId) ?? '' }
		};
	});
}

/** Every live exercise of the dance as a picker offers it, by name. Nothing is linked. */
export function listPickExercises(db: Db, wall: Wall): PickExercise[] {
	return db
		.select({
			id: exercises.id,
			name: exercises.name,
			source: exercises.source,
			everyDays: exercises.everyDays,
			figure: figureGroups.name,
			variation: figures.name
		})
		.from(exercises)
		.leftJoin(figures, eq(figures.id, exercises.figureId))
		.leftJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(
			and(
				isNull(exercises.archivedAt),
				eq(exercises.dance, wall.dance),
				eq(exercises.userId, wall.userId)
			)
		)
		.orderBy(asc(exercises.name), asc(exercises.id))
		.all()
		.map((r) => ({ ...r, linked: false }));
}

/**
 * The (exercise, time) pairs the schedule is replayed from, for ONE dance. The join
 * is how a set knows its dance: `sets` carries no `dance` column on purpose —
 * it would be a second copy of a fact that can drift.
 */
export function listSetTimes(db: Db, wall: Wall): { exerciseId: number; doneAt: number }[] {
	return db
		.select({ exerciseId: sets.exerciseId, doneAt: sets.doneAt })
		.from(sets)
		.innerJoin(exercises, eq(exercises.id, sets.exerciseId))
		.where(and(eq(exercises.dance, wall.dance), eq(exercises.userId, wall.userId)))
		.all();
}

export function getExercise(db: Db, id: number) {
	return db.select().from(exercises).where(eq(exercises.id, id)).get() ?? null;
}

/** What the exercise page's settings form edits. Practice choices are the panel's, not these. */
export interface SettingsInput {
	name: string;
	/**
	 * No form sets it any more (the schedule is the sets'; `every_days` is only the
	 * first gap). Left out, a create takes the column default and an update keeps
	 * the row's; a restore passes the row's own value through.
	 */
	everyDays?: number;
	active: boolean;
	notes: string | null;
	/** The person's own Warm-up switch; a group's row never takes it. Undefined keeps. */
	warmup?: boolean;
	/**
	 * Drills (`custom`, `added`) only. `'teacher'` clears an entry's own so it follows the
	 * class drill again (anywhere else it just clears). Undefined keeps.
	 */
	comesBack?: ComesBack | 'teacher';
}

/** The column a Comes back setting is stored as: null = by how it went / follow the teacher. */
const storedComesBack = (c: ComesBack | 'teacher') =>
	c === 'teacher' ? null : serializeComesBack(c);

/**
 * A drill in a person's or a group's space. It starts with no song, and a
 * group's never gets one: songs are personal, and a group drill holding its
 * editor's song would play it to everyone (see `setPracticeSettings`).
 */
export function createCustomExercise(db: Db, space: Space, input: Omit<SettingsInput, 'active'>) {
	const { warmup, comesBack, ...rest } = input;
	return db.transaction((tx) => {
		const drill = tx
			.insert(exercises)
			.values({
				...rest,
				source: 'custom',
				...ownerValues(space),
				songId: null,
				// Warm-up is a person's own; a group's drill never holds it.
				...(warmup && !isTeam(space) ? { warmup: true } : {}),
				...(comesBack !== undefined ? { comesBack: storedComesBack(comesBack) } : {})
			})
			.returning()
			.get();
		logChange(
			tx,
			space,
			{ ...ofDrill(drill.id), verb: 'add', subject: 'drill', after: { name: drill.name } },
			Date.now()
		);
		return drill;
	});
}

/** A drill's root in History, and the drill as its own subject. */
const ofDrill = (id: number) => ({ rootKind: 'drill' as const, rootId: id, subjectId: id });

/**
 * Edit an exercise's settings. An owned exercise takes its NAME from its owner
 * (figure, lesson, routine, a group's drill), so a name passed for one is
 * ignored rather than letting the two drift apart. A drill's rename reaches
 * every entry that practises it (`drill_id`), the way a figure's does. In a
 * group, `by` is who, for History (`verb` is `restore` for its Restore); a
 * group drill's Active is no one's, so only name and notes count.
 */
export function updateExercise(
	db: Db,
	id: number,
	input: SettingsInput,
	by?: string,
	now = Date.now(),
	verb: 'change' | 'restore' = 'change'
) {
	return db.transaction((tx) => {
		const current = tx.select().from(exercises).where(eq(exercises.id, id)).get();
		if (!current) return null;
		const name = current.source === 'custom' && input.name ? input.name : current.name;
		const { warmup, comesBack, ...rest } = input;
		const isDrill = current.source === 'custom' || current.source === 'added';
		const row = tx
			.update(exercises)
			.set({
				...rest,
				name,
				...(warmup !== undefined && current.teamId === null ? { warmup } : {}),
				...(comesBack !== undefined && isDrill ? { comesBack: storedComesBack(comesBack) } : {})
			})
			.where(eq(exercises.id, id))
			.returning()
			.get();
		if (current.source === 'custom') {
			tx.update(exercises).set({ name }).where(eq(exercises.drillId, id)).run();
		}
		if (current.teamId !== null && row) {
			const fields = (e: { name: string; notes: string | null; comesBack: string | null }) => ({
				name: e.name,
				notes: e.notes,
				// History is English (not translated yet): its stored words are too.
				comesBack: withLocale('en', () => comesBackWords(parseComesBack(e.comesBack) ?? FACES))
			});
			const change = fieldChange(fields(current), fields(row), 'drill');
			if (change) logChange(tx, actingIn(current, by), { ...ofDrill(id), verb, ...change }, now);
		}
		return row;
	});
}

/**
 * Remember what the practice panel played. A song must be READY and in the
 * exercise's own dance: the pairing has no CHECK to lean on (see `schema.ts`),
 * and a stored song the panel cannot open would greet the user with an error
 * the next time. `parsePracticeInput` has already cleared the unused half of
 * the mode's pair.
 *
 * The song is the person's own or a group's they may practise to
 * (`practiceSong`: shared, in a group they are in). A group's exercise never
 * holds a song: it would play to everyone (see `createCustomExercise`).
 *
 * A new song picked is the person's own choice, so the entry's `song_drops`
 * go in the same write: a later Share again or Restore must not put a dropped
 * song back over it. Count only, or no song, is not: after a drop the app
 * itself falls back to the count, so a remembered Play on it keeps the drop
 * and the class song still comes back.
 */
export function setPracticeSettings(db: Db, id: number, input: PracticeInput): boolean {
	const current = db.select().from(exercises).where(eq(exercises.id, id)).get();
	if (!current) return false;
	if (input.mode === 'song') {
		if (current.teamId !== null || current.userId === null) return false;
		const song =
			input.songId === null
				? null
				: db.select().from(songs).where(eq(songs.id, input.songId)).get();
		if (
			!song ||
			song.dance !== current.dance ||
			song.status !== 'ready' ||
			song.archivedAt !== null ||
			!practiceSong(db, current.userId, song)
		) {
			return false;
		}
	}
	const chosen = input.songId !== null && input.songId !== current.songId;
	db.transaction((tx) => {
		tx.update(exercises)
			.set({
				practiceMode: input.mode,
				songId: input.songId,
				countBpm: input.countBpm,
				practiceJson: JSON.stringify(input.config)
			})
			.where(eq(exercises.id, id))
			.run();
		if (chosen) tx.delete(songDrops).where(eq(songDrops.exerciseId, id)).run();
	});
	return true;
}

/**
 * Archive a custom exercise. Figure exercises are archived through their
 * variation (`archiveVariation`), which keeps the pair in step; refusing here is
 * what stops a live figure from losing its exercise. An entry (`'added'`) is
 * refused too: it leaves with Remove from my lessons, not here.
 *
 * A group's drill takes every member's entry for it along, with the same
 * `now` (one already archived keeps its own time), and whatever else the
 * group's shrunken reach drops (`reconcileEntries`).
 */
export function archiveExercise(db: Db, id: number, now: number, by?: string): boolean {
	return db.transaction((tx) => {
		const row = tx
			.update(exercises)
			.set({ archivedAt: now })
			.where(and(eq(exercises.id, id), eq(exercises.source, 'custom')))
			.returning()
			.get();
		if (!row) return false;
		if (row.teamId !== null) {
			tx.update(exercises)
				.set({ archivedAt: now })
				.where(and(eq(exercises.drillId, id), isNull(exercises.archivedAt)))
				.run();
			reconcileEntries(tx, row.teamId, now);
			logChange(tx, actingIn(row, by), { ...ofDrill(id), verb: 'archive', subject: 'drill' }, now);
		}
		return true;
	});
}

/**
 * Bring an archived drill back (Recently deleted), with exactly the entries
 * its archive took: those archived at its own `archived_at` (risk 6).
 */
export function restoreDrill(db: Db, space: Space, id: number, now: number): ArchiveRestore {
	return db.transaction((tx) => {
		const drill = tx.select().from(exercises).where(eq(exercises.id, id)).get();
		if (
			!drill ||
			drill.source !== 'custom' ||
			drill.archivedAt === null ||
			!inSpace(drill, space)
		) {
			return { ok: false, reason: 'gone' } as const;
		}
		const at = drill.archivedAt;
		tx.update(exercises).set({ archivedAt: null }).where(eq(exercises.id, id)).run();
		if (drill.teamId !== null) {
			tx.update(exercises)
				.set({ archivedAt: null })
				.where(and(eq(exercises.drillId, id), eq(exercises.archivedAt, at)))
				.run();
			reviveEntries(tx, drill.teamId, at);
		}
		logChange(
			tx,
			space,
			{ ...ofDrill(id), verb: 'restore', subject: 'drill', after: { name: drill.name } },
			now
		);
		return { ok: true } as const;
	});
}

export interface SetInput {
	exerciseId: number;
	doneAt: number;
	durationS: number | null;
	reps: number | null;
	rating: number | null;
	note: string | null;
	playerJson: string | null;
}

export function logSet(db: Db, input: SetInput) {
	return db.insert(sets).values(input).returning().get();
}

const DAY_MS = 24 * 3600_000;

/** An exercise's rows on one local day, oldest first. The window is widened and filtered with `localDay`, the rule `listSetsBetween`'s callers follow. */
function dayRows(db: Db, exerciseId: number, day: string, tz: string) {
	const noon = noonOf(day, tz);
	return db
		.select()
		.from(sets)
		.where(
			and(
				eq(sets.exerciseId, exerciseId),
				gte(sets.doneAt, noon - DAY_MS),
				lt(sets.doneAt, noon + DAY_MS)
			)
		)
		.orderBy(asc(sets.doneAt), asc(sets.id))
		.all()
		.filter((r) => localDay(r.doneAt, tz) === day);
}

const snapshotOf = (r: typeof sets.$inferSelect): SetSnapshot => ({
	exerciseId: r.exerciseId,
	doneAt: r.doneAt,
	durationS: r.durationS,
	reps: r.reps,
	rating: r.rating,
	note: r.note,
	playerJson: r.playerJson
});

/** The day's row for input.exerciseId on localDay(input.doneAt, tz): inserted, or the latest one updated. */
export function saveDay(
	db: Db,
	input: SetInput,
	tz: string
): { set: typeof sets.$inferSelect; before: SetSnapshot | null } {
	return db.transaction((tx) => {
		const rows = dayRows(tx, input.exerciseId, localDay(input.doneAt, tz), tz);
		const old = rows[rows.length - 1];
		if (!old) return { set: tx.insert(sets).values(input).returning().get(), before: null };
		const durationS =
			old.durationS === null && input.durationS === null
				? null
				: (old.durationS ?? 0) + (input.durationS ?? 0);
		const set = tx
			.update(sets)
			.set({
				durationS,
				rating: input.rating,
				note: input.note === '' ? null : input.note,
				playerJson: input.playerJson ?? old.playerJson
			})
			.where(eq(sets.id, old.id))
			.returning()
			.get();
		return { set, before: snapshotOf(old) };
	});
}

/** Undo of saveDay: before null → the row is deleted; else the row takes before's fields back. False when the row is gone or before.exerciseId differs. */
export function undoSave(db: Db, setId: number, before: SetSnapshot | null): boolean {
	return db.transaction((tx) => {
		const row = tx.select().from(sets).where(eq(sets.id, setId)).get();
		if (!row || (before !== null && before.exerciseId !== row.exerciseId)) return false;
		if (before === null) return tx.delete(sets).where(eq(sets.id, setId)).run().changes > 0;
		tx.update(sets).set(before).where(eq(sets.id, setId)).run();
		return true;
	});
}

/** Every row of that exercise on that local day, deleted; their snapshots, oldest first. */
export function deleteDay(db: Db, exerciseId: number, day: string, tz: string): SetSnapshot[] {
	return db.transaction((tx) => {
		const rows = dayRows(tx, exerciseId, day, tz);
		if (rows.length > 0) {
			tx.delete(sets)
				.where(
					inArray(
						sets.id,
						rows.map((r) => r.id)
					)
				)
				.run();
		}
		return rows.map(snapshotOf);
	});
}

/** Re-inserts snapshots in one transaction (Undo of deleteDay). */
export function restoreSets(db: Db, snaps: SetSnapshot[]): void {
	db.transaction((tx) => {
		for (const snap of snaps) tx.insert(sets).values(snap).run();
	});
}

/**
 * One set by id. A set carries no dance of its own — it belongs to the dance of
 * its exercise — so this is how a route resolves the one from the other before
 * touching it (see `src/lib/server/scope.ts`).
 */
export function getSet(db: Db, id: number) {
	return db.select().from(sets).where(eq(sets.id, id)).get() ?? null;
}

export function deleteSet(db: Db, id: number): boolean {
	return db.delete(sets).where(eq(sets.id, id)).run().changes > 0;
}

/**
 * Sets whose instant falls in `[from, to)`, newest first. The caller widens the
 * window around a calendar day and filters with `localDay`, so which day a set
 * belongs to is decided in one place, in the user's zone. An entry whose
 * group was purged is named for it (`deletedGroupName`): what it practised is
 * archived and unreachable, and only the name says where it came from.
 */
export function listSetsBetween(db: Db, from: number, to: number, wall: Wall): DaySet[] {
	return db
		.select({
			id: sets.id,
			exerciseId: sets.exerciseId,
			name: exercises.name,
			// An entry whose group is purged: the group's name, found through what it practised.
			purgedTeam: sql<string | null>`(select t.name from teams t where t.purged_at is not null
				and t.id = coalesce(
					(select l.team_id from lessons l where l.id = ${exercises.lessonId}),
					(select r.team_id from routines r where r.id = ${exercises.routineId}),
					(select f.team_id from figures f where f.id = ${exercises.figureId}),
					(select d.team_id from exercises d where d.id = ${exercises.drillId})))`,
			lessonTitle: sql<
				string | null
			>`(select l.title from lessons l where l.id = ${exercises.lessonId})`,
			doneAt: sets.doneAt,
			durationS: sets.durationS,
			reps: sets.reps,
			rating: sets.rating,
			note: sets.note
		})
		.from(sets)
		.innerJoin(exercises, eq(exercises.id, sets.exerciseId))
		.where(
			and(
				gte(sets.doneAt, from),
				lt(sets.doneAt, to),
				eq(exercises.dance, wall.dance),
				eq(exercises.userId, wall.userId)
			)
		)
		.orderBy(desc(sets.doneAt))
		.all()
		.map(({ name, purgedTeam, lessonTitle, ...set }) => ({
			...set,
			exerciseName: purgedTeam === null ? name : deletedGroupName(lessonTitle ?? name, purgedTeam)
		}));
}

const historyRow = {
	id: sets.id,
	doneAt: sets.doneAt,
	durationS: sets.durationS,
	reps: sets.reps,
	rating: sets.rating,
	note: sets.note
};

/** An exercise's sets, newest first. The page shows the latest `limit`; the summary counts all. */
export function exerciseHistory(db: Db, id: number, limit = 200): HistorySet[] {
	return db
		.select(historyRow)
		.from(sets)
		.where(eq(sets.exerciseId, id))
		.orderBy(desc(sets.doneAt), desc(sets.id))
		.limit(limit)
		.all();
}

/** How many days an exercise was practised (a day with several rows counts once) and the time in all. */
export function exerciseSummary(db: Db, id: number, tz: string): ExerciseSummary {
	const rows = db
		.select({ doneAt: sets.doneAt, durationS: sets.durationS })
		.from(sets)
		.where(eq(sets.exerciseId, id))
		.all();
	const days = new Set(rows.map((r) => localDay(r.doneAt, tz)));
	return { times: days.size, totalS: rows.reduce((a, r) => a + (r.durationS ?? 0), 0) };
}

export function lastSet(db: Db, exerciseId: number): HistorySet | null {
	return exerciseHistory(db, exerciseId, 1)[0] ?? null;
}
