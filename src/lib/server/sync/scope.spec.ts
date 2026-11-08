import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { openDb, type Db } from '../db';
import { teams } from '../db/schema';
import {
	drillAccess,
	figureAccess,
	figureGroupAccess,
	lessonAccess,
	lessonVideoAccess,
	positionAccess,
	recordingAccess,
	routineAccess,
	songAccess,
	spotAccess
} from '../access';
import { deleteTeam } from '../teams';
import { leaveTeam } from '../membership';
import { NO_FILES } from '../test-walls';
import { SYNCED } from '$lib/sync/tables';
import { keyString } from '$lib/sync/digest';
import { syncScope, type Row, type Scope } from './scope';
import { makeWorld, WORLD_T, type World } from './test-world';

const PEOPLE = ['u1', 'u2', 'u3', 'u4', 'u5'] as const;

let db: Db;
let w: World;

beforeEach(() => {
	db = openDb(':memory:');
	w = makeWorld(db);
});

const raw = (t: string): Row[] => db.all<Row>(sql`SELECT * FROM ${sql.identifier(t)}`);
const keyOf = (t: string, row: Row) => keyString(SYNCED[t].map((c) => row[c]));
const holds = (s: Scope, t: string, row: Row) => s.get(t)!.has(keyOf(t, row));
const hasId = (s: Scope, t: string, id: unknown) => id !== null && s.get(t)!.has(String(id));
const owned = (r: Row) => ({
	id: r.id as number,
	userId: r.user_id as string | null,
	teamId: r.team_id as number | null
});

type Judge = (db: Db, userId: string, r: Row) => boolean;

const ROOTS: Record<string, Judge> = {
	figures: (d, u, r) => figureAccess(d, u, owned(r)) !== null,
	figure_groups: (d, u, r) => figureGroupAccess(d, u, owned(r)) !== null,
	routines: (d, u, r) => routineAccess(d, u, owned(r)) !== null,
	exercises: (d, u, r) => drillAccess(d, u, owned(r)) !== null,
	lessons: (d, u, r) => lessonAccess(d, u, owned(r)) !== null,
	positions: (d, u, r) => positionAccess(d, u, owned(r)) !== null
};

const MEDIA: Record<string, Judge> = {
	recordings: (d, u, r) =>
		recordingAccess(d, u, { id: r.id as number, figureId: r.figure_id as number }) !== null,
	lesson_videos: (d, u, r) => lessonVideoAccess(d, u, { lessonId: r.lesson_id as number }) !== null,
	video_spots: (d, u, r) => spotAccess(d, u, r.id as number) !== null,
	songs: (d, u, r) =>
		songAccess(d, u, {
			userId: r.user_id as string | null,
			teamId: r.team_id as number | null,
			sharedAt: r.shared_at as number | null,
			archivedAt: r.archived_at as number | null
		}) !== null
};

/**
 * Every row of these tables, for every person: in scope exactly when the
 * oracle says they may read it. Both answers must turn up somewhere, or the
 * world proves nothing about the table.
 */
function agrees(judges: Record<string, Judge>) {
	const seen = new Map<string, { yes: number; no: number }>();
	for (const u of PEOPLE) {
		const s = syncScope(db, u);
		for (const [t, judge] of Object.entries(judges)) {
			const count = seen.get(t) ?? { yes: 0, no: 0 };
			for (const row of raw(t)) {
				const may = judge(db, u, row);
				expect(holds(s, t, row), `${u} ${t} ${keyOf(t, row)}`).toBe(may);
				if (may) count.yes++;
				else count.no++;
			}
			seen.set(t, count);
		}
	}
	return seen;
}

const TABLE_OF_KIND: Record<string, string> = {
	figure: 'figures',
	routine: 'routines',
	drill: 'exercises',
	song: 'songs',
	lesson: 'lessons',
	position: 'positions'
};

/** A child row's parent rule, read straight off the rules table. */
const CHILDREN: Record<string, (r: Row, s: Scope) => boolean> = {
	recordings: (r, s) => hasId(s, 'figures', r.figure_id),
	figure_start_positions: (r, s) => hasId(s, 'figures', r.figure_id),
	figure_end_positions: (r, s) => hasId(s, 'figures', r.figure_id),
	lesson_videos: (r, s) => hasId(s, 'lessons', r.lesson_id),
	lesson_figures: (r, s) => hasId(s, 'lessons', r.lesson_id),
	lesson_routines: (r, s) => hasId(s, 'lessons', r.lesson_id),
	lesson_exercises: (r, s) => hasId(s, 'lessons', r.lesson_id),
	lesson_positions: (r, s) => hasId(s, 'lessons', r.lesson_id),
	lesson_comments: (r, s) => hasId(s, 'lessons', r.lesson_id),
	routine_steps: (r, s) => hasId(s, 'routines', r.routine_id),
	routine_step_options: (r, s) => hasId(s, 'routine_steps', r.step_id),
	video_spots: (r, s) =>
		hasId(s, 'recordings', r.recording_id) || hasId(s, 'lesson_videos', r.lesson_video_id),
	spot_links: (r, s) => hasId(s, 'video_spots', r.spot_id),
	spot_position_links: (r, s) => hasId(s, 'video_spots', r.spot_id),
	sets: (r, s) => hasId(s, 'exercises', r.exercise_id),
	song_drops: (r, s) => hasId(s, 'exercises', r.exercise_id),
	links: (r, s) =>
		hasId(s, 'lessons', r.lesson_id) ||
		hasId(s, 'figures', r.figure_id) ||
		hasId(s, 'exercises', r.exercise_id),
	// Music shows only a song its viewer may play (`listMusic`), so the song too.
	song_links: (r, s) =>
		(hasId(s, 'lessons', r.lesson_id) ||
			hasId(s, 'exercises', r.exercise_id) ||
			hasId(s, 'routines', r.routine_id)) &&
		hasId(s, 'songs', r.song_id),
	video_downloads: (r, s) => hasId(s, 'lessons', r.lesson_id) || hasId(s, 'figures', r.figure_id),
	lesson_comment_hearts: (r, s) => hasId(s, 'lesson_comments', r.comment_id),
	team_members: (r, s) => hasId(s, 'teams', r.team_id),
	clone_sync: (r, s) => hasId(s, TABLE_OF_KIND[r.kind as string], r.row_id)
};

const PERSONAL = ['today_picks', 'default_styles', 'count_takes', 'opens', 'twins', 'lesson_adds'];

/** Tables the world leaves empty: nothing it builds makes one. */
const EMPTY_IN_WORLD = new Set<string>();

describe('syncScope', () => {
	it('agrees with access.ts on every root row, for every person', () => {
		for (const [t, c] of agrees(ROOTS)) {
			expect(c.yes, `${t}: someone reads a row`).toBeGreaterThan(0);
			expect(c.no, `${t}: someone is refused a row`).toBeGreaterThan(0);
		}
	});

	it('agrees with access.ts on recordings, lesson videos, spots and songs', () => {
		for (const [t, c] of agrees(MEDIA)) {
			expect(c.yes, `${t}: someone reads a row`).toBeGreaterThan(0);
			expect(c.no, `${t}: someone is refused a row`).toBeGreaterThan(0);
		}
	});

	it('still agrees once the group is deleted, until its purge, and after it', () => {
		expect(deleteTeam(db, 1, 'u1', WORLD_T + 1)).toBe(true);
		agrees({ ...ROOTS, ...MEDIA });
		// Deleted, the group still shows to its members until the purge.
		for (const u of ['u1', 'u2', 'u3']) expect(syncScope(db, u).get('teams')!.has('1')).toBe(true);
		db.update(teams)
			.set({ purgedAt: WORLD_T + 2 })
			.where(eq(teams.id, 1))
			.run();
		agrees({ ...ROOTS, ...MEDIA });
		for (const u of PEOPLE) {
			const s = syncScope(db, u);
			expect(s.get('teams')!.has('1')).toBe(false);
			expect(s.get('team_members')!.size === 0 || u === 'u5').toBe(true);
		}
	});

	it('takes a child row exactly when its parent is in scope', () => {
		for (const t of Object.keys(CHILDREN)) {
			if (!EMPTY_IN_WORLD.has(t)) expect(raw(t).length, `${t} has rows`).toBeGreaterThan(0);
		}
		const seen = new Map<string, { yes: number; no: number }>();
		for (const u of PEOPLE) {
			const s = syncScope(db, u);
			for (const [t, parentIn] of Object.entries(CHILDREN)) {
				const count = seen.get(t) ?? { yes: 0, no: 0 };
				for (const row of raw(t)) {
					const want = parentIn(row, s);
					expect(holds(s, t, row), `${u} ${t} ${keyOf(t, row)}`).toBe(want);
					if (want) count.yes++;
					else count.no++;
				}
				seen.set(t, count);
			}
			for (const t of PERSONAL) {
				for (const row of raw(t)) {
					expect(holds(s, t, row), `${u} ${t} ${keyOf(t, row)}`).toBe(row.user_id === u);
				}
			}
		}
		for (const [t, c] of seen) {
			if (EMPTY_IN_WORLD.has(t)) continue;
			expect(c.yes, `${t}: someone gets a row`).toBeGreaterThan(0);
			expect(c.no, `${t}: someone is refused a row`).toBeGreaterThan(0);
		}
		for (const t of PERSONAL) expect(raw(t).length, `${t} has rows`).toBeGreaterThan(0);
	});

	it('sends a users row for me, the people of my groups and the authors of comments I read', () => {
		const s = syncScope(db, 'u3');
		expect([...s.get('users')!.keys()].sort()).toEqual(['u1', 'u2', 'u3']);
		expect([...syncScope(db, 'u4').get('users')!.keys()]).toEqual(['u4']);
		expect([...syncScope(db, 'u5').get('users')!.keys()]).toEqual(['u5']);
	});

	it('gives Nik nothing of group 1 and Eva nothing of group 1', () => {
		for (const u of ['u4', 'u5']) {
			const s = syncScope(db, u);
			expect(s.get('teams')!.has('1'), u).toBe(false);
			for (const t of Object.keys(ROOTS)) {
				for (const row of s.get(t)!.values()) expect(row.team_id, `${u} ${t}`).not.toBe(1);
			}
			for (const row of s.get('songs')!.values()) expect(row.team_id, `${u} songs`).not.toBe(1);
			for (const row of s.get('team_members')!.values()) expect(row.team_id).not.toBe(1);
			expect(s.get('lesson_comments')!.size).toBe(0);
			expect(s.get('lesson_comment_hearts')!.size).toBe(0);
		}
		const eva = syncScope(db, 'u5');
		expect(eva.get('lessons')!.has(String(w.otherGroup.lesson))).toBe(true);
		expect(eva.get('figures')!.has(String(w.otherGroup.figure))).toBe(true);
		expect(eva.get('songs')!.has(String(w.other))).toBe(true);
		expect(eva.get('songs')!.has(String(w.shared))).toBe(false);
		// Nor anyone's own rows but their own.
		const nik = syncScope(db, 'u4');
		expect(nik.get('figures')!.has(String(w.own.u1.figure))).toBe(false);
		expect(nik.get('figures')!.has(String(w.own.u4.figure))).toBe(true);
	});

	it('gives Maja the published lesson and not the draft or the archived one', () => {
		const s = syncScope(db, 'u3');
		const has = (t: string, id: number) => s.get(t)!.has(String(id));
		expect(has('lessons', w.group.published)).toBe(true);
		expect(has('lessons', w.lesson)).toBe(true);
		expect(has('figures', w.group.figure)).toBe(true);
		expect(has('recordings', w.group.recording)).toBe(true);
		expect(has('video_spots', w.group.spot)).toBe(true);
		expect(has('routines', w.group.routine)).toBe(true);
		expect(has('exercises', w.group.drill)).toBe(true);
		expect(has('positions', w.group.position)).toBe(true);
		expect(has('songs', w.shared)).toBe(true);

		expect(has('lessons', w.group.draft)).toBe(false);
		expect(has('figures', w.group.draftFigure)).toBe(false);
		expect(has('positions', w.group.draftPosition)).toBe(false);
		expect(has('lesson_videos', w.group.draftVideo)).toBe(false);
		expect(has('video_spots', w.group.draftSpot)).toBe(false);
		expect(has('songs', w.draft)).toBe(false);
		expect(has('lessons', w.group.archived)).toBe(false);
		expect(has('figures', w.group.archivedFigure)).toBe(false);

		// Music: the class song's row, not the unshared one's; her drop is her own.
		expect(has('song_links', w.group.sharedLink)).toBe(true);
		expect(has('song_links', w.group.withdrawnLink)).toBe(false);
		expect(has('songs', w.group.withdrawn)).toBe(false);
		expect(s.get('song_drops')!.has(keyString([w.entry, w.group.withdrawn]))).toBe(true);
		const luka = syncScope(db, 'u2');
		expect(luka.get('song_links')!.has(String(w.group.withdrawnLink))).toBe(true);
		expect(luka.get('song_drops')!.size).toBe(0);
	});

	it('gives Luka the draft and the archived lesson', () => {
		const s = syncScope(db, 'u2');
		const has = (t: string, id: number) => s.get(t)!.has(String(id));
		for (const [t, id] of [
			['lessons', w.group.draft],
			['figures', w.group.draftFigure],
			['positions', w.group.draftPosition],
			['lesson_videos', w.group.draftVideo],
			['video_spots', w.group.draftSpot],
			['songs', w.draft],
			['lessons', w.group.archived],
			['figures', w.group.archivedFigure]
		] as const) {
			expect(has(t, id), `${t} ${id}`).toBe(true);
		}
		expect(has('figures', w.own.u1.figure)).toBe(false);
	});

	it('gives a member who left nothing of the group', async () => {
		expect(await leaveTeam(db, 1, 'u3', { mode: 'used' }, NO_FILES, WORLD_T + 1)).toBe('left');
		const s = syncScope(db, 'u3');
		expect(s.get('teams')!.size).toBe(0);
		expect(s.get('team_members')!.size).toBe(0);
		for (const t of [...Object.keys(ROOTS), 'songs']) {
			for (const row of s.get(t)!.values()) expect(row.team_id, t).toBeNull();
		}
		for (const t of ['lesson_comments', 'lesson_comment_hearts', 'lesson_videos', 'recordings']) {
			expect(s.get(t)!.size, t).toBe(0);
		}
		expect([...s.get('users')!.keys()]).toEqual(['u3']);
		agrees({ ...ROOTS, ...MEDIA });
	});

	it("redacts another person's users row and never sends a password hash", () => {
		const s = syncScope(db, 'u3');
		const luka = s.get('users')!.get('u2')!;
		expect(luka).toEqual({
			...Object.fromEntries(Object.keys(luka).map((k) => [k, null])),
			id: 'u2',
			email: 'u2@hidden.invalid',
			password_hash: '',
			timezone: 'UTC',
			video_short_side: 480,
			is_admin: 0,
			first_name: 'Luka',
			last_name: raw('users').find((u) => u.id === 'u2')!.last_name,
			dance: raw('users').find((u) => u.id === 'u2')!.dance,
			created_at: raw('users').find((u) => u.id === 'u2')!.created_at
		});
		const me = raw('users').find((u) => u.id === 'u3')!;
		expect(s.get('users')!.get('u3')).toEqual({ ...me, password_hash: '' });
		expect(me.password_hash).not.toBe('');
		for (const u of PEOPLE) {
			for (const row of syncScope(db, u).get('users')!.values()) {
				expect(row.password_hash).toBe('');
			}
		}
	});

	it("never sends a deleted comment's words", () => {
		for (const u of ['u1', 'u2', 'u3']) {
			const comments = syncScope(db, u).get('lesson_comments')!;
			expect(comments.get(String(w.group.deletedComment))!.body, u).toBe('');
			expect(comments.get(String(w.group.comment))!.body, u).toBe('Lovely class');
		}
	});

	it('holds every synced table, even empty', () => {
		const s = syncScope(db, 'u4');
		expect([...s.keys()].sort()).toEqual(Object.keys(SYNCED).sort());
		for (const m of s.values()) expect(m).toBeInstanceOf(Map);
		expect(s.get('lesson_comments')!.size).toBe(0);
	});
});
