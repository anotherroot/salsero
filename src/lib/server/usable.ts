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
 * Positions (ruling 12) come the same two ways — their figures' tags, their
 * lessons' and sections' position links — plus what every usable figure is
 * tagged with, so a routine holding it walks the graph it was built on.
 *
 * The person's own rows are not in it: they are the wall's own. Derived per
 * call, never stored.
 */
import { and, asc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Db } from './db';
import {
	exercises,
	figureEndPositions,
	figureGroups,
	figures,
	figureStartPositions,
	positions,
	teamMembers,
	type PositionRow
} from './db/schema';
import { addedReach, addedTeams, teamReader, type ReadKind } from './access';
import { isTeam, ownedBy, type Space, type Wall } from './scope';
import { getTeam } from './teams';
import { withoutShadowed } from './clones/shadow';
import { sortPositions } from './positions';
import type { FigureVersion, TeamRef } from '$lib/types';

export type Usable = {
	figures: Set<number>;
	routines: Set<number>;
	drills: Set<number>;
	/**
	 * Group positions (ruling 12): what the added lessons reach, what the
	 * person's own figures, lessons and spots already point at, and what the
	 * usable figures are tagged with, so the routines using those play whole.
	 */
	positions: Set<number>;
};

type Pointer = { kind: 'figure' | 'routine' | 'drill' | 'position'; id: number; teamId: number };

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
		union
		select 'position', t.id, t.team_id
		  from figure_start_positions x
		  join figures f on f.id = x.figure_id
		  join positions t on t.id = x.position_id
		 where f.user_id = ${userId} and f.team_id is null and f.dance = ${dance}
		   and t.team_id is not null and t.dance = ${dance}
		union
		select 'position', t.id, t.team_id
		  from figure_end_positions x
		  join figures f on f.id = x.figure_id
		  join positions t on t.id = x.position_id
		 where f.user_id = ${userId} and f.team_id is null and f.dance = ${dance}
		   and t.team_id is not null and t.dance = ${dance}
		union
		select 'position', t.id, t.team_id
		  from lesson_positions x
		  join lessons l on l.id = x.lesson_id
		  join positions t on t.id = x.position_id
		 where l.user_id = ${userId} and l.team_id is null and l.dance = ${dance}
		   and t.team_id is not null and t.dance = ${dance}
		union
		select 'position', t.id, t.team_id
		  from spot_position_links x
		  join video_spots v on v.id = x.spot_id
		  left join recordings rec on rec.id = v.recording_id
		  left join figures rf on rf.id = rec.figure_id
		  left join lesson_videos lv on lv.id = v.lesson_video_id
		  left join lessons vl on vl.id = lv.lesson_id
		  join positions t on t.id = x.position_id
		 where coalesce(rf.user_id, vl.user_id) = ${userId}
		   and coalesce(rf.team_id, vl.team_id) is null
		   and coalesce(rf.dance, vl.dance) = ${dance}
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
	const out: Usable = {
		figures: new Set(),
		routines: new Set(),
		drills: new Set(),
		positions: new Set()
	};
	const sets: Record<Pointer['kind'], Set<number>> = {
		figure: out.figures,
		routine: out.routines,
		drill: out.drills,
		position: out.positions
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
		for (const id of r.positions) take(team.id, 'position', id);
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
	// What the usable figures are tagged with: a group's figure only ever with
	// its group's positions (ruling 15), and what a reader reads of them.
	for (const tag of groupTags(db, out.figures)) take(tag.teamId, 'position', tag.id);
	return out;
}

/** The group positions these figures are tagged with (start or end), each in its figure's group. */
function groupTags(db: Db, figureIds: Set<number>): { id: number; teamId: number }[] {
	if (figureIds.size === 0) return [];
	const ids = [...figureIds];
	const out: { id: number; teamId: number }[] = [];
	for (const table of [figureStartPositions, figureEndPositions]) {
		out.push(
			...db
				.select({ id: positions.id, teamId: figures.teamId })
				.from(table)
				.innerJoin(figures, eq(figures.id, table.figureId))
				.innerJoin(positions, eq(positions.id, table.positionId))
				.where(and(inArray(table.figureId, ids), eq(positions.teamId, figures.teamId)))
				.all()
				.map((r) => ({ id: r.id, teamId: r.teamId! }))
		);
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

/**
 * Whether `space` may point at `row`, a row of another owner, from its own
 * rows (a slot, a section link, a lesson link, a figure's position tag): a group's row of the dance
 * the person may use (`usableOf`). Never for a group's space, which points at
 * its own rows only. The space's own rows are the caller's check (`inSpace`).
 * Pass `usable` when the caller has it already.
 */
export function usableBy(
	db: Db,
	space: Space,
	kind: keyof Usable,
	row: { id: number; dance: string; userId: string | null; teamId: number | null },
	usable?: Usable
): boolean {
	if (isTeam(space) || row.dance !== space.dance || row.teamId === null || row.userId !== null) {
		return false;
	}
	return (usable ?? usableOf(db, space))[kind].has(row.id);
}

/** Each group's name, by id, for tagging the group rows a person's lists offer. */
export function teamRefs(db: Db, teamIds: Iterable<number>): Map<number, TeamRef> {
	const out = new Map<number, TeamRef>();
	for (const id of new Set(teamIds)) {
		const team = getTeam(db, id);
		if (team) out.set(id, { id: team.id, name: team.name });
	}
	return out;
}

/**
 * The group variations a person may use, live and in a live move, as a picker
 * offers them (`listVersions`' shape), each tagged with its group. By move
 * name, then id. A picker hides the ones the person has their own copy of
 * (`shadowed: 'hide'`, the default); `usableOf` itself keeps them, and so does
 * a caller that names existing slots (`'keep'`).
 */
export function usableVersions(
	db: Db,
	wall: Wall,
	usable: Usable = usableOf(db, wall),
	shadowed: 'hide' | 'keep' = 'hide'
): (FigureVersion & { team: TeamRef })[] {
	const ids = [...usable.figures];
	if (ids.length === 0) return [];
	const rows = db
		.select({
			id: figures.id,
			groupId: figureGroups.id,
			figure: figureGroups.name,
			name: figures.name,
			teamId: figures.teamId
		})
		.from(figures)
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(
			and(
				inArray(figures.id, ids),
				eq(figures.dance, wall.dance),
				isNotNull(figures.teamId),
				isNull(figures.archivedAt),
				isNull(figureGroups.archivedAt)
			)
		)
		.orderBy(asc(figureGroups.name), asc(figures.id))
		.all();
	const teams = teamRefs(
		db,
		rows.map((r) => r.teamId!)
	);
	const shown = shadowed === 'hide' ? withoutShadowed(db, wall, 'figure', rows) : rows;
	return shown.flatMap(({ teamId, ...r }) => {
		const team = teams.get(teamId!);
		return team ? [{ ...r, label: `${r.figure} · ${r.name}`, team }] : [];
	});
}

/**
 * The group positions a person may use (`usableOf`), live and of the wall's
 * dance, each tagged with its group, in list order (`sortPositions`). A
 * picker hides the ones the person has their own copy of (`shadowed:
 * 'hide'`, the default, as `usableVersions`); `'keep'` lists them all.
 */
export function usablePositions(
	db: Db,
	wall: Wall,
	usable: Usable = usableOf(db, wall),
	shadowed: 'hide' | 'keep' = 'hide'
): (PositionRow & { team: TeamRef })[] {
	const ids = [...usable.positions];
	if (ids.length === 0) return [];
	const rows = db
		.select()
		.from(positions)
		.where(
			and(
				inArray(positions.id, ids),
				eq(positions.dance, wall.dance),
				isNotNull(positions.teamId),
				isNull(positions.archivedAt)
			)
		)
		.all();
	const teams = teamRefs(
		db,
		rows.map((r) => r.teamId!)
	);
	const shown = shadowed === 'hide' ? withoutShadowed(db, wall, 'position', rows) : rows;
	return sortPositions(shown, wall.dance).flatMap((r) => {
		const team = teams.get(r.teamId!);
		return team ? [{ ...r, team }] : [];
	});
}

/** The group drills a person may use, live, by name, each tagged with its group. */
export function usableDrills(
	db: Db,
	wall: Wall,
	usable: Usable = usableOf(db, wall)
): { id: number; name: string; team: TeamRef }[] {
	const ids = [...usable.drills];
	if (ids.length === 0) return [];
	const rows = db
		.select({
			id: exercises.id,
			name: exercises.name,
			teamId: exercises.teamId
		})
		.from(exercises)
		.where(
			and(
				inArray(exercises.id, ids),
				eq(exercises.dance, wall.dance),
				eq(exercises.source, 'custom'),
				isNotNull(exercises.teamId),
				isNull(exercises.archivedAt)
			)
		)
		.orderBy(asc(exercises.name), asc(exercises.id))
		.all();
	const teams = teamRefs(
		db,
		rows.map((r) => r.teamId!)
	);
	return withoutShadowed(db, wall, 'drill', rows).flatMap(({ teamId, ...r }) => {
		const team = teams.get(teamId!);
		return team ? [{ ...r, team }] : [];
	});
}
