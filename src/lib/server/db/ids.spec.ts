import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type Database from 'better-sqlite3';
import { openDb, type Db } from './index';
import { MAX_SLOT, SLOT_SIZE, mintId, setIdSlot, slotOf } from './ids';

/** The integer-id tables: each has an `AFTER INSERT` trigger that keeps `id_marks`. */
const ID_TABLES = [
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
	'team_trash'
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
