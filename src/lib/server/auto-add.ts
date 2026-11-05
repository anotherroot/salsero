/**
 * Auto-add (levels spec, "Auto-add"): Add, run by itself. For a person and a
 * lesson it is exactly `addLesson` with `addOffer`'s default picks (the
 * lesson, its routines and drills; not its figures), in the transaction of
 * what triggered it, and only for a member whose `autoAddOn` is true in that
 * group. It only ever acts on a lesson the person has a `lesson_adds` row for:
 * `removeLesson` deletes that row, publishing runs once per lesson (there is no
 * unpublish) and growth (`autoAddPending`) only touches lessons with a row, so
 * a removed lesson is not added again by either. Joining adds only the newest
 * lesson, and leaving and joining again is a new join, so it adds the newest
 * even if the person had removed it before.
 *
 * Every function here takes `tx` and runs inside the caller's transaction.
 */
import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { autoAddOn, levelShown, parseLevel } from '$lib/levels/levels';
import type { Db } from './db';
import { lessonAdds, lessons, teamMembers, users } from './db/schema';
import { addLesson, addOffer, defaultPicks, newInLesson, tickedPicks } from './entries';
import { joinTeam } from './teams';

/** Whether auto-add is on for this member: their level (none chosen reads as Everything) and toggle. */
const isOn = (row: { level: string | null; autoAdd: number | null }) =>
	autoAddOn(levelShown(parseLevel(row.level)), row.autoAdd);

/** The group's members with auto-add on. */
function autoAdders(tx: Db, teamId: number): string[] {
	return tx
		.select({ userId: teamMembers.userId, autoAdd: teamMembers.autoAdd, level: users.level })
		.from(teamMembers)
		.leftJoin(users, eq(users.id, teamMembers.userId))
		.where(eq(teamMembers.teamId, teamId))
		.all()
		.filter(isOn)
		.map((m) => m.userId);
}

const hasAdd = (tx: Db, userId: string, lessonId: number) =>
	tx
		.select({ lessonId: lessonAdds.lessonId })
		.from(lessonAdds)
		.where(and(eq(lessonAdds.userId, userId), eq(lessonAdds.lessonId, lessonId)))
		.get() !== undefined;

/** Add with the default picks, unless the person has the lesson already (or may not add it). */
function addByItself(tx: Db, userId: string, lessonId: number, now: number): boolean {
	if (hasAdd(tx, userId, lessonId)) return false;
	const offer = addOffer(tx, userId, lessonId);
	return offer !== null && addLesson(tx, userId, lessonId, defaultPicks(offer), now);
}

/**
 * On publish, in `publishLesson`'s transaction: the lesson is added for every
 * member of its group with auto-add on (editors and the owner follow their
 * own toggle). The ids of those it was added for.
 */
export function autoAddOnPublish(tx: Db, lessonId: number, now: number): string[] {
	const lesson = tx
		.select({ teamId: lessons.teamId })
		.from(lessons)
		.where(
			and(eq(lessons.id, lessonId), isNotNull(lessons.publishedAt), isNull(lessons.archivedAt))
		)
		.get();
	if (!lesson || lesson.teamId === null) return [];
	return autoAdders(tx, lesson.teamId).filter((userId) => addByItself(tx, userId, lessonId, now));
}

/**
 * On joining a class, for the person who joined, if auto-add is on for them
 * there: only the newest published lesson (by its day), so older ones wait
 * for a tap. Its id when it was added; null when nothing was (auto-add off,
 * no lesson yet, or one they already have).
 */
export function autoAddOnJoin(tx: Db, userId: string, teamId: number, now: number): number | null {
	const member = tx
		.select({ autoAdd: teamMembers.autoAdd, level: users.level })
		.from(teamMembers)
		.leftJoin(users, eq(users.id, teamMembers.userId))
		.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
		.get();
	if (!member || !isOn(member)) return null;
	const newest = tx
		.select({ id: lessons.id })
		.from(lessons)
		.where(
			and(eq(lessons.teamId, teamId), isNotNull(lessons.publishedAt), isNull(lessons.archivedAt))
		)
		.orderBy(desc(lessons.lessonDay), desc(lessons.id))
		.get();
	if (!newest) return null;
	return addByItself(tx, userId, newest.id, now) ? newest.id : null;
}

/**
 * Join a class (`joinTeam`) and, on a first join, auto-add its newest lesson
 * (`autoAddOnJoin`), in one transaction. Someone already in it adds nothing,
 * so a lesson they removed since stays removed.
 */
export function joinClass(
	db: Db,
	userId: string,
	teamId: number,
	now: number
): 'joined' | 'already' | 'refused' {
	return db.transaction((tx) => {
		const joined = joinTeam(tx, userId, teamId, now);
		if (joined === 'joined') autoAddOnJoin(tx, userId, teamId, now);
		return joined;
	});
}

/**
 * When published lessons gain something to practise: for each of these
 * lessons (the ones the mutation grew, of `teamId`) and each member with
 * auto-add on who has it added, what came in since they last saw it
 * (`newInLesson`: its routines and drills) is added as Add on one pick would,
 * leaving `seen_at` alone (`touch: false`). Only the lessons that grew, so
 * growth in one lesson never adds another lesson's backlog, and the cost is
 * members × the grown lessons. Run at the end of every group mutation that
 * can grow a published lesson's reach (`GROWTH` in `auto-add.spec.ts`), in
 * its transaction. A lesson someone removed has no `lesson_adds` row of
 * theirs and is left out.
 */
export function autoAddPending(tx: Db, teamId: number, lessonIds: number[], now: number): void {
	if (lessonIds.length === 0) return;
	const adds = tx
		.select({
			userId: lessonAdds.userId,
			lessonId: lessonAdds.lessonId,
			autoAdd: teamMembers.autoAdd,
			level: users.level
		})
		.from(lessonAdds)
		.innerJoin(lessons, eq(lessons.id, lessonAdds.lessonId))
		.innerJoin(
			teamMembers,
			and(eq(teamMembers.teamId, lessons.teamId), eq(teamMembers.userId, lessonAdds.userId))
		)
		.leftJoin(users, eq(users.id, lessonAdds.userId))
		.where(
			and(
				inArray(lessons.id, [...new Set(lessonIds)]),
				eq(lessons.teamId, teamId),
				isNotNull(lessons.publishedAt),
				isNull(lessons.archivedAt)
			)
		)
		.all()
		.filter(isOn);
	for (const a of adds) {
		const fresh = newInLesson(tx, a.userId, a.lessonId);
		if (fresh.length === 0) continue;
		addLesson(tx, a.userId, a.lessonId, { ...tickedPicks(fresh), lesson: false }, now, {
			touch: false
		});
	}
}
