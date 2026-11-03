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

export function groupModeOf(
	db: Db,
	userId: string,
	dance: DanceSlug,
	cookies: Cookies
): GroupMode | null {
	const name = groupCookie(dance);
	const raw = cookies.get(name);
	if (raw === undefined) return null;
	const refuse = () => {
		cookies.delete(name, { path: '/' });
		return null;
	};
	if (!/^[1-9][0-9]{0,9}$/.test(raw)) return refuse();
	const team = getTeam(db, Number(raw));
	if (!team || team.dance !== dance || team.deletedAt !== null || team.purgedAt !== null)
		return refuse();
	const role = roleOf(db, userId, team.id);
	if (role !== 'owner' && role !== 'editor') return refuse();
	return { teamId: team.id, name: team.name, role };
}

/** Whose content this request stands in: the switched-into group, else the person. */
export function spaceOf(
	db: Db,
	params: { dance: string },
	locals: App.Locals,
	cookies: Cookies
): Space {
	const wall = wallOf(params, locals);
	const mode = groupModeOf(db, wall.userId, wall.dance, cookies);
	return mode ? { dance: wall.dance, teamId: mode.teamId, actorId: wall.userId } : wall;
}
