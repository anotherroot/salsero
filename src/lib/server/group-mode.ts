/**
 * The group view (spec 2026-11-09): which group a request works in. A page of
 * one thing decides by its row, a list by its `?in=`; whatever names a group is
 * the client's, so it is re-checked on every call (`groupModeFor`).
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { DanceSlug } from '$lib/dances/dances';
import { rowKindOf, viewParam, withView, type RowKind } from '$lib/teams/group-view';
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
	songImports,
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
 * many, and up to three others' initials. `level`: the person's level when the caller
 * has it (`locals.user.level`); left out, it is read here.
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
	drill: exercises,
	import: songImports
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
 * group's view"): `at` is the load event (a missing route or URL is no group).
 * A page of one thing by its row, never by `in`; a group's
 * drill by `in` only when `in` names the drill's group; Today and its pages
 * never; any other page by `in`. Everything re-checked (`groupModeFor`).
 */
export function viewOf(
	db: Db,
	wall: Wall,
	level: Level | null | undefined,
	at: {
		route?: { id: string | null };
		params: Partial<Record<string, string>>;
		url?: URL;
	}
): GroupMode | null {
	const routeId = at.route?.id ?? null;
	const kind = rowKindOf(routeId);
	const asked = at.url ? viewParam(at.url.searchParams) : null;
	if (kind !== null) {
		const id = Number(at.params.id);
		const row = Number.isInteger(id) && id > 0 ? rowTeam(db, kind, id) : null;
		if (!row || row.teamId === null || row.dance !== wall.dance) return null;
		if (kind === 'drill' && asked !== row.teamId) return null;
		return groupModeFor(db, wall.userId, wall.dance, row.teamId, level);
	}
	// By the route, not the path: a layout that read the path would rerun on every step.
	if (routeId === '/[dance]/(today)' || routeId?.startsWith('/[dance]/(today)/')) return null;
	return groupModeFor(db, wall.userId, wall.dance, asked, level);
}

/**
 * `path` (a list) in the view of a row owned by `teamId`: the group's list when the
 * person works in that group, else their own. For a step back to a list from a row.
 */
export function listInViewOf(
	db: Db,
	wall: Wall,
	level: Level | null | undefined,
	teamId: number | null,
	path: string
): string {
	return withView(path, groupModeFor(db, wall.userId, wall.dance, teamId, level)?.teamId ?? null);
}
