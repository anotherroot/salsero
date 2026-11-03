/**
 * Which wall a request stands behind — one person's side of one dance — and the
 * rows it may reach by id.
 *
 * `/salsa/…` and `/bachata/…` are the same code with a different slug, and the
 * ids in a form body are just numbers — nothing in them says which dance, or
 * whose, they came from. Without a check, a POST to `/salsa` carrying a bachata
 * id, or another person's, acts on the other side of the wall while the URL
 * claims otherwise. That is worse than the reading version of the same bug,
 * because it mutates.
 *
 * The detail pages (a figure, a lesson) hold their own guard on top of these,
 * because each also decides what "archived" means for its own row. Everything
 * else is shared: exercises and sets are reached from both Today and the
 * player, and a song from both the list and its own page.
 *
 * A missing row and a row from another wall get the same answer, 404 — the
 * same one the detail pages give, and deliberately indistinguishable: telling
 * them apart would confirm that someone else owns that id.
 *
 * Positions are the one exception: a shared list per dance, used by everyone
 * and edited by the admin, so they stand behind the dance alone.
 */
import { error } from '@sveltejs/kit';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { Db } from './db';
import {
	allows,
	drillAccess,
	figureAccess,
	lessonAccess,
	routineAccess,
	type Access
} from './access';
import {
	figures,
	lessons,
	type Exercise,
	type Figure,
	type Lesson,
	type Routine
} from './db/schema';
import { getExercise, getSet } from './exercises';
import { getPosition } from './positions';
import { getRoutine } from './routines';
import { getSong } from './songs';
import { getTeam, roleOf, type Team } from './teams';
import { isDanceSlug, type DanceSlug } from '$lib/dances/dances';
import type { Role } from '$lib/types';

/**
 * The dance this URL names, or a 404.
 *
 * `[dance]/+layout.server.ts` validates the slug too, but a form action runs
 * BEFORE any load — so on a POST the layout's gate has not happened yet and
 * `params.dance` is whatever was typed. Without this, `POST /kizomba?/create`
 * would insert a row with `dance='kizomba'`, and the column deliberately has
 * no CHECK to catch it (see `schema.ts`), so the invariant has to live here.
 *
 * It also replaces the `params.dance as DanceSlug` cast, which was the thing
 * silencing the compiler about exactly this.
 *
 * Everything else goes through `wallOf`; only the positions page, whose list
 * is shared by everyone in a dance, needs the dance with no person.
 */
export function danceOf(params: { dance: string }): DanceSlug {
	if (!isDanceSlug(params.dance)) throw error(404, 'No such dance');
	return params.dance;
}

/** One person's side of one dance: what every data function filters by. */
export type Wall = { userId: string; dance: DanceSlug };

/** The wall this request stands behind: its dance and its signed-in user. */
export function wallOf(params: { dance: string }, locals: App.Locals): Wall {
	const dance = danceOf(params);
	if (!locals.user) throw error(401, 'Sign in');
	return { userId: locals.user.id, dance };
}

/**
 * A group's side of one dance, and the person acting in it. A group row has
 * `team_id` set and `user_id` null: who made it is History's to say, never
 * `user_id`, or the maker's storage and lists would carry the group's things.
 * (In code a group is a team: `figure_groups` already means a figure.)
 */
export type TeamSpace = { dance: DanceSlug; teamId: number; actorId: string };

/**
 * Whose content a request stands in: a person's own wall or a group's. The
 * content functions (figures, lessons, routines, drills, section links) take a
 * `Space`; personal-only code (songs, count takes, Today, storage, settings)
 * keeps taking a `Wall`.
 */
export type Space = Wall | TeamSpace;

export function isTeam(s: Space): s is TeamSpace {
	return 'teamId' in s;
}

/** The person acting in a space: the wall's own person, or the group's actor. */
export function actorOf(s: Space): string {
	return isTeam(s) ? s.actorId : s.userId;
}

/**
 * A root table's rows in this space, as a where clause: the dance, and either
 * this person's with no team, or this team's. A person's lists never show a
 * team row, not even one that somehow carried their id.
 */
export function ownedBy(
	cols: { userId: SQLiteColumn; teamId: SQLiteColumn; dance: SQLiteColumn },
	s: Space
): SQL {
	const owner = isTeam(s)
		? eq(cols.teamId, s.teamId)
		: and(eq(cols.userId, s.userId), isNull(cols.teamId));
	return and(eq(cols.dance, s.dance), owner)!;
}

/** The owner columns a new root row is inserted with: exactly one of the two set. */
export function ownerValues(s: Space): {
	dance: DanceSlug;
	userId: string | null;
	teamId: number | null;
} {
	return isTeam(s)
		? { dance: s.dance, userId: null, teamId: s.teamId }
		: { dance: s.dance, userId: s.userId, teamId: null };
}

/** Whether a row is in this space: its dance, and its person (with no team) or its team. */
export function inSpace(
	row: { dance: string; userId: string | null; teamId: number | null },
	s: Space
): boolean {
	if (row.dance !== s.dance) return false;
	return isTeam(s) ? row.teamId === s.teamId : row.teamId === null && row.userId === s.userId;
}

/**
 * The space a root row stands in; `actorId` is who acts when it is a team's.
 * Throws when both owners are set: `ownerIntegrity` reports such a row, and
 * guessing would put it on the wrong side of a wall. A row with neither gets a
 * wall no request has (`userId: ''`), so it fails closed.
 */
export function spaceOfRow(
	row: { dance: string; userId: string | null; teamId: number | null },
	actorId: string
): Space {
	if (row.userId !== null && row.teamId !== null) throw new Error('row has no owner');
	const dance = row.dance as DanceSlug;
	if (row.teamId !== null) return { dance, teamId: row.teamId, actorId };
	return { dance, userId: row.userId ?? '' };
}

/** Whether a row is in this wall: this person's, in this dance. */
export function inWall(row: { dance: string; userId: string | null }, wall: Wall): boolean {
	return row.dance === wall.dance && row.userId === wall.userId;
}

/** A 404 unless the signed-in user is the admin. */
export function requireAdmin(locals: App.Locals): void {
	if (!locals.user?.isAdmin) throw error(404, 'Not found');
}

/** The exercise if it is in this wall, else null — for reads that degrade. */
export function exerciseInWall(db: Db, wall: Wall, id: number) {
	const found = getExercise(db, id);
	return found && inWall(found, wall) ? found : null;
}

/**
 * The exercise, or a 404. Anything that writes by id uses this: a mismatch must
 * stop the request, not fall through to a friendlier message that still acted.
 */
export function requireExerciseInWall(db: Db, wall: Wall, id: number) {
	const found = exerciseInWall(db, wall, id);
	if (!found) throw error(404, 'No such exercise');
	return found;
}

/**
 * The set, or a 404. A set has no `dance` or owner column: it is the wall of
 * its exercise, resolved through `exerciseId`.
 */
export function requireSetInWall(db: Db, wall: Wall, id: number) {
	const set = getSet(db, id);
	if (!set) throw error(404, 'No such set');
	requireExerciseInWall(db, wall, set.exerciseId);
	return set;
}

/**
 * The song, or a 404.
 *
 * Both the songs list and a song's own page act on a song by id — `retry` on
 * the list, seven actions on the page — so the dance rule lives here and is
 * called from both. Archived is a separate question the detail page asks after
 * this one, because the list's retry has its own answer for it.
 */
export function requireSongInWall(db: Db, wall: Wall, id: number) {
	const song = getSong(db, id);
	if (!song || !inWall(song, wall)) throw error(404, 'Song not found');
	return song;
}

/**
 * The position, or a 404.
 *
 * A position id in a form body is just a number, and the vocabulary page acts
 * on one from three different actions — so the dance rule lives here and is
 * called from each. An archived position is still a position: the page's own
 * list is what stops it being offered, and refusing it here would make renaming
 * one impossible.
 */
export function requirePositionInDance(db: Db, dance: DanceSlug, id: number) {
	const position = getPosition(db, id);
	if (!position || position.dance !== dance) throw error(404, 'No such position');
	return position;
}

type Need = 'read' | 'edit';
type Granted = 'edit' | 'read';

/** The row's guard: its dance is the URL's, and this person's access reaches `need`. */
function guarded<T extends { dance: string; userId: string | null; teamId: number | null }>(
	params: { dance: string },
	locals: App.Locals,
	row: T | null,
	access: (userId: string, row: T) => Access,
	need: Need,
	message: string
): { row: T; space: Space; access: Granted } {
	const wall = wallOf(params, locals);
	if (!row || row.dance !== wall.dance) throw error(404, message);
	const got = access(wall.userId, row);
	if (got === null || !allows(got, need)) throw error(404, message);
	return { row, space: spaceOfRow(row, wall.userId), access: got };
}

/** A route's id, from the URL or a form: a positive integer, else 0 (which matches nothing). */
const idOf = (id: number | string) => {
	const n = typeof id === 'number' ? id : Number(id);
	return Number.isSafeInteger(n) && n > 0 ? n : 0;
};

/**
 * The lesson, or a 404 — for a missing one, another dance's, and one this
 * person may not `need`: a member asking to edit gets the stranger's answer.
 * Archived is the page's question, asked after this one.
 */
export function requireLessonAccess(
	db: Db,
	locals: App.Locals,
	params: { dance: string },
	id: number | string,
	need: Need
): { lesson: Lesson; space: Space; access: Granted } {
	const lesson =
		db
			.select()
			.from(lessons)
			.where(eq(lessons.id, idOf(id)))
			.get() ?? null;
	const g = guarded(
		params,
		locals,
		lesson,
		(u, l) => lessonAccess(db, u, l),
		need,
		'No such lesson'
	);
	return { lesson: g.row, space: g.space, access: g.access };
}

/** The variation, or a 404, as `requireLessonAccess`. */
export function requireFigureAccess(
	db: Db,
	locals: App.Locals,
	params: { dance: string },
	id: number | string,
	need: Need
): { figure: Figure; space: Space; access: Granted } {
	const figure =
		db
			.select()
			.from(figures)
			.where(eq(figures.id, idOf(id)))
			.get() ?? null;
	const g = guarded(
		params,
		locals,
		figure,
		(u, f) => figureAccess(db, u, f),
		need,
		'Figure not found'
	);
	return { figure: g.row, space: g.space, access: g.access };
}

/**
 * The routine, or a 404, as `requireLessonAccess`.
 *
 * Every action on the detail page acts on a routine by id, and a slot id in a
 * form body is just a number — so the routine is resolved here first and the
 * slot mutations all take the routine id alongside the slot's, which is what
 * stops a salsa request editing a bachata routine's slots.
 *
 * An archived routine is still a routine: the page shows it and offers to look,
 * the same way an archived position can still be renamed.
 */
export function requireRoutineAccess(
	db: Db,
	locals: App.Locals,
	params: { dance: string },
	id: number | string,
	need: Need
): { routine: Routine; space: Space; access: Granted } {
	const g = guarded(
		params,
		locals,
		getRoutine(db, idOf(id)),
		(u, r) => routineAccess(db, u, r),
		need,
		'No such routine'
	);
	return { routine: g.row, space: g.space, access: g.access };
}

/**
 * The exercise, or a 404, as `requireLessonAccess`. Read means the person's
 * own row (an entry is one) or a group drill in reach; edit, their own row or
 * a drill of a group they edit.
 *
 * Never for logging: a set, the practice endpoint, `popupData` and the
 * player's save stay on `requireExerciseInWall`, so a log only ever lands on
 * the person's own row, never on a drill everyone shares (risk 22).
 */
export function requireExerciseAccess(
	db: Db,
	locals: App.Locals,
	params: { dance: string },
	id: number | string,
	need: Need
): { exercise: Exercise; space: Space; access: Granted } {
	const g = guarded(
		params,
		locals,
		getExercise(db, idOf(id)),
		(u, e) => drillAccess(db, u, e),
		need,
		'No such exercise'
	);
	return { exercise: g.row, space: g.space, access: g.access };
}

const TEAM_RANK = { member: 0, editor: 1, owner: 2 } as const;

/**
 * The group a request stands in, or a 404. `params` is `{ dance, id }`. An
 * outsider, a missing group, another dance's group, a deleted one (except to
 * its owner, see `roleOf`) and a role below `need` all get the same 404, so
 * a member asking to write learns nothing a stranger would not.
 */
export function requireTeam(
	db: Db,
	locals: App.Locals,
	params: { dance: string; id: string },
	need: Role
): { team: Team; role: Role; space: TeamSpace } {
	const wall = wallOf(params, locals);
	const id = Number(params.id);
	const team = Number.isInteger(id) ? getTeam(db, id) : null;
	const role = team ? roleOf(db, wall.userId, team.id) : null;
	if (!team || team.dance !== wall.dance || !role || TEAM_RANK[role] < TEAM_RANK[need]) {
		throw error(404, 'No such group');
	}
	return { team, role, space: { dance: wall.dance, teamId: team.id, actorId: wall.userId } };
}
