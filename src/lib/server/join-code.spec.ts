import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb } from './db';
import { teamMembers, teams, users } from './db/schema';
import { createTeam, deleteTeam } from './teams';
import { danceWithClass, joinWithCode } from './join-code';

function setup() {
	const db = openDb(':memory:');
	for (const id of ['teacher', 'ana']) {
		db.insert(users)
			.values({ id, email: `${id}@example.com`, passwordHash: 'x' })
			.run();
	}
	return db;
}
const make = (db: ReturnType<typeof setup>, name: string, dance: 'salsa' | 'bachata' = 'salsa') => {
	const r = createTeam(db, 'teacher', dance, name, 1000);
	if (!r.ok) throw new Error(r.reason);
	return { id: r.teamId, code: db.select().from(teams).where(eq(teams.id, r.teamId)).get()!.code };
};
const members = (db: ReturnType<typeof setup>, teamId: number, userId: string) =>
	db
		.select()
		.from(teamMembers)
		.where(eq(teamMembers.teamId, teamId))
		.all()
		.filter((m) => m.userId === userId).length;

describe('joinWithCode', () => {
	it('joins by the code, whatever its case or separators', () => {
		const db = setup();
		const { id, code } = make(db, 'Tuesdays', 'bachata');
		const typed = `${code.slice(0, 4).toLowerCase()}-${code.slice(4).toLowerCase()}`;
		expect(joinWithCode(db, 'ana', typed, 5)).toEqual({ ok: true, teamId: id, dance: 'bachata' });
		expect(members(db, id, 'ana')).toBe(1);
	});

	it('reads I and L as 1 and O as 0', () => {
		const db = setup();
		const { id } = make(db, 'Tuesdays');
		db.update(teams).set({ code: 'AB10CD1E' }).where(eq(teams.id, id)).run();
		expect(joinWithCode(db, 'ana', 'abioCDlE', 5)).toMatchObject({ ok: true, teamId: id });
	});

	it('an unknown or empty code is unknown', () => {
		const db = setup();
		make(db, 'Tuesdays');
		expect(joinWithCode(db, 'ana', 'ZZZZZZZZ', 5)).toEqual({ ok: false, reason: 'unknown' });
		expect(joinWithCode(db, 'ana', '  - ', 5)).toEqual({ ok: false, reason: 'unknown' });
	});

	it('a deleted group is refused and nobody joins', () => {
		const db = setup();
		const { id, code } = make(db, 'Tuesdays');
		deleteTeam(db, id, 'teacher', 10);
		expect(joinWithCode(db, 'ana', code, 20)).toEqual({ ok: false, reason: 'refused' });
		expect(members(db, id, 'ana')).toBe(0);
	});

	it('joining twice is ok and leaves one membership', () => {
		const db = setup();
		const { id, code } = make(db, 'Tuesdays');
		expect(joinWithCode(db, 'ana', code, 5).ok).toBe(true);
		expect(joinWithCode(db, 'ana', code, 6).ok).toBe(true);
		expect(members(db, id, 'ana')).toBe(1);
	});
});

describe('danceWithClass', () => {
	const all = ['salsa', 'bachata'] as const;
	it('keeps the last dance when it has a class', () => {
		const db = setup();
		const s = make(db, 'S');
		const b = make(db, 'B', 'bachata');
		joinWithCode(db, 'ana', s.code, 5);
		joinWithCode(db, 'ana', b.code, 5);
		expect(danceWithClass(db, 'ana', 'salsa', all)).toBe('salsa');
	});
	it('moves to the dance that has a class when the last has none', () => {
		const db = setup();
		const b = make(db, 'B', 'bachata');
		joinWithCode(db, 'ana', b.code, 5);
		expect(danceWithClass(db, 'ana', 'salsa', all)).toBe('bachata');
	});
	it('keeps the last dance when there is no class anywhere, or only a deleted one', () => {
		const db = setup();
		expect(danceWithClass(db, 'ana', 'salsa', all)).toBe('salsa');
		const b = make(db, 'B', 'bachata');
		joinWithCode(db, 'ana', b.code, 5);
		deleteTeam(db, b.id, 'teacher', 9);
		expect(danceWithClass(db, 'ana', 'salsa', all)).toBe('salsa');
	});
});
