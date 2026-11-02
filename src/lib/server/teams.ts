/** Groups (teams in code): making, roles, codes, joining. Data functions take `db` first. */
import { randomInt } from 'node:crypto';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { fold } from '$lib/fold';
import { TEAM_CODE_LENGTH, TEAMS_MADE_DEFAULT } from '$lib/limits';
import { cleanName, fullName } from '$lib/names';
import type { DanceSlug } from '$lib/dances/dances';
import type { Person, Role, TeamItem } from '$lib/types';
import type { Db } from './db';
import { teamMembers, teams, users } from './db/schema';

export type { Role };
export type Team = typeof teams.$inferSelect;

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newTeamCode(): string {
	let s = '';
	for (let i = 0; i < TEAM_CODE_LENGTH; i++) s += CROCKFORD[randomInt(CROCKFORD.length)];
	return s;
}

/** What a person typed, as stored: uppercase, I and L read as 1, O as 0, separators dropped. */
function normaliseCode(raw: string): string {
	return raw.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
}

/** Groups the person owns that are not purged (a deleted one still counts). */
export function teamsMade(db: Db, userId: string): number {
	const row = db
		.select({ n: sql<number>`count(*)` })
		.from(teamMembers)
		.innerJoin(teams, eq(teams.id, teamMembers.teamId))
		.where(
			and(eq(teamMembers.userId, userId), eq(teamMembers.role, 'owner'), isNull(teams.purgedAt))
		)
		.get();
	return row?.n ?? 0;
}

export function teamLimit(db: Db, userId: string): number {
	const row = db.select({ g: users.groupLimit }).from(users).where(eq(users.id, userId)).get();
	return row?.g ?? TEAMS_MADE_DEFAULT;
}

/** Whether the owner already has a live group of this dance with this name (folded). */
function nameTaken(db: Db, ownerId: string, dance: string, name: string, exceptId?: number) {
	const mine = db
		.select({ id: teams.id, name: teams.name })
		.from(teams)
		.innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
		.where(
			and(
				eq(teamMembers.userId, ownerId),
				eq(teamMembers.role, 'owner'),
				eq(teams.dance, dance),
				isNull(teams.deletedAt)
			)
		)
		.all();
	const f = fold(name);
	return mine.some((t) => t.id !== exceptId && fold(t.name) === f);
}

function freshCode(db: Db): string {
	for (;;) {
		const code = newTeamCode();
		if (!db.select({ id: teams.id }).from(teams).where(eq(teams.code, code)).get()) return code;
	}
}

export function createTeam(
	db: Db,
	userId: string,
	dance: DanceSlug,
	rawName: string,
	now: number
): { ok: true; teamId: number } | { ok: false; reason: 'limit' | 'name' } {
	const name = cleanName(rawName);
	if (!name) return { ok: false, reason: 'name' };
	return db.transaction((tx) => {
		if (teamsMade(tx as unknown as Db, userId) >= teamLimit(tx as unknown as Db, userId))
			return { ok: false, reason: 'limit' } as const;
		if (nameTaken(tx as unknown as Db, userId, dance, name))
			return { ok: false, reason: 'name' } as const;
		const row = tx
			.insert(teams)
			.values({
				dance,
				name,
				code: freshCode(tx as unknown as Db),
				createdBy: userId,
				createdAt: now
			})
			.returning({ id: teams.id })
			.get();
		tx.insert(teamMembers).values({ teamId: row.id, userId, role: 'owner', joinedAt: now }).run();
		return { ok: true, teamId: row.id } as const;
	});
}

export function getTeam(db: Db, teamId: number): Team | null {
	return db.select().from(teams).where(eq(teams.id, teamId)).get() ?? null;
}

/** The person's role, or null. A deleted (or purged) group has no role except its owner's. */
export function roleOf(db: Db, userId: string, teamId: number): Role | null {
	const row = db
		.select({ role: teamMembers.role, deletedAt: teams.deletedAt, purgedAt: teams.purgedAt })
		.from(teamMembers)
		.innerJoin(teams, eq(teams.id, teamMembers.teamId))
		.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
		.get();
	if (!row) return null;
	if ((row.deletedAt !== null || row.purgedAt !== null) && row.role !== 'owner') return null;
	return row.role as Role;
}

export function listMyTeams(db: Db, userId: string, dance: DanceSlug): TeamItem[] {
	const rows = db
		.select({
			id: teams.id,
			name: teams.name,
			dance: teams.dance,
			role: teamMembers.role,
			deletedAt: teams.deletedAt,
			people: sql<number>`(select count(*) from team_members m where m.team_id = ${teams.id})`
		})
		.from(teamMembers)
		.innerJoin(teams, eq(teams.id, teamMembers.teamId))
		.where(and(eq(teamMembers.userId, userId), eq(teams.dance, dance), isNull(teams.purgedAt)))
		.orderBy(asc(teams.name), asc(teams.id))
		.all();
	return rows
		.filter((r) => r.deletedAt === null || r.role === 'owner')
		.map((r) => ({
			id: r.id,
			name: r.name,
			dance: r.dance as DanceSlug,
			role: r.role as Role,
			people: r.people,
			deletedAt: r.deletedAt
		}));
}

/** A live group by the code a person typed. */
export function teamByCode(db: Db, code: string): Team | null {
	const row = db
		.select()
		.from(teams)
		.where(eq(teams.code, normaliseCode(code)))
		.get();
	return row && row.deletedAt === null && row.purgedAt === null ? row : null;
}

export function joinTeam(
	db: Db,
	userId: string,
	teamId: number,
	now: number
): 'joined' | 'already' {
	const r = db
		.insert(teamMembers)
		.values({ teamId, userId, role: 'member', joinedAt: now })
		.onConflictDoNothing()
		.run();
	return r.changes > 0 ? 'joined' : 'already';
}

function ownerOf(db: Db, teamId: number): string | null {
	return (
		db
			.select({ u: teamMembers.userId })
			.from(teamMembers)
			.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, 'owner')))
			.get()?.u ?? null
	);
}

/** The caller has checked the person is the owner. False when the name is bad or taken. */
export function renameTeam(db: Db, teamId: number, rawName: string): boolean {
	const name = cleanName(rawName);
	const team = getTeam(db, teamId);
	const owner = ownerOf(db, teamId);
	if (!name || !team || !owner || nameTaken(db, owner, team.dance, name, teamId)) return false;
	db.update(teams).set({ name }).where(eq(teams.id, teamId)).run();
	return true;
}

/** A new code for the group; the old one stops working. The caller has checked the owner. */
export function remakeCode(db: Db, teamId: number): string {
	const code = freshCode(db);
	db.update(teams).set({ code }).where(eq(teams.id, teamId)).run();
	return code;
}

function isOwner(db: Db, teamId: number, userId: string): boolean {
	return roleOf(db, userId, teamId) === 'owner';
}

/** Changes a non-owner member between editor and member. The caller has checked the owner. */
export function setRole(
	db: Db,
	teamId: number,
	userId: string,
	role: 'editor' | 'member'
): boolean {
	return (
		db
			.update(teamMembers)
			.set({ role })
			.where(
				and(
					eq(teamMembers.teamId, teamId),
					eq(teamMembers.userId, userId),
					sql`${teamMembers.role} != 'owner'`
				)
			)
			.run().changes > 0
	);
}

/** Removes a member other than the owner. The caller has checked the owner. */
export function removeMember(db: Db, teamId: number, userId: string): boolean {
	return (
		db
			.delete(teamMembers)
			.where(
				and(
					eq(teamMembers.teamId, teamId),
					eq(teamMembers.userId, userId),
					sql`${teamMembers.role} != 'owner'`
				)
			)
			.run().changes > 0
	);
}

export function leaveTeam(db: Db, teamId: number, userId: string): 'left' | 'owner' {
	if (roleOf(db, userId, teamId) === 'owner') return 'owner';
	db.delete(teamMembers)
		.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
		.run();
	return 'left';
}

/** The owner gives the group to a member, and becomes an editor. */
export function handOver(
	db: Db,
	teamId: number,
	fromId: string,
	toId: string
): 'ok' | 'not-member' | 'limit' {
	return db.transaction((tx) => {
		const t = tx as unknown as Db;
		if (!isOwner(t, teamId, fromId)) return 'not-member';
		const to = t
			.select({ role: teamMembers.role })
			.from(teamMembers)
			.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, toId)))
			.get();
		if (!to || toId === fromId) return 'not-member';
		if (teamsMade(t, toId) >= teamLimit(t, toId)) return 'limit';
		t.update(teamMembers)
			.set({ role: 'editor' })
			.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, fromId)))
			.run();
		t.update(teamMembers)
			.set({ role: 'owner' })
			.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, toId)))
			.run();
		return 'ok';
	});
}

export function deleteTeam(db: Db, teamId: number, userId: string, now: number): boolean {
	const team = getTeam(db, teamId);
	if (!team || team.deletedAt !== null || team.purgedAt !== null || !isOwner(db, teamId, userId))
		return false;
	db.update(teams).set({ deletedAt: now, deletedBy: userId }).where(eq(teams.id, teamId)).run();
	return true;
}

/** Brings a deleted group back, only before it is purged. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `now` is part of the agreed signature
export function restoreTeam(db: Db, teamId: number, userId: string, _now: number): boolean {
	const team = getTeam(db, teamId);
	if (!team || team.deletedAt === null || team.purgedAt !== null || !isOwner(db, teamId, userId))
		return false;
	db.update(teams).set({ deletedAt: null, deletedBy: null }).where(eq(teams.id, teamId)).run();
	return true;
}

/** Everyone in the group by full name: owner, editors, then members. */
export function peopleOf(db: Db, teamId: number): Person[] {
	const rank: Record<string, number> = { owner: 0, editor: 1, member: 2 };
	return db
		.select({
			id: users.id,
			email: users.email,
			firstName: users.firstName,
			lastName: users.lastName,
			role: teamMembers.role
		})
		.from(teamMembers)
		.innerJoin(users, eq(users.id, teamMembers.userId))
		.where(eq(teamMembers.teamId, teamId))
		.all()
		.map((p) => ({ id: p.id, name: fullName(p), role: p.role as Role }))
		.sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));
}
