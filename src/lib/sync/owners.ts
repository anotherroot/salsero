/*
 * Who owns a synced row (offline phase 3): a person or a group. PURE,
 * client-safe. The device asks it of the rows a write captured, to send a
 * group's write to the network while online (the spec: a clash with another
 * editor shows at once, in place); the push asks it to merge a person's own
 * rows per field and to run a group's through the clash check.
 */
import type { CloneKind } from '$lib/types';

export type OwnerRule =
	| { root: true } // carries user_id / team_id
	| { team: true } // teams: the row is the group
	| { person: true } // a person's own bookkeeping
	| { via: { col: string; table: string }[] } // the first non-null column names the parent
	| { cloneSync: true }; // (kind, row_id) names the row

const ROOT = { root: true } as const;
const PERSON = { person: true } as const;
const via = (...pairs: [string, string][]) => ({
	via: pairs.map(([col, table]) => ({ col, table }))
});

export const OWNERS: Readonly<Record<string, OwnerRule>> = {
	figure_groups: ROOT,
	figures: ROOT,
	routines: ROOT,
	exercises: ROOT,
	lessons: ROOT,
	positions: ROOT,
	songs: ROOT,
	teams: { team: true },
	team_members: via(['team_id', 'teams']),
	users: PERSON,
	today_picks: PERSON,
	default_styles: PERSON,
	count_takes: PERSON,
	opens: PERSON,
	twins: PERSON,
	lesson_adds: PERSON,
	clone_sync: { cloneSync: true },
	recordings: via(['figure_id', 'figures']),
	figure_start_positions: via(['figure_id', 'figures']),
	figure_end_positions: via(['figure_id', 'figures']),
	lesson_videos: via(['lesson_id', 'lessons']),
	lesson_figures: via(['lesson_id', 'lessons']),
	lesson_routines: via(['lesson_id', 'lessons']),
	lesson_exercises: via(['lesson_id', 'lessons']),
	lesson_positions: via(['lesson_id', 'lessons']),
	lesson_comments: via(['lesson_id', 'lessons']),
	routine_steps: via(['routine_id', 'routines']),
	routine_step_options: via(['step_id', 'routine_steps']),
	sets: via(['exercise_id', 'exercises']),
	song_drops: via(['exercise_id', 'exercises']),
	video_spots: via(['recording_id', 'recordings'], ['lesson_video_id', 'lesson_videos']),
	spot_links: via(['spot_id', 'video_spots']),
	spot_position_links: via(['spot_id', 'video_spots']),
	links: via(['figure_id', 'figures'], ['lesson_id', 'lessons'], ['exercise_id', 'exercises']),
	song_links: via(
		['lesson_id', 'lessons'],
		['exercise_id', 'exercises'],
		['routine_id', 'routines']
	),
	video_downloads: via(['link_id', 'links'], ['figure_id', 'figures'], ['lesson_id', 'lessons']),
	lesson_comment_hearts: via(['comment_id', 'lesson_comments'])
};

/** `clone_sync.kind` → the table its `row_id` names. */
const CLONE_TABLE: Record<CloneKind, string> = {
	figure: 'figures',
	routine: 'routines',
	drill: 'exercises',
	song: 'songs',
	lesson: 'lessons',
	position: 'positions'
};

export type Owner = 'person' | 'team' | 'unknown';

/** `get(table, id)`: a parent row by id, null when the copy or db lacks it. */
export function ownerOf(
	table: string,
	row: Record<string, unknown>,
	get: (table: string, id: number) => Record<string, unknown> | null,
	depth = 0
): Owner {
	const rule = OWNERS[table];
	if (!rule || depth > 8) return 'unknown';
	if ('root' in rule) return row.team_id === null || row.team_id === undefined ? 'person' : 'team';
	if ('team' in rule) return 'team';
	if ('person' in rule) return 'person';
	if ('cloneSync' in rule) {
		const parent = CLONE_TABLE[row.kind as CloneKind];
		const id = row.row_id;
		if (!parent || typeof id !== 'number') return 'unknown';
		const found = get(parent, id);
		return found ? ownerOf(parent, found, get, depth + 1) : 'unknown';
	}
	for (const { col, table: parent } of rule.via) {
		const id = row[col];
		if (id === null || id === undefined) continue;
		if (typeof id !== 'number') return 'unknown';
		// A team's own rows (team_members) name the group itself.
		if (parent === 'teams') return get(parent, id) ? 'team' : 'unknown';
		const found = get(parent, id);
		return found ? ownerOf(parent, found, get, depth + 1) : 'unknown';
	}
	return 'unknown';
}
