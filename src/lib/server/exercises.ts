import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	lt,
	sql,
	sum
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	lessons,
	routines,
	sets,
	songs,
	teams
} from './db/schema';
import { inSpace, ownerValues, type Space, type Wall } from './scope';
import { reconcileEntries, reviveEntries } from './entries';
import type { ArchiveRestore } from './trash';
import { actingIn, fieldChange, logChange } from './changes';
import type { PracticeInput } from '$lib/exercises/practice';
import { deletedGroupName } from '$lib/exercises/today';
import type { DaySet, ExerciseItem, ExerciseSummary, HistorySet, PickExercise } from '$lib/types';

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
	return rows.map(({ teamId, ...r }) => ({
		...r,
		archived: false,
		team: teamId === null ? null : { id: teamId, name: names.get(teamId) ?? '' }
	}));
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
 * The (exercise, time) pairs urgency is computed from, for ONE dance. The join
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
	everyDays: number;
	active: boolean;
	notes: string | null;
}

/**
 * A drill in a person's or a group's space. It starts with no song, and a
 * group's never gets one: songs are personal, and a group drill holding its
 * editor's song would play it to everyone (see `setPracticeSettings`).
 */
export function createCustomExercise(db: Db, space: Space, input: Omit<SettingsInput, 'active'>) {
	return db.transaction((tx) => {
		const drill = tx
			.insert(exercises)
			.values({ ...input, source: 'custom', ...ownerValues(space), songId: null })
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
 * group drill's frequency and Active are no one's, so only name and notes count.
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
		const row = tx
			.update(exercises)
			.set({ ...input, name })
			.where(eq(exercises.id, id))
			.returning()
			.get();
		if (current.source === 'custom') {
			tx.update(exercises).set({ name }).where(eq(exercises.drillId, id)).run();
		}
		if (current.teamId !== null && row) {
			const fields = (e: { name: string; notes: string | null }) => ({
				name: e.name,
				notes: e.notes
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
 * A group's exercise never holds a song: songs are personal (see
 * `createCustomExercise`).
 */
export function setPracticeSettings(db: Db, id: number, input: PracticeInput): boolean {
	const current = db.select().from(exercises).where(eq(exercises.id, id)).get();
	if (!current) return false;
	if (input.mode === 'song') {
		if (current.teamId !== null) return false;
		const song =
			input.songId === null
				? null
				: db.select().from(songs).where(eq(songs.id, input.songId)).get();
		if (
			!song ||
			song.dance !== current.dance ||
			song.userId !== current.userId ||
			song.status !== 'ready' ||
			song.archivedAt !== null
		) {
			return false;
		}
	}
	db.update(exercises)
		.set({
			practiceMode: input.mode,
			songId: input.songId,
			countBpm: input.countBpm,
			practiceJson: JSON.stringify(input.config)
		})
		.where(eq(exercises.id, id))
		.run();
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

/** How many ratings "recent" means on the summary line. */
const RECENT_RATED = 5;

export function exerciseSummary(db: Db, id: number): ExerciseSummary {
	const totals = db
		.select({ sets: count(), totalS: sum(sets.durationS) })
		.from(sets)
		.where(eq(sets.exerciseId, id))
		.get();
	const rated = db
		.select({ rating: sets.rating })
		.from(sets)
		.where(and(eq(sets.exerciseId, id), isNotNull(sets.rating)))
		.orderBy(desc(sets.doneAt))
		.limit(RECENT_RATED)
		.all();
	const mean =
		rated.length === 0 ? null : rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length;
	return {
		sets: totals?.sets ?? 0,
		totalS: Number(totals?.totalS ?? 0),
		recentRating: mean === null ? null : Math.round(mean * 10) / 10
	};
}

/**
 * The latest set of every exercise in one dance — for the rating dots on
 * Today's rows. One grouped query rather than one per row.
 *
 * Relies on SQLite's documented bare-column rule: in a query with exactly one
 * `max()` aggregate, the other selected columns come from the row holding that
 * maximum. Two sets at the same millisecond pick either, which is fine.
 */
export function lastSets(db: Db, wall: Wall): Map<number, HistorySet> {
	const rows = db.all<HistorySet & { exerciseId: number }>(sql`
		select s.exercise_id as exerciseId, s.id as id, max(s.done_at) as doneAt,
		       s.duration_s as durationS, s.reps as reps, s.rating as rating, s.note as note
		from sets s join exercises e on e.id = s.exercise_id
		where e.dance = ${wall.dance} and e.user_id = ${wall.userId}
		group by s.exercise_id`);
	return new Map(rows.map(({ exerciseId, ...set }) => [exerciseId, set]));
}

export function lastSet(db: Db, exerciseId: number): HistorySet | null {
	return exerciseHistory(db, exerciseId, 1)[0] ?? null;
}
