import { sql } from 'drizzle-orm';
import type { Db } from './db';
import { teamReader, type ReadKind } from './access';

/** Root tables owned by exactly one of a person (`user_id`) or a team (`team_id`). */
const ROOTS = [
	'figure_groups',
	'figures',
	'routines',
	'exercises',
	'lessons',
	'songs',
	'positions'
] as const;

/**
 * What is wrong with who owns what, one line each. Empty when whole. Called at
 * boot, which only logs it; it reads and reports, never throws on bad data.
 */
export function ownerIntegrity(db: Db): string[] {
	const lines: string[] = [];
	const all = (q: string) => db.all<Record<string, unknown>>(sql.raw(q));

	for (const t of ROOTS) {
		for (const r of all(
			`select id from ${t} where (user_id is null) = (team_id is null) order by id`
		)) {
			lines.push(`${t} ${r.id}: needs exactly one of user_id and team_id`);
		}
	}
	for (const t of ROOTS) {
		for (const r of all(
			`select r.id, r.dance, tm.dance as team_dance from ${t} r join teams tm on tm.id = r.team_id
			 where r.dance <> tm.dance order by r.id`
		)) {
			lines.push(`${t} ${r.id}: dance ${r.dance} differs from its team's ${r.team_dance}`);
		}
	}
	for (const r of all(
		`select f.id, f.user_id, f.team_id, g.user_id as g_user, g.team_id as g_team
		 from figures f join figure_groups g on g.id = f.group_id
		 where f.user_id is not g.user_id or f.team_id is not g.team_id order by f.id`
	)) {
		lines.push(`figures ${r.id}: owner differs from its figure group's`);
	}
	for (const r of all(
		`select id from exercises where source in ('lesson', 'routine', 'figure', 'added')
		 and user_id is null order by id`
	)) {
		lines.push(`exercises ${r.id}: an entry with no user_id`);
	}
	return lines;
}

/**
 * Rows on the wrong side of the dance split, one line each: a row whose
 * account belongs to another dance (or to none), a membership or a lesson
 * add in another dance's group or lesson, and an account's takes, phones or
 * sessions while it has no dance. Empty when whole. Reads only.
 */
export function danceIntegrity(db: Db): string[] {
	const lines: string[] = [];
	const all = (q: string) => db.all<Record<string, unknown>>(sql.raw(q));
	for (const t of ROOTS) {
		for (const r of all(
			`select r.id, r.dance, u.dance as u_dance from ${t} r join users u on u.id = r.user_id
			 where u.dance is not r.dance order by r.id`
		)) {
			lines.push(`${t} ${r.id}: dance ${r.dance}, its account's ${r.u_dance ?? 'none'}`);
		}
	}
	const pairs = [
		['team_members', 'team_id', 'teams'],
		['lesson_adds', 'lesson_id', 'lessons']
	] as const;
	for (const [t, key, parent] of pairs) {
		for (const r of all(
			`select x.user_id, x.${key} as pid from ${t} x join users u on u.id = x.user_id
			 join ${parent} p on p.id = x.${key} where u.dance is not p.dance order by x.user_id, pid`
		)) {
			lines.push(`${t} ${r.user_id}/${r.pid}: in another dance than its account`);
		}
	}
	for (const r of all(
		`select s.id from storage_requests s join users u on u.id = s.user_id
		 join teams tm on tm.id = s.team_id where u.dance is not tm.dance order by s.id`
	)) {
		lines.push(`storage_requests ${r.id}: for another dance's group`);
	}
	for (const t of ['count_takes', 'device_tokens', 'sessions'] as const) {
		for (const r of all(
			`select x.user_id, count(*) as n from ${t} x join users u on u.id = x.user_id
			 where u.dance is null group by x.user_id order by x.user_id`
		)) {
			lines.push(`${t}: ${r.n} of account ${r.user_id}, which has no dance`);
		}
	}
	return lines;
}

/** Pieces whose parent may hold one member of a family each, and how a line names them. */
const PIECES = [
	{ table: 'recordings', parent: 'figure_id', parentTable: 'figures', name: 'recordings' },
	{ table: 'lesson_videos', parent: 'lesson_id', parentTable: 'lessons', name: 'videos' },
	{ table: 'video_spots', parent: 'recording_id', parentTable: 'recordings', name: 'sections' },
	{
		table: 'video_spots',
		parent: 'lesson_video_id',
		parentTable: 'lesson_videos',
		name: 'sections'
	}
] as const;

/**
 * A piece parent holding two rows of one gene, one line each:
 * "figures 3: recordings 7, 9 are one family". A recording is matched on its
 * figure, a video in its lesson, a section on its recording or video; never
 * across parents. Empty when whole. Reads only.
 */
export function familyIntegrity(db: Db): string[] {
	const lines: string[] = [];
	for (const p of PIECES) {
		for (const r of db.all<{ parent: number; ids: string }>(
			sql.raw(
				`select ${p.parent} as parent, group_concat(id) as ids from ${p.table}
				 where gene_id is not null and ${p.parent} is not null
				 group by ${p.parent}, gene_id having count(*) > 1 order by ${p.parent}, min(id)`
			)
		)) {
			const ids = r.ids
				.split(',')
				.map(Number)
				.sort((a, b) => a - b);
			lines.push(`${p.parentTable} ${r.parent}: ${p.name} ${ids.join(', ')} are one family`);
		}
	}
	return lines;
}

/**
 * One kind of pointer, as SQL: `from` joins the pointer row `x` to its owner
 * row, whose id and owners are `oid`, `ou` and `oteam`; `tid` is the target's
 * id, a row of `tk`'s table.
 */
type RefQuery = {
	ot: string;
	via: string;
	tk: ReadKind;
	oid: string;
	ou: string;
	oteam: string;
	from: string;
	tid: string;
	where?: string;
};

/** What each target kind is, as a table. */
const TARGET: Record<ReadKind, string> = {
	figure: 'figures',
	routine: 'routines',
	drill: 'exercises',
	lesson: 'lessons',
	position: 'positions'
};

const ROUTINE_OWNER = { oid: 'r.id', ou: 'r.user_id', oteam: 'r.team_id' };
const LESSON_OWNER = { oid: 'l.id', ou: 'l.user_id', oteam: 'l.team_id' };
const FIGURE_OWNER = { oid: 'f.id', ou: 'f.user_id', oteam: 'f.team_id' };

/** A spot's owner is its video's: a recording's variation, or a lesson. */
const SPOT_OWNER = {
	ou: 'coalesce(rf.user_id, vl.user_id)',
	oteam: 'coalesce(rf.team_id, vl.team_id)'
};
const spotFrom = (table: string) => `${table} x join video_spots v on v.id = x.spot_id
	       left join recordings rec on rec.id = v.recording_id
	       left join figures rf on rf.id = rec.figure_id
	       left join lesson_videos lv on lv.id = v.lesson_video_id
	       left join lessons vl on vl.id = lv.lesson_id`;

const REFS: RefQuery[] = [
	{
		ot: 'routines',
		via: 'option figure',
		tk: 'figure',
		...ROUTINE_OWNER,
		from: `routine_step_options x join routine_steps s on s.id = x.step_id
		       join routines r on r.id = s.routine_id`,
		tid: 'x.figure_id'
	},
	{
		ot: 'routines',
		via: 'embedded routine',
		tk: 'routine',
		...ROUTINE_OWNER,
		from: 'routine_steps x join routines r on r.id = x.routine_id',
		tid: 'x.child_routine_id'
	},
	...(['figure', 'drill'] as const).map((tk): RefQuery => ({
		ot: 'spot_links',
		via: `linked ${tk}`,
		tk,
		oid: 'x.id',
		...SPOT_OWNER,
		from: spotFrom('spot_links'),
		tid: tk === 'figure' ? 'x.figure_id' : 'x.exercise_id'
	})),
	{
		ot: 'spot_position_links',
		via: 'linked position',
		tk: 'position',
		oid: 'x.id',
		...SPOT_OWNER,
		from: spotFrom('spot_position_links'),
		tid: 'x.position_id'
	},
	// A figure's tags: a group's figure only with its group's positions, a
	// person's with their own or the group positions they read (ruling 15).
	...(
		[
			['start', 'figure_start_positions'],
			['end', 'figure_end_positions']
		] as const
	).map(([side, table]): RefQuery => ({
		ot: 'figures',
		via: `${side} position`,
		tk: 'position',
		...FIGURE_OWNER,
		from: `${table} x join figures f on f.id = x.figure_id`,
		tid: 'x.position_id'
	})),
	{
		ot: 'lessons',
		via: 'linked position',
		tk: 'position',
		...LESSON_OWNER,
		from: 'lesson_positions x join lessons l on l.id = x.lesson_id',
		tid: 'x.position_id'
	},
	...(
		[
			['figure', 'lesson_figures', 'figure_id'],
			['routine', 'lesson_routines', 'routine_id'],
			['drill', 'lesson_exercises', 'exercise_id']
		] as const
	).map(([tk, table, col]): RefQuery => ({
		ot: 'lessons',
		via: `linked ${tk}`,
		tk,
		...LESSON_OWNER,
		from: `${table} x join lessons l on l.id = x.lesson_id`,
		tid: `x.${col}`
	})),
	// Live entries (and any exercise's own target). An archived entry is how a
	// lost reach is answered (`reconcileEntries`), so it is no pointer.
	...(
		[
			['figure', 'figure_id'],
			['routine', 'routine_id'],
			['lesson', 'lesson_id'],
			['drill', 'drill_id']
		] as const
	).map(([tk, col]): RefQuery => ({
		ot: 'exercises',
		via: `entry's ${tk}`,
		tk,
		oid: 'x.id',
		ou: 'x.user_id',
		oteam: 'x.team_id',
		from: 'exercises x',
		tid: `x.${col}`,
		where: 'x.archived_at is null'
	}))
];

type RefRow = {
	oid: number;
	ou: string | null;
	oteam: number | null;
	tid: number;
	tu: string | null;
	tteam: number | null;
};

/**
 * Rows pointing where they must not, one line each. Empty when whole. Reads
 * only; specs run it as the safety net for every change of reach, and boot
 * logs it.
 *
 * - A group's row pointing outside its group (a slot option, an embed, a
 *   section link from a group's video, a group lesson's hand link, a group
 *   figure's start or end position, a position link of a group's lesson,
 *   section or point):
 *   "routines 4: option figure 9 is outside group 2".
 * - A person's row (their routines' slots and embeds, the section links on
 *   their videos, their lessons' hand links, their live entries' targets,
 *   their figures' positions and their position links)
 *   pointing at a group row they do not read:
 *   "routines 5: embedded routine 7 is group 2's, which u2 does not read";
 *   or at another person's row: "lessons 3: linked figure 8 is another person's".
 *
 * A person's archived routines and lessons are checked too: restoring one
 * must not bring back a pointer they may not follow. Whether a person reads a
 * group row is `access.ts`' answer, decided once per person and group
 * (`teamReader`): one query per kind of pointer, plus one reach per pair.
 */
export function crossRefs(db: Db): string[] {
	const lines = new Set<string>();
	const readers = new Map<string, ReturnType<typeof teamReader>>();
	const reads = (userId: string, teamId: number, kind: ReadKind, id: number) => {
		const key = `${userId}\t${teamId}`;
		let reader = readers.get(key);
		if (!reader) readers.set(key, (reader = teamReader(db, userId, teamId)));
		return reader(kind, id);
	};
	for (const q of REFS) {
		const rows = db.all<RefRow>(
			sql.raw(
				`select ${q.oid} as oid, ${q.ou} as ou, ${q.oteam} as oteam,
				        t.id as tid, t.user_id as tu, t.team_id as tteam
				 from ${q.from} join ${TARGET[q.tk]} t on t.id = ${q.tid}
				 where ${q.where ?? '1'} and (
				   (${q.oteam} is not null and t.team_id is not ${q.oteam})
				   or (${q.oteam} is null and ${q.ou} is not null
				       and (t.team_id is not null or t.user_id is not ${q.ou}))
				 )
				 order by oid, tid`
			)
		);
		for (const r of rows) {
			const at = `${q.ot} ${r.oid}: ${q.via} ${r.tid}`;
			if (r.oteam !== null) {
				lines.add(`${at} is outside group ${r.oteam}`);
			} else if (r.tteam === null) {
				lines.add(`${at} is ${r.tu === null ? "no one's" : "another person's"}`);
			} else if (r.tu === null && !reads(r.ou!, r.tteam, q.tk, r.tid)) {
				lines.add(`${at} is group ${r.tteam}'s, which ${r.ou} does not read`);
			}
		}
	}
	return [...lines];
}
