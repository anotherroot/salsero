/**
 * The migration is the one thing in this change that can destroy data rather
 * than merely misbehave. This test builds a database at the LAST PRE-DANCE
 * migration, fills it with rows shaped like the real ones, then runs the new
 * migrations over it and checks what came out.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { openDb, type Db } from './index';
import { exercises, figureGroups, figures, lessons, songs } from './schema';

/** The connection behind a drizzle handle, for plain SQL. */
const raw = (d: Db) => (d as unknown as { $client: Database.Database }).$client;

/**
 * A database file for the old schema. `synchronous = OFF`: it is a throwaway
 * temp file, and with the default every migration's commit waits for an fsync,
 * which a busy disk (a build, git, another slot) stretched to 15 s.
 */
function oldDb(file: string): Database.Database {
	const old = new Database(file);
	old.pragma('synchronous = OFF');
	old.pragma('foreign_keys = ON');
	return old;
}

/** The last migration before the dance column. */
const LAST_OLD = '0004_absent_captain_midlands';

let temps: string[] = [];
beforeEach(() => {
	temps = [];
});
afterEach(() => {
	for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

/**
 * In RAM where there is one (/dev/shm on Linux). `openDb` runs the new
 * migrations with its own pragmas, so every commit there waits for an fsync,
 * and a busy disk stretched one test past 5 s even with `oldDb`'s OFF.
 */
const TEMP_ROOT = existsSync('/dev/shm') ? '/dev/shm' : tmpdir();

function temp(prefix: string): string {
	const dir = mkdtempSync(join(TEMP_ROOT, prefix));
	temps.push(dir);
	return dir;
}

/** A copy of `drizzle/` with the journal truncated after `tag`. */
function migrationsThrough(tag: string): string {
	const dir = temp('salsa-migrations-');
	cpSync('drizzle', dir, { recursive: true });
	const journalPath = join(dir, 'meta', '_journal.json');
	const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
	const cut = journal.entries.findIndex((e: { tag: string }) => e.tag === tag);
	expect(cut, `${tag} is not in the journal`).toBeGreaterThanOrEqual(0);
	journal.entries = journal.entries.slice(0, cut + 1);
	writeFileSync(journalPath, JSON.stringify(journal));
	return dir;
}

it('backfills every existing row to salsa, and figures keep their style', () => {
	const file = join(temp('salsa-db-'), 'old.db');

	// 1. A database at the old schema, with rows that predate `dance`.
	const old = oldDb(file);
	migrate(drizzle(old), { migrationsFolder: migrationsThrough(LAST_OLD) });
	old
		.prepare(
			`insert into figures (name, partner, style, callable, created_at) values (?, ?, ?, 1, 1)`
		)
		.run('Dile que no', 'partner', 'son');
	old
		.prepare(
			`insert into exercises (name, source, figure_id, every_days, active, created_at)
			 values (?, 'figure', 1, 3, 1, 1)`
		)
		.run('Dile que no');
	old
		.prepare(
			`insert into songs (title, style, status, audio_file, created_at) values (?, ?, ?, ?, 1)`
		)
		.run('El Cantante', 'salsa', 'ready', 'a.m4a');
	old
		.prepare(`insert into lessons (lesson_day, title, created_at) values (?, ?, 1)`)
		.run('2026-09-01', 'Tuesday class');
	old.close();

	// 2. The new migrations run over it.
	const db = openDb(file);

	expect(db.select().from(figures).get()).toMatchObject({ dance: 'salsa', styleTag: 'son' });
	expect(db.select().from(exercises).get()).toMatchObject({ dance: 'salsa' });
	expect(db.select().from(songs).get()).toMatchObject({ dance: 'salsa' });
	expect(db.select().from(lessons).get()).toMatchObject({ dance: 'salsa' });
});

it('lets a bachata figure through the vestigial style CHECK', () => {
	// `figures_style_ck` still exists and still only allows salsa/son/other.
	// A bachata row must never touch it: `style` takes its default.
	const db = openDb(':memory:');
	const row = db
		.insert(figures)
		.values({ name: 'Basico', partner: 'partner', dance: 'bachata', styleTag: 'sensual' })
		.returning()
		.get();
	expect(row.dance).toBe('bachata');
	expect(row.styleTag).toBe('sensual');
	expect(row.style).toBe('salsa'); // the vestigial column's default
});

it('turns base figures into groups and materialises what variations inherited', () => {
	const file = join(temp('salsa-db-'), 'old.db');
	const old = oldDb(file);
	migrate(drizzle(old), { migrationsFolder: migrationsThrough('0015_smiling_baron_strucker') });

	for (const [id, slug, neutral] of [
		[1, 'neutral', 1],
		[2, 'cross-hand', 0],
		[3, 'hammerlock', 0]
	]) {
		old
			.prepare(`insert into positions (id, slug, name, neutral, created_at) values (?, ?, ?, ?, 1)`)
			.run(id, slug, slug, neutral);
	}
	const fig = old.prepare(
		`insert into figures (id, name, dance, parent_id, end_position_id, start_count, length_counts,
		   partner, style_tag, archived_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
	);
	const A = 1,
		B = 2,
		C = 3,
		D = 4,
		E = 5,
		V1 = 6,
		V2 = 7,
		V3 = 8;
	fig.run(A, 'Enchufla', 'salsa', null, 3, 5, 4, 'solo', 'son', null);
	fig.run(B, 'Setenta', 'salsa', null, null, null, null, 'partner', null, 100);
	fig.run(C, 'Vacilala', 'salsa', null, null, null, null, 'partner', null, null);
	fig.run(D, 'vacilala ', 'salsa', null, null, null, null, 'partner', null, null);
	fig.run(E, 'Vacilala', 'bachata', null, null, null, null, 'partner', null, null);
	fig.run(V1, 'Doble', 'salsa', A, null, null, null, 'partner', null, null);
	fig.run(V2, 'Basic', 'salsa', A, 1, 1, 8, 'partner', null, null);
	fig.run(V3, 'Con mano', 'salsa', B, null, null, null, 'partner', null, null);
	const sp = old.prepare(
		`insert into figure_start_positions (figure_id, position_id, created_at) values (?, ?, 1)`
	);
	sp.run(A, 2);
	sp.run(V2, 1);
	const ex = old.prepare(
		`insert into exercises (name, source, figure_id, created_at) values (?, 'figure', ?, 1)`
	);
	ex.run('Enchufla', A);
	ex.run('Enchufla · Doble', V1);
	old.close();

	const db = openDb(file);
	const g = (id: number) => db.select().from(figureGroups).where(eq(figureGroups.id, id)).get()!;
	const f = (id: number) => db.select().from(figures).where(eq(figures.id, id)).get()!;
	const starts = (id: number) =>
		(
			raw(db)
				.prepare(`select position_id from figure_start_positions where figure_id = ? order by 1`)
				.all(id) as { position_id: number }[]
		).map((r) => r.position_id);
	const exerciseOf = (id: number) =>
		db.select().from(exercises).where(eq(exercises.figureId, id)).get()!;

	expect(g(A)).toMatchObject({ name: 'Enchufla', dance: 'salsa', archivedAt: null });
	expect([A, V1, V2].map((id) => f(id).groupId)).toEqual([A, A, A]);
	expect(f(A).name).toBe('Original');
	expect(f(V1)).toMatchObject({
		endPositionId: 3,
		startCount: 5,
		lengthCounts: 4,
		partner: 'solo',
		styleTag: 'son'
	});
	expect(starts(V1)).toEqual([2]);
	expect(f(V2)).toMatchObject({
		endPositionId: 1,
		startCount: 1,
		lengthCounts: 8,
		partner: 'solo'
	});
	expect(starts(V2)).toEqual([1]);
	expect(g(B).archivedAt).toBeNull();
	expect(f(C).name).toBe('Basic');
	expect([g(C).name, g(D).name, g(E).name]).toEqual(['Vacilala', 'vacilala 2', 'Vacilala']);
	expect(exerciseOf(A).name).toBe('Enchufla · Original');
	expect(exerciseOf(V1).name).toBe('Enchufla · Doble');
});

it('keeps live figure names unique per dance and base variation names unique per figure', () => {
	const file = join(temp('salsa-db-'), 'old.db');
	const old = oldDb(file);
	migrate(drizzle(old), { migrationsFolder: migrationsThrough('0015_smiling_baron_strucker') });
	const fig = old.prepare(
		`insert into figures (id, name, dance, parent_id, created_at) values (?, ?, 'salsa', ?, 1)`
	);
	fig.run(1, 'Vacilala', null);
	fig.run(2, 'vacilala', null);
	fig.run(3, 'VACILALA', null);
	fig.run(4, 'Vacilala 2', null);
	fig.run(5, 'Cruzada', null);
	fig.run(6, 'Basic', 5);
	fig.run(7, 'original ', 5);
	old.close();

	const db = openDb(file);
	const names = (
		raw(db)
			.prepare(`select name from figure_groups where archived_at is null order by id`)
			.all() as {
			name: string;
		}[]
	).map((r) => r.name);
	const keys = names.map((n) => n.trim().toLowerCase());
	expect(new Set(keys).size).toBe(keys.length);
	expect(names[0]).toBe('Vacilala');
	const inGroup = (
		raw(db).prepare(`select name from figures where group_id = 5 order by id`).all() as {
			name: string;
		}[]
	).map((r) => r.name);
	expect(inGroup).toEqual(['Basic (5)', 'Basic', 'original ']);
});

it('has owned positions, many ends and the position links (0028)', () => {
	const db = openDb(':memory:');
	const r = raw(db);
	r.prepare(
		`insert into positions (dance, slug, name, user_id, team_id, gene_id, style_tag, hands, crossed, facing, frame, notes, picture_spot_id, created_at)
		 values ('salsa', 'p-1', 'Open', 'u1', null, 'g1', 'son', 'two', 1, 'face', 'open', 'n', null, 1)`
	).run();
	// two positions of one dance may share a slug
	r.prepare(
		`insert into positions (dance, slug, name, created_at) values ('salsa', 'p-1', 'Closed', 1)`
	).run();
	for (const t of ['figure_end_positions', 'spot_position_links', 'lesson_positions']) {
		expect(
			r.prepare(`select name from sqlite_master where type='table' and name=?`).get(t),
			t
		).toBeTruthy();
	}
	r.prepare(
		`insert into lessons (id, lesson_day, title, dance, created_at) values (1, '2026-01-01', 'L', 'salsa', 1)`
	).run();
	r.prepare(
		`insert into lesson_videos (id, lesson_id, file, mime, size_bytes, created_at) values (1, 1, 'f', 'video/mp4', 1, 1)`
	).run();
	r.prepare(
		`insert into video_spots (id, lesson_video_id, start_ms, created_at) values (1, 1, 0, 1)`
	).run();
	r.prepare(
		`insert into spot_position_links (spot_id, position_id, created_at) values (1, 1, 1)`
	).run();
	expect(() => r.prepare(`delete from video_spots where id = 1`).run()).toThrow(/FOREIGN KEY/i);
	raw(db).close();
});

it('widens four CHECKs to learn positions and keeps the rows written before (0029)', () => {
	const file = join(temp('salsa-db-'), 'old.db');
	const old = oldDb(file);
	migrate(drizzle(old), { migrationsFolder: migrationsThrough('0028_orange_doctor_faustus') });
	old
		.prepare(
			`insert into team_changes (team_id, root_kind, root_id, actor_id, at, verb, subject) values (1, 'figure', 1, 'u', 1, 'add', 's')`
		)
		.run();
	old
		.prepare(
			`insert into twins (user_id, kind, set_id, item_id, created_at) values ('u', 'figure', 's', 1, 1)`
		)
		.run();
	old
		.prepare(
			`insert into clone_pairs (kind, a_id, b_id, base_json, at) values ('figure', 1, 2, '{}', 1)`
		)
		.run();
	old
		.prepare(
			`insert into team_trash (team_id, kind, label, root_kind, root_id, rows_json, deleted_by, deleted_at) values (1, 'link', 'l', 'lesson', 1, '{}', 'u', 1)`
		)
		.run();
	old.close();

	const db = openDb(file);
	const r = raw(db);
	for (const t of ['team_changes', 'twins', 'clone_pairs', 'team_trash']) {
		expect((r.prepare(`select count(*) n from ${t}`).get() as { n: number }).n, t).toBe(1);
	}
	r.prepare(
		`insert into team_changes (team_id, root_kind, root_id, actor_id, at, verb, subject) values (1, 'position', 1, 'u', 1, 'add', 's')`
	).run();
	r.prepare(
		`insert into twins (user_id, kind, set_id, item_id, created_at) values ('u', 'position', 's', 2, 1)`
	).run();
	r.prepare(
		`insert into clone_pairs (kind, a_id, b_id, base_json, at) values ('position', 1, 2, '{}', 1)`
	).run();
	r.prepare(
		`insert into team_trash (team_id, kind, label, root_kind, root_id, rows_json, deleted_by, deleted_at) values (1, 'position-link', 'l', 'lesson', 1, '{}', 'u', 1)`
	).run();
	// still refuses what it never knew
	expect(() =>
		r
			.prepare(
				`insert into twins (user_id, kind, set_id, item_id, created_at) values ('u', 'nope', 's', 3, 1)`
			)
			.run()
	).toThrow(/CHECK/i);
	raw(db).close();
});
