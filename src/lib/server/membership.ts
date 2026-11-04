/**
 * Who is in a group, changed: a role set, a person removed, a person leaving.
 * Each can shrink what the person reaches (an editor reads the drafts, a
 * member only the published lessons, a former member nothing), so each runs
 * `reconcileEntries` for that person in the same transaction: an entry never
 * outlives what it practises (risk 25). Leaving and removal first keep copies
 * in the person's own app (`keepFromTeam`: leaving what they chose, removal
 * everything), and their practice follows onto the copies.
 *
 * Apart from `teams.ts` because `entries.ts` reaches `teams.ts` through
 * `access.ts`: kept here, there is no import cycle.
 *
 * setRole and removeMember take no actor: the route checks
 * `roleOf(db, userId, teamId) === 'owner'` before calling them.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { KeepChoice } from '$lib/types';
import type { Db } from './db';
import { teamMembers } from './db/schema';
import { reconcileEntries } from './entries';
import { roleOf } from './teams';
import type { CloneFiles } from './clones/files';
import { keepFromTeam } from './clones/keep';

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

/** The person's membership row's role, or null when they are not in the group. */
function memberRole(db: Db, teamId: number, userId: string): string | null {
	return (
		db
			.select({ role: teamMembers.role })
			.from(teamMembers)
			.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
			.get()?.role ?? null
	);
}

/**
 * Out of the group: the membership row goes and `reconcileEntries` archives
 * any entry left on what the person no longer reaches, in one transaction.
 * Whether a row went.
 */
function dropMember(db: Db, teamId: number, userId: string, now: number): boolean {
	return db.transaction((tx) => {
		const dropped =
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
		if (dropped) reconcileEntries(tx, teamId, now, userId);
		return dropped;
	});
}

/**
 * Removes a member other than the owner; the caller has checked the owner.
 * The person keeps everything first (`keepFromTeam`), while they still reach
 * it: otherwise the rescue in `reconcileEntries` would copy what their
 * routines use without its recordings, and Keep would then reuse those copies.
 */
export async function removeMember(
	db: Db,
	teamId: number,
	userId: string,
	files: CloneFiles,
	now: number
): Promise<boolean> {
	const role = memberRole(db, teamId, userId);
	if (role === null || role === 'owner') return false;
	await keepFromTeam(db, userId, teamId, { mode: 'all' }, files, now);
	return dropMember(db, teamId, userId, now);
}

/**
 * A member or editor leaves, keeping what they chose (`keepFromTeam`, before
 * the membership goes, as for removal); the owner hands the group over first,
 * or deletes it.
 */
export async function leaveTeam(
	db: Db,
	teamId: number,
	userId: string,
	choice: KeepChoice,
	files: CloneFiles,
	now: number
): Promise<'left' | 'owner'> {
	if (roleOf(db, userId, teamId) === 'owner') return 'owner';
	if (memberRole(db, teamId, userId) === null) return 'left';
	await keepFromTeam(db, userId, teamId, choice, files, now);
	dropMember(db, teamId, userId, now);
	return 'left';
}
