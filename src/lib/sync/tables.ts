/*
 * Which tables the device's copy holds (offline phase 2), and each one's key
 * columns in key order. Standalone: no imports, so scripts/sync-triggers.ts can
 * load it with plain node. tables.spec.ts checks every schema table is here
 * exactly once and that each key is the schema's.
 */
export const SYNCED: Readonly<Record<string, readonly string[]>> = {
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

/** Server bookkeeping and secrets: never leave the server. */
export const NEVER_SYNCED: readonly string[] = [
	'sessions',
	'login_attempts',
	'invites',
	'device_tokens',
	'app_installs',
	'storage_requests',
	'team_trash',
	'team_changes',
	'clone_pairs',
	'app_flags',
	'id_marks',
	'clone_marks',
	'change_log',
	// The home worker's playlist queue (worker state): Music's "To pick" waits for the network.
	'song_imports'
];
