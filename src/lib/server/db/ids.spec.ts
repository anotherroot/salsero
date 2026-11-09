import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type Database from 'better-sqlite3';
import { openDb, type Db } from './index';
import { MAX_SLOT, SLOT_SIZE, mintId, setIdSlot, slotOf } from './ids';
import { sets } from './schema';
import { createCustomExercise, deleteSet, logSet } from '../exercises';
import { requireExerciseAccess } from '../scope';
import { U1_SALSA } from '../test-walls';
import { readdirSync, readFileSync } from 'node:fs';
import { getTableConfig, SQLiteSyncDialect, SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';
import { findInServer } from '../server-sources';

/** The integer-id tables: each has an `AFTER INSERT` trigger that keeps `id_marks`. */
const ID_TABLES = [
	'song_imports',
	'today_picks',
	'device_tokens',
	'login_attempts',
	'figure_groups',
	'figures',
	'recordings',
	'positions',
	'spot_position_links',
	'routines',
	'routine_steps',
	'songs',
	'exercises',
	'sets',
	'lessons',
	'lesson_videos',
	'video_spots',
	'spot_links',
	'links',
	'song_links',
	'video_downloads',
	'count_takes',
	'storage_requests',
	'teams',
	'lesson_comments',
	'team_changes',
	'team_trash',
	'oauth_clients',
	'oauth_grants',
	'ai_groups',
	'ai_actions',
	'ai_lines',
	'ai_timelines'
] as const;

const raw = (d: Db) => (d as unknown as { $client: Database.Database }).$client;

afterEach(() => setIdSlot(0));

describe('the id block', () => {
	it('reads the slot from an id', () => {
		expect(slotOf(3 * 2 ** 32 + 7)).toBe(3);
		expect(slotOf(7)).toBe(0);
	});

	it('takes only whole slots from 0 to MAX_SLOT', () => {
		expect(() => setIdSlot(-1)).toThrow(RangeError);
		expect(() => setIdSlot(1.5)).toThrow(RangeError);
		expect(() => setIdSlot(2 ** 21)).toThrow(RangeError);
		expect(() => setIdSlot(MAX_SLOT)).not.toThrow();
	});

	it('has a mark trigger on every id table', () => {
		const db = openDb(':memory:');
		const names = raw(db)
			.prepare(`select name from sqlite_master where type = 'trigger' and name like '%_id_mark'`)
			.all()
			.map((r) => (r as { name: string }).name)
			.sort();
		expect(names).toEqual(ID_TABLES.map((t) => `${t}_id_mark`).sort());
	});

	it('marks the highest id per table and slot, and mints after it', () => {
		const db = openDb(':memory:');
		const insert = raw(db).prepare(
			`insert into songs (id, status, source_url, created_at) values (?, 'ready', 'u', 0)`
		);
		insert.run(1);
		insert.run(2);
		insert.run(3 * SLOT_SIZE + 5);
		const marks = raw(db)
			.prepare(`select tbl, slot, hi from id_marks where tbl = 'songs' order by slot`)
			.all();
		expect(marks).toEqual([
			{ tbl: 'songs', slot: 0, hi: 2 },
			{ tbl: 'songs', slot: 3, hi: 3 * SLOT_SIZE + 5 }
		]);

		const mint = () =>
			db.get<{ id: number }>(
				sql`insert into songs (id, status, source_url, created_at) values (${mintId('songs')}, 'ready', 'u', 0) returning id`
			).id;
		expect(mint()).toBe(3);
		setIdSlot(3);
		expect(mint()).toBe(3 * SLOT_SIZE + 6);
	});
});

const drill = (db: Db, name = 'x') =>
	createCustomExercise(db, U1_SALSA, { name, everyDays: 1, notes: null });
const set = (exerciseId: number, doneAt = 1000) => ({
	exerciseId,
	doneAt,
	durationS: null,
	reps: null,
	rating: 3,
	note: null,
	playerJson: null
});
const U1 = { id: 'u1', email: 'u1@example.com', timezone: 'UTC', dance: 'salsa', isAdmin: false };

describe('every id column mints its id', () => {
	it('mints 1, 2 in a fresh database, through the data functions', () => {
		const db = openDb(':memory:');
		expect([drill(db, 'a').id, drill(db, 'b').id]).toEqual([1, 2]);
	});

	it('never reuses a deleted id', () => {
		const db = openDb(':memory:');
		const ex = drill(db);
		const ids = [1, 2, 3].map((i) => logSet(db, set(ex.id, i)).id);
		expect(ids).toEqual([1, 2, 3]);
		expect(deleteSet(db, 3)).toBe(true);
		expect(logSet(db, set(ex.id, 4)).id).toBe(4);
	});

	it("keeps minting in slot 0 after a device's row arrives", () => {
		const db = openDb(':memory:');
		const ex = drill(db);
		const first = logSet(db, set(ex.id)).id;
		db.insert(sets)
			.values({ ...set(ex.id), id: 7 * SLOT_SIZE + 1 })
			.run();
		expect(logSet(db, set(ex.id)).id).toBe(first + 1);
	});

	it('mints in the slot it is given, and finds the row by its id', () => {
		const db = openDb(':memory:');
		setIdSlot(5);
		const ex = drill(db);
		expect(ex.id).toBe(5 * SLOT_SIZE + 1);
		const found = requireExerciseAccess(
			db,
			{ user: U1 } as unknown as App.Locals,
			{ dance: 'salsa' },
			String(ex.id),
			'read'
		);
		expect(found.exercise.id).toBe(ex.id);
		expect(JSON.parse(JSON.stringify({ id: ex.id })).id).toBe(ex.id);
	});

	it('refuses an insert of several new rows', () => {
		const db = openDb(':memory:');
		const ex = drill(db);
		expect(() =>
			db
				.insert(sets)
				.values([set(ex.id), set(ex.id)])
				.run()
		).toThrow(expect.objectContaining({ code: expect.stringMatching(/^SQLITE_CONSTRAINT/) }));
	});
});

describe('every insert mints its id: the scans', () => {
	const tables = (Object.values(schema) as unknown[]).filter(
		(t): t is SQLiteTable => t instanceof SQLiteTable
	);

	it('gives every integer id column a minted default naming its own table', () => {
		const dialect = new SQLiteSyncDialect();
		const minted: string[] = [];
		for (const table of tables) {
			const config = getTableConfig(table);
			const id = config.columns.find((c) => c.name === 'id');
			if (!id || id.columnType !== 'SQLiteInteger' || !id.primary) continue;
			expect(id.defaultFn, `${config.name}.id has no minted default`).toBeTypeOf('function');
			const query = dialect.sqlToQuery(id.defaultFn!() as ReturnType<typeof mintId>);
			expect(query.params[0], `${config.name}.id mints for another table`).toBe(config.name);
			minted.push(config.name);
		}
		expect(minted.sort()).toEqual([...ID_TABLES].sort());
	});

	it('has no raw SQL insert into an id table', () => {
		const into = new RegExp(
			`insert\\s+(or\\s+\\w+\\s+)?into\\s+["'\`]?(${ID_TABLES.join('|')})\\b`,
			'i'
		);
		expect(findInServer(into)).toEqual([]);
	});

	it('lets no later migration insert into an id table without its id', () => {
		const into = new RegExp(
			`insert\\s+(?:or\\s+\\w+\\s+)?into\\s+["'\`]?(${ID_TABLES.join('|')})["'\`]?\\s*(\\([^)]*\\))?`,
			'gi'
		);
		const bad: string[] = [];
		for (const file of readdirSync('drizzle').filter((f) => /^\d{4}_.*\.sql$/.test(f))) {
			if (Number(file.slice(0, 4)) <= 38) continue;
			for (const m of readFileSync(`drizzle/${file}`, 'utf8').matchAll(into)) {
				const cols = (m[2] ?? '').replace(/[`"'()\s]/g, '').split(',');
				if (!cols.includes('id')) bad.push(`${file}: ${m[0].trim()}`);
			}
		}
		expect(bad).toEqual([]);
	});
});
