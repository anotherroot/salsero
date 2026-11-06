/**
 * Group mode: a per-dance cookie names the group a person has switched into.
 * The cookie is the client's, so it is never trusted: `groupModeOf` re-checks
 * the group and the role on every call and drops a cookie that fails.
 */
import type { Cookies } from '@sveltejs/kit';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { DanceSlug } from '$lib/dances/dances';
import { groupCookie } from '$lib/teams/mode';
import type { GroupChoice, GroupMode } from '$lib/types';
import type { Db } from './db';
import { teamMembers, teams } from './db/schema';
import { wallOf, type Space } from './scope';
import { getTeam, roleOf } from './teams';
import { levelOf } from './levels';
import { groupModeShown, type Level } from '$lib/levels/levels';

export function groupChoices(db: Db, userId: string, dance: DanceSlug): GroupChoice[] {
	return db
		.select({
			teamId: teams.id,
			name: teams.name,
			role: teamMembers.role,
			people: sql<number>`(select count(*) from team_members m where m.team_id = ${teams.id})`
		})
		.from(teamMembers)
		.innerJoin(teams, eq(teams.id, teamMembers.teamId))
		.where(
			and(
				eq(teamMembers.userId, userId),
				eq(teams.dance, dance),
				isNull(teams.deletedAt),
				isNull(teams.purgedAt)
			)
		)
		.orderBy(asc(teams.name), asc(teams.id))
		.all()
		.filter((r) => r.role === 'owner' || r.role === 'editor') as GroupChoice[];
}

/**
 * `level`: the person's level when the caller has it (`locals.user.level`), so
 * the per-request callers skip the lookup; left out, it is read here.
 */
export function groupModeOf(
	db: Db,
	userId: string,
	dance: DanceSlug,
	cookies: Cookies,
	level?: Level | null
): GroupMode | null {
	const name = groupCookie(dance);
	const raw = cookies.get(name);
	if (raw === undefined) return null;
	const refuse = () => {
		cookies.delete(name, { path: '/' });
		return null;
	};
	if (!/^[1-9][0-9]{0,9}$/.test(raw)) return refuse();
	// The switch is drawn only at Everything: a cookie left from there does not
	// keep a lower level writing into the group. Null (not chosen yet) is the first run's.
	const chosen = level === undefined ? levelOf(db, userId) : level;
	if (chosen !== null && !groupModeShown(chosen)) return refuse();
	const team = getTeam(db, Number(raw));
	if (!team || team.dance !== dance || team.deletedAt !== null || team.purgedAt !== null)
		return refuse();
	const role = roleOf(db, userId, team.id);
	if (role !== 'owner' && role !== 'editor') return refuse();
	return { teamId: team.id, name: team.name, role };
}

/**
 * Whether the request is in this group's own workspace (group mode on
 * `teamId`): twins show nothing there. Read-only on the cookie: a load never
 * sets or deletes it.
 */
export function inGroupModeOn(
	db: Db,
	userId: string,
	dance: DanceSlug,
	teamId: number | null,
	cookies: Pick<Cookies, 'get'> | undefined
): boolean {
	if (teamId === null) return false;
	const quiet = {
		get: (name: string) => cookies?.get(name),
		delete: () => {}
	} as unknown as Cookies;
	return groupModeOf(db, userId, dance, quiet)?.teamId === teamId;
}

/** Whose content this request stands in: the switched-into group, else the person. */
export function spaceOf(
	db: Db,
	params: { dance: string },
	locals: App.Locals,
	cookies: Cookies
): Space {
	const wall = wallOf(params, locals);
	const mode = groupModeOf(db, wall.userId, wall.dance, cookies, locals.user?.level);
	return mode ? { dance: wall.dance, teamId: mode.teamId, actorId: wall.userId } : wall;
}
