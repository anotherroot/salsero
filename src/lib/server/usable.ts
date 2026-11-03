/**
 * What of the groups a person may USE from their own rows: put in their
 * routines' slots, embed, link from their lessons and sections.
 *
 * Only groups the person still holds a place in (a `team_members` row, ruling
 * 4), and only rows they read (`teamReader`, once per group). Two sources:
 * - what the lessons they added reach (what Moves shows them), per group of
 *   the dance: `addedReach`;
 * - what their own rows already point at (slot options, embeds, section
 *   links, their lessons' hand links — archived routines and lessons too)
 *   that they still read. Removing the lesson that brought a figure must not
 *   make a routine that already uses it unplayable while the person still
 *   reads it. A pointed-at routine brings what they read of its slots and
 *   its embedded routine's slots, so it plays whole.
 *
 * The person's own rows are not in it: they are the wall's own. Derived per
 * call, never stored.
 */
import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Db } from './db';
import { teamMembers } from './db/schema';
import { addedReach, addedTeams, teamReader, type ReadKind } from './access';
import { ownedBy, type Space, type Wall } from './scope';

export type Usable = { figures: Set<number>; routines: Set<number>; drills: Set<number> };

type Pointer = { kind: 'figure' | 'routine' | 'drill'; id: number; teamId: number };

/**
 * The group rows of this dance the person's own rows point at, archived
 * owners included. Raw SQL for the section links' two-way owner (a
 * recording's variation or a lesson), as `crossRefs` reads them.
 */
function pointers(db: Db, wall: Wall): Pointer[] {
	const { userId, dance } = wall;
	const rows = db.all<Pointer>(sql`
		select 'figure' as kind, t.id as id, t.team_id as teamId
		  from routine_step_options x
		  join routine_steps s on s.id = x.step_id
		  join routines r on r.id = s.routine_id
		  join figures t on t.id = x.figure_id
		 where r.user_id = ${userId} and r.team_id is null and r.dance = ${dance}
		   and t.team_id is not null and t.dance = ${dance}
		union
		select 'routine', t.id, t.team_id
		  from routine_steps x
		  join routines r on r.id = x.routine_id
		  join routines t on t.id = x.child_routine_id
		 where r.user_id = ${userId} and r.team_id is null and r.dance = ${dance}
		   and t.team_id is not null and t.dance = ${dance}
		union
		select case when x.figure_id is not null then 'figure' else 'drill' end,
		       coalesce(tf.id, te.id), coalesce(tf.team_id, te.team_id)
		  from spot_links x
		  join video_spots v on v.id = x.spot_id
		  left join recordings rec on rec.id = v.recording_id
		  left join figures rf on rf.id = rec.figure_id
		  left join lesson_videos lv on lv.id = v.lesson_video_id
		  left join lessons vl on vl.id = lv.lesson_id
		  left join figures tf on tf.id = x.figure_id
		  left join exercises te on te.id = x.exercise_id
		 where coalesce(rf.user_id, vl.user_id) = ${userId}
		   and coalesce(rf.team_id, vl.team_id) is null
		   and coalesce(rf.dance, vl.dance) = ${dance}
		   and coalesce(tf.team_id, te.team_id) is not null
		   and coalesce(tf.dance, te.dance) = ${dance}
		union
		select 'figure', t.id, t.team_id
		  from lesson_figures x
		  join lessons l on l.id = x.lesson_id
		  join figures t on t.id = x.figure_id
		 where l.user_id = ${userId} and l.team_id is null and l.dance = ${dance}
		   and t.team_id is not null and t.dance = ${dance}
		union
		select 'routine', t.id, t.team_id
		  from lesson_routines x
		  join lessons l on l.id = x.lesson_id
		  join routines t on t.id = x.routine_id
		 where l.user_id = ${userId} and l.team_id is null and l.dance = ${dance}
		   and t.team_id is not null and t.dance = ${dance}
		union
		select 'drill', t.id, t.team_id
		  from lesson_exercises x
		  join lessons l on l.id = x.lesson_id
		  join exercises t on t.id = x.exercise_id
		 where l.user_id = ${userId} and l.team_id is null and l.dance = ${dance}
		   and t.team_id is not null and t.dance = ${dance}
	`);
	return rows;
}

/** The group's routines these embed, and the figures in all their slots: what playing them calls. */
function inside(
	db: Db,
	teamId: number,
	routineIds: number[]
): { routines: number[]; figures: number[] } {
	if (routineIds.length === 0) return { routines: [], figures: [] };
	const ids = sql.join(
		routineIds.map((id) => sql`${id}`),
		sql`, `
	);
	const children = db
		.all<{ id: number }>(
			sql`select distinct x.child_routine_id as id
			      from routine_steps x join routines t on t.id = x.child_routine_id
			     where x.routine_id in (${ids}) and t.team_id = ${teamId}`
		)
		.map((r) => r.id);
	const all = sql.join(
		[...routineIds, ...children].map((id) => sql`${id}`),
		sql`, `
	);
	const figures = db
		.all<{ id: number }>(
			sql`select distinct x.figure_id as id
			      from routine_step_options x
			      join routine_steps s on s.id = x.step_id
			      join figures t on t.id = x.figure_id
			     where s.routine_id in (${all}) and t.team_id = ${teamId}`
		)
		.map((r) => r.id);
	return { routines: children, figures };
}

/**
 * Whether the person still holds a place in the group: a `team_members` row,
 * whatever the group's state. Someone who left or was removed uses nothing of
 * it from their own rows (ruling 4): what they kept is a copy (Task 19).
 */
function inTeam(db: Db, userId: string, teamId: number): boolean {
	return (
		db
			.select({ teamId: teamMembers.teamId })
			.from(teamMembers)
			.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
			.get() !== undefined
	);
}

/** What the person may use of the groups of this dance. See the module comment. */
export function usableOf(db: Db, wall: Wall): Usable {
	const out: Usable = { figures: new Set(), routines: new Set(), drills: new Set() };
	const sets: Record<Pointer['kind'], Set<number>> = {
		figure: out.figures,
		routine: out.routines,
		drill: out.drills
	};
	// One reader per group: everything below is kept only if the person reads it.
	const readers = new Map<number, ((kind: ReadKind, id: number) => boolean) | null>();
	const readerOf = (teamId: number) => {
		if (!readers.has(teamId)) {
			readers.set(
				teamId,
				inTeam(db, wall.userId, teamId) ? teamReader(db, wall.userId, teamId) : null
			);
		}
		return readers.get(teamId)!;
	};
	const take = (teamId: number, kind: Pointer['kind'], id: number) => {
		if (readerOf(teamId)?.(kind, id)) sets[kind].add(id);
	};

	for (const team of addedTeams(db, wall)) {
		if (!readerOf(team.id)) continue;
		const r = addedReach(db, wall.userId, team.id);
		for (const id of r.variations) take(team.id, 'figure', id);
		for (const id of r.routines) take(team.id, 'routine', id);
		for (const id of r.drills) take(team.id, 'drill', id);
	}

	const byTeam = new Map<number, Pointer[]>();
	for (const p of pointers(db, wall)) {
		const list = byTeam.get(p.teamId);
		if (list) list.push(p);
		else byTeam.set(p.teamId, [p]);
	}
	for (const [teamId, list] of byTeam) {
		const reads = readerOf(teamId);
		if (!reads) continue;
		for (const p of list) take(teamId, p.kind, p.id);
		const routines = list.filter((p) => p.kind === 'routine' && reads('routine', p.id));
		const held = inside(
			db,
			teamId,
			routines.map((p) => p.id)
		);
		for (const id of held.routines) take(teamId, 'routine', id);
		for (const id of held.figures) take(teamId, 'figure', id);
	}
	return out;
}

/**
 * A content query's owner filter for a space and what it may use: the
 * space's own rows (`ownedBy`), or one of `ids` of the same dance (a person's
 * usable group rows, `usableOf`). With no ids, `ownedBy` alone.
 */
export function ownedOrUsable(
	cols: { id: SQLiteColumn; userId: SQLiteColumn; teamId: SQLiteColumn; dance: SQLiteColumn },
	space: Space,
	ids?: Iterable<number>
): SQL {
	const own = ownedBy(cols, space);
	const list = ids ? [...ids] : [];
	if (list.length === 0) return own;
	return or(own, and(inArray(cols.id, list), eq(cols.dance, space.dance)))!;
}
