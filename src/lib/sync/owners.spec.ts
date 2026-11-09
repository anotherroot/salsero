import { describe, expect, it } from 'vitest';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '$lib/server/db/schema';
import { SYNCED } from './tables';
import { OWNERS, ownerOf } from './owners';

const columns = new Map<string, Set<string>>();
for (const t of Object.values(schema)) {
	if (!(t instanceof SQLiteTable)) continue;
	const c = getTableConfig(t);
	columns.set(c.name, new Set(c.columns.map((col) => col.name)));
}

/** A tiny copy: table → id → row. */
const copy =
	(rows: Record<string, Record<number, Record<string, unknown>>>) => (table: string, id: number) =>
		rows[table]?.[id] ?? null;

describe('owners', () => {
	it('has a rule for every synced table, naming real columns and tables', () => {
		expect(Object.keys(OWNERS).sort()).toEqual(Object.keys(SYNCED).sort());
		for (const [table, rule] of Object.entries(OWNERS)) {
			if (!('via' in rule)) continue;
			for (const { col, table: parent } of rule.via) {
				expect(columns.get(table)?.has(col), `${table}.${col}`).toBe(true);
				expect(columns.has(parent), parent).toBe(true);
			}
		}
	});

	it("reads a set's owner through its drill", () => {
		const get = copy({
			exercises: { 1: { user_id: 'u1', team_id: null }, 2: { user_id: null, team_id: 7 } }
		});
		expect(ownerOf('sets', { exercise_id: 1 }, get)).toBe('person');
		expect(ownerOf('sets', { exercise_id: 2 }, get)).toBe('team');
	});

	it('reads a section through a lesson video or a recording', () => {
		const get = copy({
			lesson_videos: { 5: { lesson_id: 3 } },
			lessons: { 3: { user_id: null, team_id: 2 } },
			recordings: { 6: { figure_id: 4 } },
			figures: { 4: { user_id: 'u1', team_id: null } }
		});
		expect(ownerOf('video_spots', { recording_id: null, lesson_video_id: 5 }, get)).toBe('team');
		expect(ownerOf('video_spots', { recording_id: 6, lesson_video_id: null }, get)).toBe('person');
		expect(
			ownerOf(
				'spot_links',
				{ spot_id: 9 },
				copy({
					video_spots: { 9: { recording_id: 6 } },
					recordings: { 6: { figure_id: 4 } },
					figures: { 4: { user_id: 'u1', team_id: null } }
				})
			)
		).toBe('person');
	});

	it('is unknown when a parent is missing', () => {
		expect(ownerOf('sets', { exercise_id: 99 }, copy({}))).toBe('unknown');
		expect(
			ownerOf('links', { figure_id: null, lesson_id: null, exercise_id: null }, copy({}))
		).toBe('unknown');
	});

	it('reads the rest: a group, a membership, a person row, a clone switch', () => {
		const get = copy({ teams: { 2: {} }, exercises: { 1: { user_id: null, team_id: 2 } } });
		expect(ownerOf('teams', { id: 2 }, get)).toBe('team');
		expect(ownerOf('team_members', { team_id: 2 }, get)).toBe('team');
		expect(ownerOf('today_picks', { user_id: 'u1' }, get)).toBe('person');
		expect(ownerOf('clone_sync', { kind: 'drill', row_id: 1 }, get)).toBe('team');
	});
});
