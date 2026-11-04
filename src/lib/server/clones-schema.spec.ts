import { readdirSync, readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openDb } from './db';
import { exercises, figureGroups, figures, users } from './db/schema';

function setup() {
	const db = openDb(':memory:');
	for (const id of ['u1', 'u2']) {
		db.insert(users)
			.values({ id, email: `${id}@x.test`, passwordHash: 'x' })
			.run();
	}
	return db;
}

type Db = ReturnType<typeof setup>;

let n = 0;
function figure(
	db: Db,
	o: { geneId?: string | null; userId?: string | null; teamId?: number | null; archived?: boolean }
) {
	n += 1;
	const g = db
		.insert(figureGroups)
		.values({ dance: 'salsa', name: `G${n}`, userId: o.userId ?? null })
		.returning()
		.get();
	return db
		.insert(figures)
		.values({
			dance: 'salsa',
			name: `F${n}`,
			groupId: g.id,
			userId: o.userId ?? null,
			teamId: o.teamId ?? null,
			geneId: o.geneId ?? null,
			archivedAt: o.archived ? 1 : null
		})
		.returning()
		.get();
}

describe('clones schema', () => {
	it('0027 is additive', () => {
		const file = readdirSync('drizzle').find((f) => f.startsWith('0027_') && f.endsWith('.sql'));
		expect(file).toBeDefined();
		const text = readFileSync(`drizzle/${file}`, 'utf8');
		expect(text).not.toMatch(/DROP TABLE|RENAME TO|__new_/);
		const db = setup();
		const rows = db.all<{ name: string; sql: string }>(
			sql`select name, sql from sqlite_master where type = 'table'`
		);
		const sqlOf = (t: string) => rows.find((r) => r.name === t)?.sql ?? '';
		expect(sqlOf('figures')).toContain('figures_style_ck');
		expect(sqlOf('exercises')).toContain('exercises_source_ck');
		expect(sqlOf('clone_pairs')).toContain('clone_pairs_order_ck');
		expect(sqlOf('twins')).toContain('twins_kind_ck');
	});

	it('one member per place', () => {
		const db = setup();
		figure(db, { geneId: 'g', userId: 'u1' });
		expect(() => figure(db, { geneId: 'g', userId: 'u1' })).toThrow(/UNIQUE/);
		figure(db, { geneId: 'g', userId: 'u2' });
		figure(db, { geneId: 'g', teamId: 1 });
		figure(db, { geneId: 'g', teamId: 2 });
		figure(db, { geneId: null, userId: 'u1' });
		figure(db, { geneId: null, userId: 'u1' });
	});

	it('an archived member still holds its place', () => {
		const db = setup();
		figure(db, { geneId: 'h', userId: 'u1', archived: true });
		expect(() => figure(db, { geneId: 'h', userId: 'u1' })).toThrow(/UNIQUE/);
	});

	it('entries never collide', () => {
		const db = setup();
		const a = figure(db, { userId: 'u1' });
		const b = figure(db, { userId: 'u1' });
		for (const f of [a, b]) {
			db.insert(exercises)
				.values({
					dance: 'salsa',
					name: 'e',
					source: 'figure',
					everyDays: 7,
					figureId: f.id,
					userId: 'u1'
				})
				.run();
		}
		expect(db.select().from(exercises).all()).toHaveLength(2);
	});

	it('clone_pairs keeps a_id below b_id and a known kind', () => {
		const db = setup();
		const ins = (kind: string, a: number, b: number) =>
			db.run(
				sql`insert into clone_pairs (kind, a_id, b_id, base_json, at) values (${kind}, ${a}, ${b}, '{}', 1)`
			);
		ins('figure', 1, 2);
		expect(() => ins('figure', 2, 1)).toThrow();
		expect(() => ins('thing', 1, 3)).toThrow();
	});

	it('twins keeps one row per item and a known kind', () => {
		const db = setup();
		const ins = (kind: string, item: number) =>
			db.run(
				sql`insert into twins (user_id, kind, set_id, item_id, created_at) values ('u1', ${kind}, 's', ${item}, 1)`
			);
		ins('figure', 1);
		expect(() => ins('figure', 1)).toThrow();
		expect(() => ins('drill', 2)).toThrow();
	});
});
