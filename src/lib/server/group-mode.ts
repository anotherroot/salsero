/**
 * Group mode: a per-dance cookie names the group a person has switched into.
 * The cookie is the client's, so it is never trusted: `groupModeOf` re-checks
 * the group and the role on every call and drops a cookie that fails.
 */
import type { Cookies } from '@sveltejs/kit';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { DanceSlug } from '$lib/dances/dances';
import { groupCookie, outsideGroupMode } from '$lib/teams/mode';
import { rowKindOf, viewParam, type RowKind } from '$lib/teams/group-view';
import { initialOf } from '$lib/comments/view';
import type { GroupChoice, GroupMode } from '$lib/types';
import type { Db } from './db';
import {
	exercises,
	figureGroups,
	figures,
	lessons,
	positions,
	routines,
	songs,
	teamMembers,
	teams,
	users
} from './db/schema';
import { wallOf, type Space, type Wall } from './scope';
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
	return groupModeFor(db, userId, dance, team.id, chosen);
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

/** Whose content this request stands in: the group its `in` names (re-checked), else the person. */
export function spaceOf(db: Db, params: { dance: string }, locals: App.Locals, url: URL): Space {
	const wall = wallOf(params, locals);
	const mode = groupModeFor(
		db,
		wall.userId,
		wall.dance,
		viewParam(url.searchParams),
		locals.user?.level
	);
	return mode ? { dance: wall.dance, teamId: mode.teamId, actorId: wall.userId } : wall;
}

/**
 * The group view (spec 2026-11-09): `teamId`'s group when the person may work in
 * it (alive, this dance, owner or editor, at Everything), with its people: how
 * many, and up to three others' initials. `level` as in `groupModeOf`.
 */
export function groupModeFor(
	db: Db,
	userId: string,
	dance: DanceSlug,
	teamId: number | null,
	level?: Level | null
): GroupMode | null {
	if (teamId === null) return null;
	const chosen = level === undefined ? levelOf(db, userId) : level;
	if (chosen !== null && !groupModeShown(chosen)) return null;
	const team = getTeam(db, teamId);
	if (!team || team.dance !== dance || team.deletedAt !== null || team.purgedAt !== null)
		return null;
	const role = roleOf(db, userId, team.id);
	if (role !== 'owner' && role !== 'editor') return null;
	const people = db
		.select({ userId: teamMembers.userId, first: users.firstName, last: users.lastName })
		.from(teamMembers)
		.innerJoin(users, eq(users.id, teamMembers.userId))
		.where(eq(teamMembers.teamId, team.id))
		.orderBy(asc(users.firstName), asc(users.lastName), asc(users.id))
		.all();
	const faces = people
		.filter((p) => p.userId !== userId)
		.slice(0, 3)
		.map((p) => initialOf(p.first) + initialOf(p.last));
	return { teamId: team.id, name: team.name, role, people: people.length, faces };
}

const ROW_TABLES = {
	lesson: lessons,
	figure: figures,
	routine: routines,
	position: positions,
	move: figureGroups,
	song: songs,
	drill: exercises
} as const;

/** The group a row belongs to (null: a person's own), or null for no such row. */
export function rowTeam(
	db: Db,
	kind: RowKind,
	id: number
): { teamId: number | null; dance: string } | null {
	if (kind === 'group') {
		const team = getTeam(db, id);
		return team ? { teamId: team.id, dance: team.dance } : null;
	}
	const t = ROW_TABLES[kind];
	return db.select({ teamId: t.teamId, dance: t.dance }).from(t).where(eq(t.id, id)).get() ?? null;
}

/**
 * Which group's view a request is in (spec 2026-11-09, "When you are in a
 * group's view"): a page of one thing by its row, never by `in`; a group's
 * drill by `in` only when `in` names the drill's group; Today and its pages
 * never; any other page by `in`. Everything re-checked (`groupModeFor`).
 */
export function viewOf(
	db: Db,
	wall: Wall,
	level: Level | null | undefined,
	at: { routeId: string | null; params: Partial<Record<string, string>>; url: URL }
): GroupMode | null {
	const kind = rowKindOf(at.routeId);
	const asked = viewParam(at.url.searchParams);
	if (kind !== null) {
		const id = Number(at.params.id);
		const row = Number.isInteger(id) && id > 0 ? rowTeam(db, kind, id) : null;
		if (!row || row.teamId === null || row.dance !== wall.dance) return null;
		if (kind === 'drill' && asked !== row.teamId) return null;
		return groupModeFor(db, wall.userId, wall.dance, row.teamId, level);
	}
	if (outsideGroupMode(at.url.pathname, wall.dance)) return null;
	return groupModeFor(db, wall.userId, wall.dance, asked, level);
}
