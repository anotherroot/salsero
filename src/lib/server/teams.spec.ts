import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { teams, users } from './db/schema';
import { eq } from 'drizzle-orm';
import {
	createTeam,
	deleteTeam,
	handOver,
	joinTeam,
	leaveTeam,
	listMyTeams,
	newTeamCode,
	peopleOf,
	remakeCode,
	removeMember,
	renameTeam,
	restoreTeam,
	roleOf,
	setRole,
	teamByCode,
	teamLimit,
	teamsMade,
	getTeam
} from './teams';
import { TEAM_CODE_LENGTH } from '$lib/limits';

function setup() {
	const db = openDb(':memory:');
	for (const [id, first, last] of [
		['u1', 'Ana', 'Kranjc'],
		['u2', 'Bor', null],
		['u3', 'Cene', 'Z']
	] as const)
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: first, lastName: last })
			.run();
	return db;
}
const make = (
	db: ReturnType<typeof setup>,
	u: string,
	name: string,
	dance: 'salsa' | 'bachata' = 'salsa'
) => {
	const r = createTeam(db, u, dance, name, 1000);
	if (!r.ok) throw new Error(r.reason);
	return r.teamId;
};

describe('making', () => {
	it('code is Crockford base32 of the set length', () => {
		expect(newTeamCode()).toMatch(new RegExp(`^[0-9A-HJKMNP-TV-Z]{${TEAM_CODE_LENGTH}}$`));
	});
	it('makes the creator the owner', () => {
		const db = setup();
		const id = make(db, 'u1', 'Class');
		expect(roleOf(db, 'u1', id)).toBe('owner');
		expect(getTeam(db, id)?.createdBy).toBe('u1');
	});
	it('refuses the third, until the limit is raised', () => {
		const db = setup();
		make(db, 'u1', 'A');
		make(db, 'u1', 'B');
		expect(createTeam(db, 'u1', 'salsa', 'C', 1)).toEqual({ ok: false, reason: 'limit' });
		db.update(users).set({ groupLimit: 3 }).where(eq(users.id, 'u1')).run();
		expect(teamLimit(db, 'u1')).toBe(3);
		expect(createTeam(db, 'u1', 'salsa', 'C', 1).ok).toBe(true);
	});
	it('refuses bad and repeated names, folding case and accents, per dance', () => {
		const db = setup();
		make(db, 'u1', 'Nadaljevalna');
		expect(createTeam(db, 'u1', 'salsa', '  nadaljevalna ', 1)).toEqual({
			ok: false,
			reason: 'name'
		});
		expect(createTeam(db, 'u1', 'salsa', '   ', 1)).toEqual({ ok: false, reason: 'name' });
		expect(createTeam(db, 'u1', 'salsa', 'x'.repeat(61), 1)).toEqual({ ok: false, reason: 'name' });
		expect(createTeam(db, 'u1', 'bachata', 'Nadaljevalna', 1).ok).toBe(true);
		expect(createTeam(db, 'u2', 'salsa', 'Nadaljevalna', 1).ok).toBe(true);
	});
	it('a deleted team frees its name but still counts toward the limit', () => {
		const db = setup();
		const a = make(db, 'u1', 'A');
		make(db, 'u1', 'B');
		deleteTeam(db, a, 'u1', 5);
		expect(teamsMade(db, 'u1')).toBe(2);
		expect(createTeam(db, 'u1', 'salsa', 'A', 1)).toEqual({ ok: false, reason: 'limit' });
	});
	it('a purged team does not count', () => {
		const db = setup();
		const a = make(db, 'u1', 'A');
		db.update(teams).set({ deletedAt: 1, purgedAt: 2 }).where(eq(teams.id, a)).run();
		expect(teamsMade(db, 'u1')).toBe(0);
	});
});

describe('codes and joining', () => {
	it('finds a live team by code, in any case and with look-alikes', () => {
		const db = setup();
		const id = make(db, 'u1', 'A');
		const code = getTeam(db, id)!.code;
		expect(teamByCode(db, code.toLowerCase())?.id).toBe(id);
		db.update(teams).set({ code: 'ABC10ZZZZZ' }).where(eq(teams.id, id)).run();
		expect(teamByCode(db, 'abcl0zzzzz')?.id).toBe(id);
		expect(teamByCode(db, 'abcio zzzzy')).toBeNull();
	});
	it('joins once', () => {
		const db = setup();
		const id = make(db, 'u1', 'A');
		expect(joinTeam(db, 'u2', id, 5)).toBe('joined');
		expect(joinTeam(db, 'u2', id, 6)).toBe('already');
		expect(roleOf(db, 'u2', id)).toBe('member');
	});
	it('a remade code kills the old one', () => {
		const db = setup();
		const id = make(db, 'u1', 'A');
		const old = getTeam(db, id)!.code;
		const fresh = remakeCode(db, id);
		expect(teamByCode(db, old)).toBeNull();
		expect(teamByCode(db, fresh)?.id).toBe(id);
	});
	it('a deleted team joins no one', () => {
		const db = setup();
		const id = make(db, 'u1', 'A');
		const code = getTeam(db, id)!.code;
		deleteTeam(db, id, 'u1', 5);
		expect(teamByCode(db, code)).toBeNull();
	});
});

describe('roles', () => {
	it('sets roles, never on the owner, removes members, never the owner', () => {
		const db = setup();
		const id = make(db, 'u1', 'A');
		joinTeam(db, 'u2', id, 5);
		expect(setRole(db, id, 'u2', 'editor')).toBe(true);
		expect(roleOf(db, 'u2', id)).toBe('editor');
		expect(setRole(db, id, 'u1', 'member')).toBe(false);
		expect(removeMember(db, id, 'u1')).toBe(false);
		expect(removeMember(db, id, 'u2')).toBe(true);
		expect(roleOf(db, 'u2', id)).toBeNull();
	});
	it('leaving: members go, the owner cannot', () => {
		const db = setup();
		const id = make(db, 'u1', 'A');
		joinTeam(db, 'u2', id, 5);
		expect(leaveTeam(db, id, 'u1')).toBe('owner');
		expect(leaveTeam(db, id, 'u2')).toBe('left');
		expect(roleOf(db, 'u2', id)).toBeNull();
	});
	it('hands over, the old owner becoming editor', () => {
		const db = setup();
		const id = make(db, 'u1', 'A');
		joinTeam(db, 'u2', id, 5);
		expect(handOver(db, id, 'u1', 'u2')).toBe('ok');
		expect(roleOf(db, 'u1', id)).toBe('editor');
		expect(roleOf(db, 'u2', id)).toBe('owner');
		expect(handOver(db, id, 'u1', 'u3')).toBe('not-member');
	});
	it('hand over to someone at their limit changes nothing', () => {
		const db = setup();
		const id = make(db, 'u1', 'A');
		make(db, 'u2', 'X');
		make(db, 'u2', 'Y');
		joinTeam(db, 'u2', id, 5);
		expect(handOver(db, id, 'u1', 'u2')).toBe('limit');
		expect(roleOf(db, 'u1', id)).toBe('owner');
		expect(roleOf(db, 'u2', id)).toBe('member');
	});
});

describe('deleting', () => {
	it('is seen only by the owner, and restores before purge', () => {
		const db = setup();
		const id = make(db, 'u1', 'A');
		joinTeam(db, 'u2', id, 5);
		expect(deleteTeam(db, id, 'u2', 9)).toBe(false);
		expect(deleteTeam(db, id, 'u1', 9)).toBe(true);
		expect(deleteTeam(db, id, 'u1', 9)).toBe(false);
		expect(roleOf(db, 'u2', id)).toBeNull();
		expect(roleOf(db, 'u1', id)).toBe('owner');
		expect(listMyTeams(db, 'u2', 'salsa')).toEqual([]);
		expect(listMyTeams(db, 'u1', 'salsa')[0]).toMatchObject({ deletedAt: 9, people: 2 });
		expect(getTeam(db, id)?.deletedBy).toBe('u1');
		expect(restoreTeam(db, id, 'u1', 10)).toBe('restored');
		expect(roleOf(db, 'u2', id)).toBe('member');
		deleteTeam(db, id, 'u1', 11);
		db.update(teams).set({ purgedAt: 12 }).where(eq(teams.id, id)).run();
		expect(restoreTeam(db, id, 'u1', 13)).toBe('refused');
		expect(listMyTeams(db, 'u1', 'salsa')).toEqual([]);
	});
});

describe('guards on team state', () => {
	it('restore refuses a name that is live again', () => {
		const db = setup();
		const a = make(db, 'u1', 'A');
		deleteTeam(db, a, 'u1', 5);
		make(db, 'u1', 'a');
		expect(restoreTeam(db, a, 'u1', 6)).toBe('name');
		expect(getTeam(db, a)?.deletedAt).toBe(5);
	});
	it('join refuses a deleted team and adds no one', () => {
		const db = setup();
		const a = make(db, 'u1', 'A');
		deleteTeam(db, a, 'u1', 5);
		expect(joinTeam(db, 'u2', a, 6)).toBe('refused');
		expect(peopleOf(db, a)).toHaveLength(1);
	});
	it('hand over on a deleted team changes nothing', () => {
		const db = setup();
		const a = make(db, 'u1', 'A');
		joinTeam(db, 'u2', a, 5);
		deleteTeam(db, a, 'u1', 6);
		expect(handOver(db, a, 'u1', 'u2')).toBe('not-member');
		expect(roleOf(db, 'u1', a)).toBe('owner');
		expect(peopleOf(db, a).map((p) => p.role)).toEqual(['owner', 'member']);
	});
});

describe('lists', () => {
	it('lists by dance and names people owner first', () => {
		const db = setup();
		const id = make(db, 'u1', 'A');
		make(db, 'u1', 'B', 'bachata');
		joinTeam(db, 'u3', id, 5);
		joinTeam(db, 'u2', id, 6);
		setRole(db, id, 'u3', 'editor');
		expect(listMyTeams(db, 'u1', 'salsa').map((t) => t.name)).toEqual(['A']);
		expect(peopleOf(db, id).map((p) => [p.name, p.role])).toEqual([
			['Ana Kranjc', 'owner'],
			['Cene Z', 'editor'],
			['Bor', 'member']
		]);
	});
	it('renames within the uniqueness rule', () => {
		const db = setup();
		const a = make(db, 'u1', 'A');
		make(db, 'u1', 'B');
		expect(renameTeam(db, a, 'b')).toBe(false);
		expect(renameTeam(db, a, 'A2')).toBe(true);
		expect(getTeam(db, a)?.name).toBe('A2');
	});
});
