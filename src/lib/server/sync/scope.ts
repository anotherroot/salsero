/**
 * What one person's device may hold (offline phase 2): every row of every
 * synced table that they may read, already redacted. Nothing outside this
 * leaves the server: the pull sends, logs and digests only these rows.
 *
 * Built set by set from the roots. A root row (a move, a figure, a routine, an
 * exercise, a lesson, a position) is the person's own, or a group's they read
 * as `access.ts` decides: all of it for its editors and owner until the purge,
 * what `reach` holds for a plain member. Songs are `songAccess`'s. Every other
 * row follows its parent. `access.ts` is the oracle, and `scope.spec.ts`
 * checks this against it row by row; nothing here decides access on its own.
 *
 * Reads are raw SELECTs (`db.all`), so a row comes back with
 * its column names as stored (`select *`), the shape the device writes.
 */
import { sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db';
import { reach, songAccess, type Reach } from '../access';
import { SYNCED } from '$lib/sync/tables';
import { keyString } from '$lib/sync/digest';

/** One row: raw column name → value, as `select *` returns it. */
export type Row = Record<string, unknown>;
/** Table → key string (`keyString` over its `SYNCED` key columns) → row, redacted. */
export type Scope = Map<string, Map<string, Row>>;

/** How a person reads one group: everything (its editors and owner) or what they reach. */
type Reading = { all: true } | { all: false; reach: Reach };

/** The root tables, and which of `Reach`'s sets holds a plain member's rows of each. */
const ROOTS = {
	figure_groups: 'figures',
	figures: 'variations',
	routines: 'routines',
	exercises: 'drills',
	lessons: 'lessons',
	positions: 'positions'
} as const satisfies Record<string, keyof Reach>;

/** The tables that hold only the person's own rows, by `user_id`. */
const PERSONAL = ['today_picks', 'default_styles', 'count_takes', 'opens', 'twins', 'lesson_adds'];

/** `clone_sync.kind` → the table its `row_id` names (`CloneKind`). */
const CLONE_TABLE = {
	figure: 'figures',
	routine: 'routines',
	drill: 'exercises',
	song: 'songs',
	lesson: 'lessons',
	position: 'positions'
} as const;

/**
 * Another person as a device sees them: their name and little else. The
 * email is made up but unique per dance, so the device's unique index holds;
 * the NOT NULL columns get harmless values; everything else is NULL.
 */
function redactUser(row: Row, me: string): Row {
	if (row.id === me) return { ...row, password_hash: '' };
	const out: Row = Object.fromEntries(Object.keys(row).map((k) => [k, null]));
	return {
		...out,
		id: row.id,
		dance: row.dance,
		first_name: row.first_name,
		last_name: row.last_name,
		created_at: row.created_at,
		email: `${row.id}@hidden.invalid`,
		password_hash: '',
		timezone: 'UTC',
		video_short_side: 480,
		is_admin: 0
	};
}

/**
 * A lesson's comments as `listComments` lists them: the live ones, and a
 * deleted top comment only while a live reply keeps it, with nothing of its
 * words or who wrote or deleted it. A deleted reply, or a deleted top comment
 * with no live reply, is not listed to anyone (it is kept only for Undo).
 */
function listedComments(rows: Row[]): Row[] {
	const answered = new Set(
		rows.filter((c) => c.deleted_at === null && c.thread_id !== null).map((c) => c.thread_id)
	);
	return rows
		.filter((c) => c.deleted_at === null || (c.thread_id === null && answered.has(c.id)))
		.map((c) => (c.deleted_at === null ? c : { ...c, body: '', author_id: '', deleted_by: null }));
}

/** A group's join code is for those who may hand it out: its owner and editors while it lives. */
function teamFor(row: Row, role: unknown): Row {
	const handsOut = (role === 'owner' || role === 'editor') && row.deleted_at === null;
	return handsOut ? row : { ...row, code: `hidden-${row.id}` };
}

export function syncScope(db: Db, userId: string): Scope {
	/** Every row of `table` matching `where`, as stored: raw column names. */
	const select = (table: string, where: SQL): Row[] =>
		db.all<Row>(sql`SELECT * FROM ${sql.identifier(table)} WHERE ${where}`);
	/** The rows of `table` whose `column` is one of `values`. */
	const whereIn = (table: string, column: string, values: Iterable<unknown>): Row[] => {
		const list = [...new Set(values)].filter((v) => v !== null && v !== undefined);
		if (list.length === 0) return [];
		return select(
			table,
			sql`${sql.identifier(column)} IN (SELECT value FROM json_each(${JSON.stringify(list)}))`
		);
	};

	const scope: Scope = new Map(Object.keys(SYNCED).map((t) => [t, new Map<string, Row>()]));
	const put = (table: string, rows: Row[], redact: (r: Row) => Row = (r) => r) => {
		const into = scope.get(table)!;
		const key = SYNCED[table];
		for (const row of rows) into.set(keyString(key.map((c) => row[c])), redact(row));
	};
	const rowsOf = (table: string) => [...scope.get(table)!.values()];
	const idsOf = (table: string) => rowsOf(table).map((r) => r.id);
	const holds = (table: string, id: unknown) =>
		id !== null && id !== undefined && scope.get(table)!.has(String(id));

	// Groups: the ones the person holds a membership in, until the purge. Anyone
	// else reads nothing of a group (`byOwner`, `lessonsReached`, `addedLessonIds`).
	const memberships = select('team_members', sql`user_id = ${userId}`);
	const roleIn = new Map(memberships.map((m) => [m.team_id, m.role]));
	put(
		'teams',
		whereIn('teams', 'id', roleIn.keys()).filter((t) => t.purged_at === null),
		(t) => teamFor(t, roleIn.get(t.id))
	);
	const reading = new Map<number, Reading>();
	for (const m of memberships) {
		const teamId = m.team_id as number;
		if (!holds('teams', teamId)) continue;
		reading.set(
			teamId,
			m.role === 'editor' || m.role === 'owner'
				? { all: true }
				: { all: false, reach: reach(db, userId, teamId) }
		);
	}
	const reads = (teamId: unknown, set: keyof Reach, id: unknown): boolean => {
		const r = reading.get(teamId as number);
		return !!r && (r.all || r.reach[set].has(id as number));
	};
	put('team_members', whereIn('team_members', 'team_id', reading.keys()));

	for (const [table, set] of Object.entries(ROOTS)) {
		put(table, select(table, sql`user_id = ${userId} AND team_id IS NULL`));
		put(
			table,
			whereIn(table, 'team_id', reading.keys()).filter(
				(r) => r.user_id === null && reads(r.team_id, set, r.id)
			)
		);
	}
	put(
		'songs',
		[
			...select('songs', sql`user_id = ${userId}`),
			...whereIn('songs', 'team_id', reading.keys())
		].filter(
			(s) =>
				songAccess(db, userId, {
					userId: s.user_id as string | null,
					teamId: s.team_id as number | null,
					sharedAt: s.shared_at as number | null,
					archivedAt: s.archived_at as number | null
				}) !== null
		)
	);

	// A figure's children. A plain member's recordings are the reach's
	// (`recordingAccess`), which holds every recording of a reached figure.
	const figureIds = idsOf('figures');
	const figureTeam = new Map(rowsOf('figures').map((f) => [f.id, f.team_id]));
	put(
		'recordings',
		whereIn('recordings', 'figure_id', figureIds).filter((r) => {
			const teamId = figureTeam.get(r.figure_id);
			return teamId === null || reads(teamId, 'recordings', r.id);
		})
	);
	put('figure_start_positions', whereIn('figure_start_positions', 'figure_id', figureIds));
	put('figure_end_positions', whereIn('figure_end_positions', 'figure_id', figureIds));

	// A lesson's children.
	const lessonIds = idsOf('lessons');
	for (const table of [
		'lesson_videos',
		'lesson_figures',
		'lesson_routines',
		'lesson_exercises',
		'lesson_positions'
	]) {
		put(table, whereIn(table, 'lesson_id', lessonIds));
	}
	put('lesson_comments', listedComments(whereIn('lesson_comments', 'lesson_id', lessonIds)));
	put(
		'lesson_comment_hearts',
		whereIn('lesson_comment_hearts', 'comment_id', idsOf('lesson_comments'))
	);

	// A routine's children.
	put('routine_steps', whereIn('routine_steps', 'routine_id', idsOf('routines')));
	put('routine_step_options', whereIn('routine_step_options', 'step_id', idsOf('routine_steps')));

	// Spots, on a recording or a lesson video, and what links them.
	put('video_spots', whereIn('video_spots', 'recording_id', idsOf('recordings')));
	put('video_spots', whereIn('video_spots', 'lesson_video_id', idsOf('lesson_videos')));
	const spotIds = idsOf('video_spots');
	put('spot_links', whereIn('spot_links', 'spot_id', spotIds));
	put('spot_position_links', whereIn('spot_position_links', 'spot_id', spotIds));

	// An exercise's children.
	const exerciseIds = idsOf('exercises');
	put('sets', whereIn('sets', 'exercise_id', exerciseIds));
	put('song_drops', whereIn('song_drops', 'exercise_id', exerciseIds));

	// Rows on whichever parent they name.
	put('links', whereIn('links', 'lesson_id', lessonIds));
	put('links', whereIn('links', 'figure_id', figureIds));
	put('links', whereIn('links', 'exercise_id', exerciseIds));
	put('video_downloads', whereIn('video_downloads', 'lesson_id', lessonIds));
	put('video_downloads', whereIn('video_downloads', 'figure_id', figureIds));
	// Music lists only a song its viewer may play (`listMusic`): the song too.
	const playable = (r: Row) => holds('songs', r.song_id);
	put('song_links', whereIn('song_links', 'lesson_id', lessonIds).filter(playable));
	put('song_links', whereIn('song_links', 'exercise_id', exerciseIds).filter(playable));
	put('song_links', whereIn('song_links', 'routine_id', idsOf('routines')).filter(playable));

	for (const [kind, table] of Object.entries(CLONE_TABLE)) {
		put(
			'clone_sync',
			select('clone_sync', sql`kind = ${kind}`).filter((r) => holds(table, r.row_id))
		);
	}

	for (const table of PERSONAL) {
		put(table, select(table, sql`user_id = ${userId}`));
	}

	// People: me, everyone in my groups, and whoever wrote a live comment I read.
	const people = new Set<unknown>([userId]);
	for (const m of rowsOf('team_members')) people.add(m.user_id);
	// A kept deleted comment names nobody (its author is blanked, its deleter NULL).
	for (const c of rowsOf('lesson_comments')) if (c.deleted_at === null) people.add(c.author_id);
	put('users', whereIn('users', 'id', people), (r) => redactUser(r, userId));

	return scope;
}
