/**
 * The rescue: when a group change takes one of its rows out of someone's
 * reach (an editor archives or unlinks it, a slot option or a section link
 * goes, a person is made a member), every person whose OWN rows use that row
 * (their routines' slot options and embeds, the section links on their own
 * videos, their lessons' hand links, archived routines and lessons too) gets
 * their own copy of it, and those rows, with their practice, move onto it.
 * The spec's "an editor unpublishes or deletes something your own rows use:
 * just that thing is cloned into your app". Things a person only reads, and
 * no row of theirs uses, simply leave their view.
 *
 * It runs inside the editor's transaction (`reconcileEntries` calls it
 * first), so it is synchronous and touches no files: the copy has no
 * recordings (ruling 5); the group's stay in the group's tab.
 *
 * Restoring the group's row afterwards does not undo a copy: it is the
 * person's own from then on, a member of the same family ("From …").
 */
import { and, eq, gt, inArray, ne, sql } from 'drizzle-orm';
import type { DanceSlug } from '$lib/dances/dances';
import type { Db } from '../db';
import { exercises, routines, routineSteps } from '../db/schema';
import { restoreVariation } from '../figures';
import { restoreRoutine } from '../routines';
import { teamReaders } from '../access';
import { ownedBy, type Wall } from '../scope';
import { cloneTx } from './clone';
import { geneOf, memberIn } from './genes';
import { repoint } from './repoint';

type Kind = 'figure' | 'routine' | 'drill';

/** A person's own row pointing at one of the group's rows (the person and the target). */
type Used = { userId: string; dance: DanceSlug; kind: Kind; id: number };

/** One of the person's rows that uses a group row: a routine, a lesson, or a figure (a section on its recording). */
export type Use = Used & { by: 'routine' | 'lesson' | 'figure'; byId: number; byName: string };

/**
 * Every use of a group row of `teamId` by a person's own rows, in one query:
 * the slot options and embeds of their routines, the section links on their
 * own videos (a recording of their figure, a video of their lesson) and their
 * lessons' hand links, archived owners included (`crossRefs` checks those
 * too). One row per person, target and using row, sorted by person, then
 * routines first, then kind, target and the using row's name.
 */
export function usesOf(tx: Db, teamId: number, userId?: string): Use[] {
	const who = (col: string) =>
		userId === undefined ? sql`` : sql` and ${sql.raw(col)} = ${userId}`;
	const rows = tx.all<Use>(sql`
		select r.user_id as userId, t.dance as dance, 'figure' as kind, t.id as id,
		       'routine' as "by", r.id as byId, r.name as byName
		  from routine_step_options x
		  join routine_steps s on s.id = x.step_id
		  join routines r on r.id = s.routine_id
		  join figures t on t.id = x.figure_id
		 where r.team_id is null and r.user_id is not null and t.team_id = ${teamId}${who('r.user_id')}
		union
		select r.user_id, t.dance, 'routine', t.id, 'routine', r.id, r.name
		  from routine_steps x
		  join routines r on r.id = x.routine_id
		  join routines t on t.id = x.child_routine_id
		 where r.team_id is null and r.user_id is not null and t.team_id = ${teamId}${who('r.user_id')}
		union
		select coalesce(rf.user_id, vl.user_id), coalesce(tf.dance, te.dance),
		       case when x.figure_id is not null then 'figure' else 'drill' end,
		       coalesce(tf.id, te.id),
		       case when rf.id is not null then 'figure' else 'lesson' end,
		       coalesce(rf.id, vl.id),
		       coalesce(fg.name || ' · ' || rf.name, rf.name, vl.title)
		  from spot_links x
		  join video_spots v on v.id = x.spot_id
		  left join recordings rec on rec.id = v.recording_id
		  left join figures rf on rf.id = rec.figure_id
		  left join figure_groups fg on fg.id = rf.group_id
		  left join lesson_videos lv on lv.id = v.lesson_video_id
		  left join lessons vl on vl.id = lv.lesson_id
		  left join figures tf on tf.id = x.figure_id
		  left join exercises te on te.id = x.exercise_id
		 where coalesce(rf.team_id, vl.team_id) is null
		   and coalesce(rf.user_id, vl.user_id) is not null
		   and coalesce(tf.team_id, te.team_id) = ${teamId}${who('coalesce(rf.user_id, vl.user_id)')}
		union
		select l.user_id, t.dance, 'figure', t.id, 'lesson', l.id, l.title
		  from lesson_figures x
		  join lessons l on l.id = x.lesson_id
		  join figures t on t.id = x.figure_id
		 where l.team_id is null and l.user_id is not null and t.team_id = ${teamId}${who('l.user_id')}
		union
		select l.user_id, t.dance, 'routine', t.id, 'lesson', l.id, l.title
		  from lesson_routines x
		  join lessons l on l.id = x.lesson_id
		  join routines t on t.id = x.routine_id
		 where l.team_id is null and l.user_id is not null and t.team_id = ${teamId}${who('l.user_id')}
		union
		select l.user_id, t.dance, 'drill', t.id, 'lesson', l.id, l.title
		  from lesson_exercises x
		  join lessons l on l.id = x.lesson_id
		  join exercises t on t.id = x.exercise_id
		 where l.team_id is null and l.user_id is not null and t.team_id = ${teamId}${who('l.user_id')}
	`);
	const rank = (k: Kind | Use['by']) => (k === 'routine' ? 0 : 1);
	return rows.sort(
		(a, b) =>
			a.userId.localeCompare(b.userId) ||
			rank(a.kind) - rank(b.kind) ||
			a.kind.localeCompare(b.kind) ||
			a.id - b.id ||
			rank(a.by) - rank(b.by) ||
			a.byName.localeCompare(b.byName) ||
			a.byId - b.byId
	);
}

/**
 * Every group row of `teamId` a person's own rows point at, one row per
 * person and target (`usesOf`, whoever uses it). Routines first, so a
 * routine's copy brings the figures it holds and a later figure reuses them.
 */
function usedOf(tx: Db, teamId: number, userId?: string): Used[] {
	const seen = new Set<string>();
	const out: Used[] = [];
	for (const { userId: u, dance, kind, id } of usesOf(tx, teamId, userId)) {
		const key = `${u}\t${kind}\t${id}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ userId: u, dance, kind, id });
	}
	return out;
}

const ENTRY = {
	figure: exercises.figureId,
	routine: exercises.routineId,
	drill: exercises.drillId
};

/** The newest exercise's id (0 for none): what a clone adds is above it. */
const lastExercise = (tx: Db) =>
	tx
		.select({ id: sql<number>`coalesce(max(${exercises.id}), 0)` })
		.from(exercises)
		.get()!.id;

/**
 * Rescue what `teamId`'s change took from the people whose own rows use it
 * (of `userId` only, when given): for each person and group row they no
 * longer read (`teamReader`'s answer, the one `crossRefs` checks), their
 * family's member in their own app when they have one (archived or not), else
 * a clone made now (`trusted`: an archived source is fine; no files), and
 * `repoint` moves their rows onto it with their practice (ruling 6). A row
 * they still read is left alone. Returns how many roots it cloned (a
 * routine's copy counts once, with the figures it brings).
 *
 * Practice continues: the person's entry on the target that this very change
 * archived (its `archived_at` is `now`: a transaction writes one `now`) is
 * live again on the copy. What a copy brings to practise (a drill is itself
 * one; a personal routine has its own exercise) starts paused, off Today,
 * unless their live entry carries its schedule onto it. A clone
 * the engine refuses (no free name) is skipped: the editor's change goes on.
 */
export function rescueUsed(tx: Db, teamId: number, now: number, userId?: string): number {
	const used = usedOf(tx, teamId, userId);
	if (used.length === 0) return 0;
	const readerOf = teamReaders(tx, teamId);
	let cloned = 0;
	for (const u of used) {
		if (readerOf(u.userId)(u.kind, u.id)) continue;
		const wall: Wall = { userId: u.userId, dance: u.dance };

		tx.update(exercises)
			.set({ archivedAt: null })
			.where(and(ownedBy(exercises, wall), eq(ENTRY[u.kind], u.id), eq(exercises.archivedAt, now)))
			.run();

		const gene = geneOf(tx, u.kind, u.id);
		const member = gene === null ? null : memberIn(tx, u.kind, gene, wall);
		let toId: number;
		let practice = true;
		if (member) {
			toId = member.id;
			// An archived member of theirs holds the rows again: it comes back,
			// with what it brings to practise paused, so a moved entry sits on a
			// live root (a live entry wakes it: `repoint`'s carry). `repoint`
			// never moves practice onto an archived drill. A figure or routine
			// that cannot come back (its name taken since) takes the rows but no
			// practice: the entry stays on the group's row and goes off Today.
			if (member.archived) practice = revive(tx, wall, u.kind, toId, now);
		} else {
			const before = lastExercise(tx);
			const made = cloneTx(
				tx,
				{ kind: u.kind, id: u.id, into: wall, recordings: false },
				new Map(),
				now,
				{ trusted: true }
			);
			if (!made.ok) continue;
			toId = made.id;
			if (made.made) {
				cloned++;
				// What the copy brought to practise (a drill, a routine's own
				// exercise, nested ones too) waits off Today: the person asked for
				// none of it. A live entry carries its schedule on (`repoint`).
				tx.update(exercises)
					.set({ active: false })
					.where(and(gt(exercises.id, before), ownedBy(exercises, wall)))
					.run();
			}
		}
		repoint(tx, u.userId, u.dance, u.kind, u.id, toId, { entries: practice }, now);
		// Every entry of theirs on the group's row archived at `now` was revived
		// above, so one archived at `now` again was merged into the copy's. A
		// restore of the group's row revives exactly its own `archived_at`: one
		// instant earlier keeps it from bringing back a second practice.
		tx.update(exercises)
			.set({ archivedAt: now - 1 })
			.where(and(ownedBy(exercises, wall), eq(ENTRY[u.kind], u.id), eq(exercises.archivedAt, now)))
			.run();
		if (u.kind === 'routine') keepNestedEmbeds(tx, wall, u.id, toId);
	}
	return cloned;
}

/**
 * Bring the person's archived member back to hold their rows: a drill
 * unarchived as it is; a figure or a routine through its own restore (which
 * brings back its move, or refuses a name taken since). What it brings to
 * practise (the drill, a routine's or variation's own exercise) is paused.
 * Whether it came back, so practice may move onto it.
 */
export function revive(tx: Db, wall: Wall, kind: Kind, id: number, now: number): boolean {
	if (kind === 'drill') {
		tx.update(exercises).set({ archivedAt: null, active: false }).where(eq(exercises.id, id)).run();
		return true;
	}
	const restored =
		kind === 'figure' ? restoreVariation(tx, wall, id, now) : restoreRoutine(tx, wall, id, now);
	if (!restored.ok) return false;
	tx.update(exercises)
		.set({ active: false })
		.where(and(ownedBy(exercises, wall), eq(ENTRY[kind], id)))
		.run();
	return true;
}

/**
 * The embeds `repoint` leaves behind because the copy nests a routine
 * itself (one level of embedding): the group nested into its routine after
 * the person embedded it, which the person's routine already plays
 * flattened (ruling of Task 13). The copy has the same shape, so the slot
 * follows it rather than keep pointing at a row the person no longer reads.
 */
export function keepNestedEmbeds(tx: Db, wall: Wall, fromId: number, toId: number): void {
	const left = tx
		.select({ id: routineSteps.id })
		.from(routineSteps)
		.innerJoin(routines, eq(routines.id, routineSteps.routineId))
		.where(
			and(
				eq(routineSteps.childRoutineId, fromId),
				// Never a routine embedding itself: such a slot stays as it is.
				ne(routineSteps.routineId, toId),
				ownedBy(routines, wall)
			)
		)
		.all()
		.map((r) => r.id);
	if (left.length === 0) return;
	tx.update(routineSteps).set({ childRoutineId: toId }).where(inArray(routineSteps.id, left)).run();
}
