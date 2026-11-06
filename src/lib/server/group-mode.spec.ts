import { describe, expect, it } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { openDb } from './db';
import { users } from './db/schema';
import { createTeam, deleteTeam, joinTeam } from './teams';
import { setRole } from './membership';
import { groupChoices, groupModeOf, spaceOf } from './group-mode';
import { setLevel } from './levels';
import { U2_SALSA } from './test-walls';

function setup() {
	const db = openDb(':memory:');
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Tuesdays', 1); // 1
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	setRole(db, 1, 'u2', 'editor');
	return db;
}
function jar(value?: string) {
	const calls = { deleted: 0 };
	const cookies = {
		get: () => value,
		set: () => {},
		delete: () => {
			calls.deleted++;
		}
	} as unknown as Cookies;
	return { cookies, calls };
}

describe('groupModeOf', () => {
	it('accepts an owner and an editor', () => {
		const db = setup();
		const a = jar('1');
		expect(groupModeOf(db, 'u1', 'salsa', a.cookies)).toEqual({
			teamId: 1,
			name: 'Tuesdays',
			role: 'owner'
		});
		expect(a.calls.deleted).toBe(0);
		expect(groupModeOf(db, 'u2', 'salsa', jar('1').cookies)?.role).toBe('editor');
	});
	it('refuses a member', () => {
		const db = setup();
		const j = jar('1');
		expect(groupModeOf(db, 'u3', 'salsa', j.cookies)).toBeNull();
		expect(j.calls.deleted).toBe(1);
	});
	it('refuses a deleted group, even for its owner', () => {
		const db = setup();
		deleteTeam(db, 1, 'u1', 5);
		for (const u of ['u1', 'u2']) {
			const j = jar('1');
			expect(groupModeOf(db, u, 'salsa', j.cookies)).toBeNull();
			expect(j.calls.deleted).toBe(1);
		}
	});
	it('is Everything’s only: a lower level drops the cookie', () => {
		const db = setup();
		for (const level of ['follow', 'own'] as const) {
			setLevel(db, 'u1', level);
			const j = jar('1');
			expect(groupModeOf(db, 'u1', 'salsa', j.cookies), level).toBeNull();
			expect(j.calls.deleted).toBe(1);
		}
		setLevel(db, 'u1', 'all');
		expect(groupModeOf(db, 'u1', 'salsa', jar('1').cookies)?.role).toBe('owner');
	});
	it('takes the level from the caller when it has it (locals), over the stored one', () => {
		const db = setup();
		setLevel(db, 'u1', 'all');
		const j = jar('1');
		expect(groupModeOf(db, 'u1', 'salsa', j.cookies, 'own')).toBeNull();
		expect(j.calls.deleted).toBe(1);
		setLevel(db, 'u1', 'follow');
		expect(groupModeOf(db, 'u1', 'salsa', jar('1').cookies, 'all')?.role).toBe('owner');
	});
	it('refuses another dance', () => {
		const db = setup();
		createTeam(db, 'u1', 'bachata', 'Bach', 1); // 2
		const j = jar('2');
		expect(groupModeOf(db, 'u1', 'salsa', j.cookies)).toBeNull();
		expect(j.calls.deleted).toBe(1);
	});
	it('refuses junk and missing ids', () => {
		const db = setup();
		for (const v of ['abc', '0', '99', '1.5', '']) {
			const j = jar(v);
			expect(groupModeOf(db, 'u1', 'salsa', j.cookies)).toBeNull();
			expect(j.calls.deleted).toBe(1);
		}
		const none = jar();
		expect(groupModeOf(db, 'u1', 'salsa', none.cookies)).toBeNull();
		expect(none.calls.deleted).toBe(0);
	});
	it('refuses an editor demoted after the cookie was set', () => {
		const db = setup();
		setRole(db, 1, 'u2', 'member');
		const j = jar('1');
		expect(groupModeOf(db, 'u2', 'salsa', j.cookies)).toBeNull();
		expect(j.calls.deleted).toBe(1);
	});
});

describe('spaceOf', () => {
	it('is the group for a valid cookie, the wall otherwise', () => {
		const db = setup();
		const locals = { user: { id: 'u2', isAdmin: false, timezone: 'UTC' } } as App.Locals;
		expect(spaceOf(db, { dance: 'salsa' }, locals, jar('1').cookies)).toEqual({
			dance: 'salsa',
			teamId: 1,
			actorId: 'u2'
		});
		expect(spaceOf(db, { dance: 'salsa' }, locals, jar('7').cookies)).toEqual(U2_SALSA);
		expect(spaceOf(db, { dance: 'salsa' }, locals, jar().cookies)).toEqual(U2_SALSA);
	});
});

describe('groupChoices', () => {
	it('lists owner and editor groups of the dance, live only', () => {
		const db = setup();
		createTeam(db, 'u1', 'bachata', 'Bach', 1); // 2
		createTeam(db, 'u1', 'salsa', 'Gone', 1); // 3
		deleteTeam(db, 3, 'u1', 5);
		createTeam(db, 'u3', 'salsa', 'Aaa', 1); // 4
		expect(groupChoices(db, 'u1', 'salsa')).toEqual([
			{ teamId: 1, name: 'Tuesdays', role: 'owner', people: 3 }
		]);
		expect(groupChoices(db, 'u2', 'salsa').map((c) => c.role)).toEqual(['editor']);
		expect(groupChoices(db, 'u3', 'salsa').map((c) => c.name)).toEqual(['Aaa']);
	});
});
