/**
 * Who is in a group, changed: a role set, a person removed, a person leaving.
 * Each can shrink what the person reaches (an editor reads the drafts, a
 * member only the published lessons, a former member only the lessons they
 * added), so each runs `reconcileEntries` for that person in the same
 * transaction: an entry never outlives what it practises (risk 25). A
 * leaver's entries for the lessons they added stay live; those lessons stay
 * theirs, read-only.
 *
 * Apart from `teams.ts` because `entries.ts` reaches `teams.ts` through
 * `access.ts`: kept here, there is no import cycle.
 *
 * setRole and removeMember take no actor: the route checks
 * `roleOf(db, userId, teamId) === 'owner'` before calling them.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { Db } from './db';
import { teamMembers } from './db/schema';
import { reconcileEntries } from './entries';
import { roleOf } from './teams';

/** Changes a non-owner member between editor and member. The caller has checked the owner. */
export function setRole(
	db: Db,
	teamId: number,
	userId: string,
	role: 'editor' | 'member',
	now = Date.now()
): boolean {
	return db.transaction((tx) => {
		const changed =
			tx
				.update(teamMembers)
				.set({ role })
				.where(
					and(
						eq(teamMembers.teamId, teamId),
						eq(teamMembers.userId, userId),
						sql`${teamMembers.role} != 'owner'`
					)
				)
				.run().changes > 0;
		// An editor's entries on drafts go off Today with the drafts.
		if (changed && role === 'member') reconcileEntries(tx, teamId, now, userId);
		return changed;
	});
}

/** Removes a member other than the owner. The caller has checked the owner. */
export function removeMember(db: Db, teamId: number, userId: string, now = Date.now()): boolean {
	return db.transaction((tx) => {
		const removed =
			tx
				.delete(teamMembers)
				.where(
					and(
						eq(teamMembers.teamId, teamId),
						eq(teamMembers.userId, userId),
						sql`${teamMembers.role} != 'owner'`
					)
				)
				.run().changes > 0;
		if (removed) reconcileEntries(tx, teamId, now, userId);
		return removed;
	});
}

/** A member or editor leaves; the owner hands the group over first, or deletes it. */
export function leaveTeam(
	db: Db,
	teamId: number,
	userId: string,
	now = Date.now()
): 'left' | 'owner' {
	return db.transaction((tx) => {
		if (roleOf(tx, userId, teamId) === 'owner') return 'owner' as const;
		const left =
			tx
				.delete(teamMembers)
				.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
				.run().changes > 0;
		if (left) reconcileEntries(tx, teamId, now, userId);
		return 'left' as const;
	});
}
