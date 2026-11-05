/**
 * Auto-add (levels spec, "Auto-add"): Add, run by itself. For a person and a
 * lesson it is exactly `addLesson` with `addOffer`'s default picks (the
 * lesson, its routines and drills; not its figures), in the transaction of
 * what triggered it, and only for a member whose `autoAddOn` is true in that
 * group. It never runs for a lesson the person already has a `lesson_adds`
 * row for, so a lesson they removed (`removeLesson`) is never added again:
 * publishing happens once per lesson (there is no unpublish), and joining
 * adds only the newest.
 *
 * Every function here takes `tx` and runs inside the caller's transaction.
 */
import { and, desc, eq, isNotNull, isNull, max } from 'drizzle-orm';
import { autoAddOn, levelShown, parseLevel } from '$lib/levels/levels';
import type { Db } from './db';
import {
	lessonAdds,
	lessonExercises,
	lessonRoutines,
	lessons,
	lessonVideos,
	spotLinks,
	teamMembers,
	users,
	videoSpots
} from './db/schema';
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
 * When the lesson last gained something it holds (a hand-linked routine or
 * drill, a section link): nothing in it can be new to a person who saw it
 * after that. A cheap bound before `newInLesson`'s full look.
 */
function lastGain(tx: Db, lessonId: number): number {
	const routine = tx
		.select({ at: max(lessonRoutines.createdAt) })
		.from(lessonRoutines)
		.where(eq(lessonRoutines.lessonId, lessonId))
		.get()?.at;
	const drill = tx
		.select({ at: max(lessonExercises.createdAt) })
		.from(lessonExercises)
		.where(eq(lessonExercises.lessonId, lessonId))
		.get()?.at;
	const section = tx
		.select({ at: max(spotLinks.createdAt) })
		.from(spotLinks)
		.innerJoin(videoSpots, eq(videoSpots.id, spotLinks.spotId))
		.innerJoin(lessonVideos, eq(lessonVideos.id, videoSpots.lessonVideoId))
		.where(eq(lessonVideos.lessonId, lessonId))
		.get()?.at;
	return Math.max(routine ?? 0, drill ?? 0, section ?? 0);
}

/**
 * When a published lesson gains something to practise: for each member with
 * auto-add on and each of the group's published lessons they have added,
 * what came in since they last saw it (`newInLesson`: its routines and
 * drills) is added as Add on one pick would, leaving `seen_at` alone
 * (`touch: false`). Run at the end of every group mutation that can grow a
 * published lesson's reach (`GROWTH` in `auto-add.spec.ts`), in its
 * transaction. A lesson they removed has no `lesson_adds` row and is left out.
 */
export function autoAddPending(tx: Db, teamId: number, now: number): void {
	const adds = tx
		.select({
			userId: lessonAdds.userId,
			lessonId: lessonAdds.lessonId,
			seenAt: lessonAdds.seenAt,
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
			and(eq(lessons.teamId, teamId), isNotNull(lessons.publishedAt), isNull(lessons.archivedAt))
		)
		.all()
		.filter(isOn);
	if (adds.length === 0) return;
	const gained = new Map<number, number>();
	for (const id of new Set(adds.map((a) => a.lessonId))) gained.set(id, lastGain(tx, id));
	for (const a of adds) {
		if (gained.get(a.lessonId)! <= a.seenAt) continue;
		const fresh = newInLesson(tx, a.userId, a.lessonId);
		if (fresh.length === 0) continue;
		addLesson(tx, a.userId, a.lessonId, { ...tickedPicks(fresh), lesson: false }, now, {
			touch: false
		});
	}
}
