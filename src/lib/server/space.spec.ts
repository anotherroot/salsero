import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { lessons } from './db/schema';
import { actorOf, inSpace, isTeam, ownedBy, ownerValues, spaceOfRow } from './scope';
import { T1_SALSA, T2_SALSA, U1_BACHATA, U1_SALSA, U2_SALSA } from './test-walls';

const row = (userId: string | null, teamId: number | null, dance = 'salsa') => ({
	dance,
	userId,
	teamId
});

describe('ownedBy', () => {
	function seed() {
		const db = openDb(':memory:');
		const add = (title: string, userId: string | null, teamId: number | null, dance = 'salsa') =>
			db.insert(lessons).values({ lessonDay: '2026-11-01', title, userId, teamId, dance }).run();
		add('mine', 'u1', null);
		// A team row that somehow carries u1's id: never in u1's lists.
		add('stray', 'u1', 1);
		add('team', null, 1);
		add('other team', null, 2);
		add('u2', 'u2', null);
		add('bachata', 'u1', null, 'bachata');
		const titles = (s: Parameters<typeof ownedBy>[1]) =>
			db
				.select({ title: lessons.title })
				.from(lessons)
				.where(ownedBy(lessons, s))
				.all()
				.map((r) => r.title)
				.sort();
		return titles;
	}

	it('with a wall: the person, the dance, and no team', () => {
		const titles = seed();
		expect(titles(U1_SALSA)).toEqual(['mine']);
		expect(titles(U1_BACHATA)).toEqual(['bachata']);
		expect(titles(U2_SALSA)).toEqual(['u2']);
	});

	it('with a team: that team, whoever is acting', () => {
		const titles = seed();
		expect(titles(T1_SALSA).sort()).toEqual(['stray', 'team']);
		expect(titles(T2_SALSA)).toEqual(['other team']);
		expect(titles({ ...T1_SALSA, dance: 'bachata' })).toEqual([]);
	});
});

describe('inSpace', () => {
	it('is false across person and team', () => {
		expect(inSpace(row(null, 1), U1_SALSA)).toBe(false);
		expect(inSpace(row('u1', null), T1_SALSA)).toBe(false);
		expect(inSpace(row('u1', 1), U1_SALSA)).toBe(false);
	});

	it('matches its own person, team and dance only', () => {
		expect(inSpace(row('u1', null), U1_SALSA)).toBe(true);
		expect(inSpace(row('u1', null), U2_SALSA)).toBe(false);
		expect(inSpace(row('u1', null, 'bachata'), U1_SALSA)).toBe(false);
		expect(inSpace(row(null, 1), T1_SALSA)).toBe(true);
		expect(inSpace(row(null, 1), T2_SALSA)).toBe(false);
	});
});

describe('spaceOfRow', () => {
	it("is the row's person, or its team with the actor", () => {
		expect(spaceOfRow(row('u2', null), 'u1')).toEqual(U2_SALSA);
		expect(spaceOfRow(row(null, 1), 'u1')).toEqual(T1_SALSA);
	});

	it('throws when both owners are set', () => {
		expect(() => spaceOfRow(row('u1', 1), 'u1')).toThrow('row has no owner');
	});

	it("gives a row with neither owner a wall no request has (userId '')", () => {
		const s = spaceOfRow(row(null, null), 'u1');
		expect(s).toEqual({ dance: 'salsa', userId: '' });
		expect(inSpace(row(null, null), U1_SALSA)).toBe(false);
	});
});

describe('ownerValues and actorOf', () => {
	it('sets exactly one owner', () => {
		expect(ownerValues(U1_SALSA)).toEqual({ dance: 'salsa', userId: 'u1', teamId: null });
		expect(ownerValues(T1_SALSA)).toEqual({ dance: 'salsa', userId: null, teamId: 1 });
	});

	it('names who acts', () => {
		expect(actorOf(U2_SALSA)).toBe('u2');
		expect(actorOf(T2_SALSA)).toBe('u1');
		expect(isTeam(T1_SALSA)).toBe(true);
		expect(isTeam(U1_SALSA)).toBe(false);
	});
});
