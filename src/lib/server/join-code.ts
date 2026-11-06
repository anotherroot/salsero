/**
 * Joining a class by the code a person typed (the first run, the Groups tab,
 * My class). The one function every code join goes through, so what follows a
 * join (auto-add of the newest lesson) is wired in one place.
 */
import { eq } from 'drizzle-orm';
import { isDanceSlug, type DanceSlug } from '$lib/dances/dances';
import type { Db } from './db';
import { teams } from './db/schema';
import { normaliseCode, sameDance } from './teams';
import { joinClass } from './auto-add';

export type JoinResult =
	{ ok: true; teamId: number; dance: DanceSlug } | { ok: false; reason: 'unknown' | 'refused' };

/**
 * `unknown`: no group has this code. `refused`: the group is deleted or purged.
 * Joining twice is fine and leaves one membership.
 */
export function joinWithCode(db: Db, userId: string, code: string, now: number): JoinResult {
	const normal = normaliseCode(code);
	const team = normal ? db.select().from(teams).where(eq(teams.code, normal)).get() : undefined;
	// Another dance's group is as unknown as no group (the dance split).
	if (!team || !isDanceSlug(team.dance) || !sameDance(db, userId, team.dance))
		return { ok: false, reason: 'unknown' };
	if (team.deletedAt !== null || team.purgedAt !== null) return { ok: false, reason: 'refused' };
	// joinClass: a first join auto-adds the class's newest lesson when auto-add is on.
	if (joinClass(db, userId, team.id, now) === 'refused') return { ok: false, reason: 'refused' };
	return { ok: true, teamId: team.id, dance: team.dance };
}
