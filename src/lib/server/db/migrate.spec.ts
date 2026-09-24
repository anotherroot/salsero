/**
 * The migration is the one thing in this change that can destroy data rather
 * than merely misbehave. This test builds a database at the LAST PRE-DANCE
 * migration, fills it with rows shaped like the real ones, then runs the new
 * migrations over it and checks what came out.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { openDb } from './index';
import { exercises, figures, lessons, songs } from './schema';

/** The last migration before the dance column. */
const LAST_OLD = '0004_absent_captain_midlands';

let temps: string[] = [];
beforeEach(() => {
	temps = [];
});
afterEach(() => {
	for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

function temp(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
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
	const old = new Database(file);
	old.pragma('foreign_keys = ON');
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
