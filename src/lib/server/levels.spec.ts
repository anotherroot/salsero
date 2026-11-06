import { readdirSync, readFileSync } from 'node:fs';
import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db';
import { teamMembers, users } from './db/schema';
import { levelOf, setAutoAdd, setLevel } from './levels';
import { createTeam, joinTeam } from './teams';

const NOW = 1_762_300_000_000;

/** The levels migration (0031) split into its statements. */
function migration0031(): string[] {
	const file = readdirSync('drizzle').find((f) => f.startsWith('0031_') && f.endsWith('.sql'));
	if (!file) throw new Error('no 0031 migration');
	return readFileSync(`drizzle/${file}`, 'utf8')
		.split('--> statement-breakpoint')
		.map((s) => s.trim())
		.filter(Boolean);
}

let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	for (const id of ['u1', 'u2', 'u3']) {
		db.insert(users)
			.values({ id, email: `${id}@x.test`, passwordHash: 'x' })
			.run();
	}
});

describe('the levels migration', () => {
	it('existing accounts are Everything', () => {
		// The rows above stand for accounts made before the migration: run its backfill on them.
		const updates = migration0031().filter((s) => s.startsWith('UPDATE'));
		expect(updates).toEqual(["UPDATE `users` SET `level` = 'all';"]);
		for (const s of updates) db.run(sql.raw(s));
		expect(['u1', 'u2', 'u3'].map((u) => levelOf(db, u))).toEqual(['all', 'all', 'all']);
	});

	it('is additive only, and a new account starts with no level', () => {
		for (const s of migration0031()) {
			expect(s, s).toMatch(/^(CREATE TABLE|CREATE INDEX|ALTER TABLE `\w+` ADD|UPDATE)/);
		}
		db.insert(users).values({ id: 'new', email: 'new@x.test', passwordHash: 'x' }).run();
		expect(levelOf(db, 'new')).toBeNull();
	});
});

describe('setLevel', () => {
	it('stores one of the three', () => {
		setLevel(db, 'u1', 'follow');
		expect(levelOf(db, 'u1')).toBe('follow');
		setLevel(db, 'u1', 'own');
		expect(levelOf(db, 'u1')).toBe('own');
		expect(levelOf(db, 'u2')).toBeNull();
	});

	it('refuses anything else', () => {
		setLevel(db, 'u1', 'own');
		for (const bad of ['x', '', null, 'ALL']) {
			expect(() => setLevel(db, 'u1', bad as never)).toThrow();
		}
		expect(levelOf(db, 'u1')).toBe('own');
	});

	it('reads a junk stored value as not chosen', () => {
		db.update(users).set({ level: 'x' }).where(eq(users.id, 'u1')).run();
		expect(levelOf(db, 'u1')).toBeNull();
		expect(levelOf(db, 'nobody')).toBeNull();
	});
});

describe('setAutoAdd', () => {
	const stored = (userId: string, teamId: number) =>
		db
			.select({ v: teamMembers.autoAdd })
			.from(teamMembers)
			.where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
			.get()?.v;

	it('writes the member’s own choice, and starts null', () => {
		const made = createTeam(db, 'u1', 'salsa', 'Tuesdays', NOW);
		if (!made.ok) throw new Error('no team');
		expect(joinTeam(db, 'u2', made.teamId, NOW)).toBe('joined');
		expect(stored('u2', made.teamId)).toBeNull();
		expect(setAutoAdd(db, 'u2', made.teamId, false)).toBe(true);
		expect(stored('u2', made.teamId)).toBe(0);
		expect(setAutoAdd(db, 'u2', made.teamId, true)).toBe(true);
		expect(stored('u2', made.teamId)).toBe(1);
		// The owner is a member too, with their own toggle.
		expect(stored('u1', made.teamId)).toBeNull();
	});

	it('refuses a non-member', () => {
		const made = createTeam(db, 'u1', 'salsa', 'Tuesdays', NOW);
		if (!made.ok) throw new Error('no team');
		expect(setAutoAdd(db, 'u3', made.teamId, true)).toBe(false);
		expect(setAutoAdd(db, 'u3', 999, true)).toBe(false);
		expect(stored('u3', made.teamId)).toBeUndefined();
	});
});
