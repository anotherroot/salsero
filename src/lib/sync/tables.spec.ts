import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from '$lib/server/db/schema';
import { NEVER_SYNCED, SYNCED } from './tables';
import { triggersFile } from './triggers';

/**
 * The synced tables as migration 0041 wrote their triggers. Frozen: production
 * has applied 0041 and never runs it again, so a table synced later gets its
 * triggers in a NEW custom migration (`scripts/sync-triggers.ts <table>`), and
 * log.spec.ts fails until one does. Never edit this list or 0041.
 */
const SYNCED_AT_0041: Readonly<Record<string, readonly string[]>> = {
	users: ['id'],
	today_picks: ['id'],
	default_styles: ['user_id', 'dance'],
	figure_groups: ['id'],
	figures: ['id'],
	recordings: ['id'],
	positions: ['id'],
	figure_start_positions: ['figure_id', 'position_id'],
	figure_end_positions: ['figure_id', 'position_id'],
	spot_position_links: ['id'],
	lesson_positions: ['lesson_id', 'position_id'],
	routines: ['id'],
	routine_steps: ['id'],
	routine_step_options: ['step_id', 'figure_id'],
	songs: ['id'],
	song_drops: ['exercise_id', 'song_id'],
	exercises: ['id'],
	sets: ['id'],
	lessons: ['id'],
	lesson_videos: ['id'],
	video_spots: ['id'],
	spot_links: ['id'],
	lesson_figures: ['lesson_id', 'figure_id'],
	lesson_routines: ['lesson_id', 'routine_id'],
	lesson_exercises: ['lesson_id', 'exercise_id'],
	links: ['id'],
	song_links: ['id'],
	video_downloads: ['id'],
	count_takes: ['id'],
	teams: ['id'],
	team_members: ['team_id', 'user_id'],
	lesson_adds: ['user_id', 'lesson_id'],
	lesson_comments: ['id'],
	lesson_comment_hearts: ['comment_id', 'user_id'],
	opens: ['user_id', 'kind', 'item_id'],
	clone_sync: ['kind', 'row_id'],
	twins: ['user_id', 'kind', 'item_id']
};

const tables = Object.values(schema)
	.filter((v: unknown): v is SQLiteTable => v instanceof SQLiteTable)
	.map((t) => getTableConfig(t));

describe('synced tables', () => {
	it('classifies every schema table exactly once', () => {
		const names = tables.map((t) => t.name).sort();
		const synced = Object.keys(SYNCED);
		expect(synced.filter((n) => NEVER_SYNCED.includes(n))).toEqual([]);
		expect([...synced, ...NEVER_SYNCED].sort()).toEqual(names);
	});

	it("gives every synced table its schema's key, in key order", () => {
		for (const t of tables) {
			if (!(t.name in SYNCED)) continue;
			const pk = t.primaryKeys[0]
				? t.primaryKeys[0].columns.map((c) => c.name)
				: t.columns.filter((c) => c.primary).map((c) => c.name);
			expect(SYNCED[t.name], t.name).toEqual(pk);
		}
	});

	it('migration 0041 is the triggers of the tables synced when it was written, never regenerated', () => {
		const file = readFileSync('drizzle/0041_change_log_triggers.sql', 'utf8');
		expect(Object.keys(SYNCED_AT_0041)).toHaveLength(37);
		expect(file).toBe(triggersFile(SYNCED_AT_0041));
	});
});
