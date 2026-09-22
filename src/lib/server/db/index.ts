import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Open a database file and bring it up to the current schema.
 *
 * Migrations run here, synchronously, on every open — drizzle records what it
 * has applied, so this is a no-op on the common path, and a fresh box needs
 * nothing but the unit starting. The folder is resolved from the working
 * directory: the repo root in dev and tests, `/var/lib/salsa/app` on the
 * server, where deploy.sh ships `drizzle/` beside `build/`.
 */
export function openDb(path: string): Db {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const sqlite = new Database(path);
	// WAL: readers never block the writer, and the nightly `.backup` can run
	// against a live database.
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	sqlite.pragma('busy_timeout = 5000');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: resolve('drizzle') });
	return db;
}

let instance: Db | undefined;

/** The app's database, opened on first use from `DATABASE_PATH`. */
export function getDb(): Db {
	if (!instance) {
		if (!env.DATABASE_PATH) throw new Error('DATABASE_PATH is not set');
		instance = openDb(env.DATABASE_PATH);
	}
	return instance;
}
