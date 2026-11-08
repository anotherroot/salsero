import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { openDb } from '../db';
import { changeLog, lessonFigures, sets } from '../db/schema';
import { SYNCED } from '$lib/sync/tables';
import { changedSince, LOG_KEEP_MS, logHead, logOldest, pruneChangeLog } from './log';

const DAY = 24 * 3600_000;

function fresh() {
	const db = openDb(':memory:');
	db.run(sql`PRAGMA foreign_keys = OFF`);
	return db;
}

describe('change log', () => {
	it('has four log triggers on every synced table and none on the others', () => {
		const db = fresh();
		const rows = db.all<{ name: string; tbl_name: string }>(
			sql`SELECT name, tbl_name FROM sqlite_master WHERE type = 'trigger' AND instr(name, '_log_') > 0`
		);
		const by = new Map<string, string[]>();
		for (const r of rows) by.set(r.tbl_name, [...(by.get(r.tbl_name) ?? []), r.name]);
		expect([...by.keys()].sort()).toEqual(Object.keys(SYNCED).sort());
		for (const [t, names] of by) {
			expect(names.sort(), t).toEqual(
				['i', 'k', 'u', 'd']
					.sort()
					.map((s) => `${t}_log_${s}`)
					.sort()
			);
		}
	});

	it('logs an insert, an update and a delete with the key as text', () => {
		const db = fresh();
		db.run(
			sql`INSERT INTO today_picks (id, user_id, exercise_id, day, kind, created_at) VALUES (7, 'u1', 1, '2026-01-01', 'next', 1)`
		);
		db.run(sql`UPDATE today_picks SET day = '2026-01-02' WHERE id = 7`);
		db.run(sql`DELETE FROM today_picks WHERE id = 7`);
		const rows = db.select().from(changeLog).all();
		expect(rows.map((r) => [r.tbl, r.key, r.op])).toEqual([
			['today_picks', '7', 'i'],
			['today_picks', '7', 'u'],
			['today_picks', '7', 'd']
		]);
		expect(rows[0].at).toBeGreaterThan(1_700_000_000_000);
		void sets;
	});

	it('logs a composite key as keyString would write it', () => {
		const db = fresh();
		db.run(sql`INSERT INTO lesson_figures (lesson_id, figure_id, created_at) VALUES (3, 4, 1)`);
		const [row] = db.select().from(changeLog).all();
		expect(row.key).toBe(JSON.stringify([3, 4]));
		void lessonFigures;
	});

	it('logs the old key as a delete when an update changes the key', () => {
		const db = fresh();
		db.run(sql`INSERT INTO lesson_figures (lesson_id, figure_id, created_at) VALUES (3, 4, 1)`);
		db.run(sql`DELETE FROM change_log`);
		db.run(sql`UPDATE lesson_figures SET figure_id = 5 WHERE lesson_id = 3`);
		const rows = db.select().from(changeLog).all();
		expect(rows.map((r) => [r.op, r.key]).sort()).toEqual([
			['d', JSON.stringify([3, 4])],
			['u', JSON.stringify([3, 5])]
		]);
		expect(
			changedSince(db, 0)
				.map((c) => c.key)
				.sort()
		).toEqual([JSON.stringify([3, 4]), JSON.stringify([3, 5])]);
	});

	it('changedSince returns distinct pairs after the cursor', () => {
		const db = fresh();
		db.run(
			sql`INSERT INTO today_picks (id, user_id, exercise_id, day, kind, created_at) VALUES (7, 'u1', 1, '2026-01-01', 'next', 1)`
		);
		db.run(sql`UPDATE today_picks SET day = '2026-01-02' WHERE id = 7`);
		expect(changedSince(db, 0)).toEqual([{ tbl: 'today_picks', key: '7' }]);
		expect(changedSince(db, logHead(db))).toEqual([]);
	});

	it('reads the head from sqlite_sequence, so a prune keeps it', () => {
		const db = fresh();
		expect(logHead(db)).toBe(0);
		expect(logOldest(db)).toBeNull();
		db.run(
			sql`INSERT INTO today_picks (id, user_id, exercise_id, day, kind, created_at) VALUES (7, 'u1', 1, '2026-01-01', 'next', 1)`
		);
		const head = logHead(db);
		expect(head).toBe(1);
		db.run(sql`UPDATE change_log SET at = 0`);
		expect(pruneChangeLog(db, 31 * DAY)).toBe(1);
		expect(logHead(db)).toBe(head);
		expect(logOldest(db)).toBeNull();
	});

	it('prunes rows older than 30 days and keeps newer ones', () => {
		const db = fresh();
		const now = 100 * DAY;
		db.run(
			sql`INSERT INTO change_log (tbl, key, op, at) VALUES ('a', '1', 'i', ${now - LOG_KEEP_MS - 1})`
		);
		db.run(
			sql`INSERT INTO change_log (tbl, key, op, at) VALUES ('a', '2', 'i', ${now - LOG_KEEP_MS})`
		);
		db.run(sql`INSERT INTO change_log (tbl, key, op, at) VALUES ('a', '3', 'i', ${now})`);
		expect(pruneChangeLog(db, now)).toBe(1);
		expect(logOldest(db)).toBe(2);
		expect(logHead(db)).toBe(3);
	});
});
