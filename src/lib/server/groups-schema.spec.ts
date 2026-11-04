import { readdirSync, readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import {
	exercises,
	figureGroups,
	figures,
	lessons,
	songs,
	teamMembers,
	teams,
	users
} from './db/schema';
import { ownerIntegrity } from './integrity';

function setup() {
	const db = openDb(':memory:');
	for (const id of ['u1', 'u2']) {
		db.insert(users)
			.values({ id, email: `${id}@x.test`, passwordHash: 'x' })
			.run();
	}
	return db;
}

const team = (db: ReturnType<typeof setup>, code: string, dance = 'salsa') =>
	db.insert(teams).values({ dance, name: code, code, createdBy: 'u1' }).returning().get();

describe('groups schema', () => {
	it('allows one entry per person per lesson', () => {
		const db = setup();
		const l = db
			.insert(lessons)
			.values({ lessonDay: '2026-11-01', title: 'L', userId: 'u1' })
			.returning()
			.get();
		const entry = (userId: string) => () =>
			db.insert(exercises).values({ name: 'r', source: 'lesson', lessonId: l.id, userId }).run();
		entry('u1')();
		expect(entry('u1')).toThrow();
		expect(entry('u2')).not.toThrow();
	});

	it('allows one owner row per team', () => {
		const db = setup();
		const t = team(db, 'AAA');
		const join = (userId: string, role: string) => () =>
			db.insert(teamMembers).values({ teamId: t.id, userId, role, joinedAt: 1 }).run();
		join('u1', 'owner')();
		expect(join('u2', 'owner')).toThrow();
		expect(join('u2', 'editor')).not.toThrow();
	});

	it('refuses a role outside owner, editor, member', () => {
		const db = setup();
		const t = team(db, 'BBB');
		expect(() =>
			db
				.insert(teamMembers)
				.values({ teamId: t.id, userId: 'u1', role: 'admin', joinedAt: 1 })
				.run()
		).toThrow();
	});
});

describe('ownerIntegrity', () => {
	it('is empty for a whole database', () => {
		const db = setup();
		db.insert(lessons).values({ lessonDay: '2026-11-01', title: 'L', userId: 'u1' }).run();
		expect(ownerIntegrity(db)).toEqual([]);
	});

	it('reports a lesson with both owners', () => {
		const db = setup();
		const t = team(db, 'CCC');
		const l = db
			.insert(lessons)
			.values({ lessonDay: '2026-11-01', title: 'L', userId: 'u1', teamId: t.id })
			.returning()
			.get();
		expect(ownerIntegrity(db).join('\n')).toContain(`lessons ${l.id}`);
	});

	it('reports a song with both owners, and one with neither', () => {
		const db = setup();
		const t = team(db, 'SSS');
		const both = db
			.insert(songs)
			.values({ status: 'ready', sourceUrl: 'https://youtu.be/x', userId: 'u1', teamId: t.id })
			.returning()
			.get();
		const neither = db
			.insert(songs)
			.values({ status: 'ready', sourceUrl: 'https://youtu.be/y' })
			.returning()
			.get();
		db.insert(songs)
			.values({ status: 'ready', sourceUrl: 'https://youtu.be/z', teamId: t.id })
			.run();
		const lines = ownerIntegrity(db);
		expect(lines).toEqual([
			`songs ${both.id}: needs exactly one of user_id and team_id`,
			`songs ${neither.id}: needs exactly one of user_id and team_id`
		]);
	});

	it('reports a group figure whose figure group belongs to another team', () => {
		const db = setup();
		const a = team(db, 'DDD');
		const b = team(db, 'EEE');
		const g = db
			.insert(figureGroups)
			.values({ dance: 'salsa', name: 'G', teamId: a.id })
			.returning()
			.get();
		const f = db
			.insert(figures)
			.values({ name: 'F', teamId: b.id, groupId: g.id } as never)
			.returning()
			.get();
		expect(ownerIntegrity(db).join('\n')).toContain(`figures ${f.id}`);
	});

	it('reports a row whose dance differs from its team', () => {
		const db = setup();
		const t = team(db, 'FFF', 'bachata');
		const g = db
			.insert(figureGroups)
			.values({ dance: 'salsa', name: 'G', teamId: t.id })
			.returning()
			.get();
		expect(ownerIntegrity(db).join('\n')).toContain(`figure_groups ${g.id}`);
	});
});

describe('migrations from empty', () => {
	it('leave no __new_ table and never recreate exercises or figures', () => {
		const db = setup();
		const rows = db.all<{ name: string; sql: string }>(
			sql`select name, sql from sqlite_master where type = 'table'`
		);
		expect(rows.filter((r) => r.name.startsWith('__new_'))).toEqual([]);
		const sqlOf = (n: string) => rows.find((r) => r.name === n)?.sql ?? '';
		expect(sqlOf('exercises')).toContain('exercises_source_ck');
		expect(sqlOf('figures')).toContain('figures_style_ck');
		// The groups migration only adds: no table is rebuilt (a rebuild is DROP TABLE + RENAME).
		const file = readdirSync('drizzle').find((f) => f.startsWith('0021_') && f.endsWith('.sql'));
		const text = readFileSync(`drizzle/${file}`, 'utf8');
		expect(text).not.toMatch(/DROP TABLE|RENAME TO|__new_/);
	});
});
