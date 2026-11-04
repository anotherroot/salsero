/**
 * People who left a group before Keep shipped: they kept their added lessons,
 * read-only, through `lesson_adds` with no membership. Since Keep, a former
 * member reads nothing of the group (ruling 4), so they get Keep everything
 * once, at boot (`startTrashPurge`): copies in their own app, their practice
 * on them, their adds gone. A group already purged is skipped: its files are
 * gone and there is nothing to read.
 */
import { sql } from 'drizzle-orm';
import type { Db } from '../db';
import { missingOk, type CloneFiles } from './files';
import { keepFromTeam } from './keep';

/**
 * Keep everything for every person with an add on a group's lesson, no
 * membership in that group, and the group not purged; one person and group at
 * a time. Idempotent: Keep removes their adds, so a second run finds no one.
 * A failure is logged and the others go on; that person is tried again at the
 * next boot. Returns how many were settled.
 */
export async function settleFormerMembers(db: Db, files: CloneFiles, now: number): Promise<number> {
	const former = db.all<{ userId: string; teamId: number }>(sql`
		select distinct a.user_id as userId, l.team_id as teamId
		  from lesson_adds a
		  join lessons l on l.id = a.lesson_id
		  join teams t on t.id = l.team_id
		 where t.purged_at is null
		   and not exists (
		     select 1 from team_members m where m.team_id = l.team_id and m.user_id = a.user_id
		   )
		 order by l.team_id, a.user_id
	`);
	let settled = 0;
	for (const { userId, teamId } of former) {
		try {
			await keepFromTeam(db, userId, teamId, { mode: 'all' }, missingOk(files), now);
			settled++;
		} catch (err) {
			console.warn(`[clones] could not settle ${userId} in group ${teamId}`, err);
		}
	}
	return settled;
}
