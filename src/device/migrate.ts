/*
 * The device's database schema (offline phase 2). The same drizzle migrations
 * the server runs, applied by tag through any better-sqlite3-shaped db: the
 * phone's SQLite WASM shim, or better-sqlite3 in a spec. The device keeps its
 * own bookkeeping in `device_migrations` and `device_meta`; neither is synced.
 */

/** The slice of better-sqlite3's API the device code uses (the shim provides the same). */
export type SqliteDb = {
	prepare(sql: string): {
		run(...params: unknown[]): unknown;
		get(...params: unknown[]): unknown;
		all(...params: unknown[]): unknown[];
	};
	exec(sql: string): unknown;
	pragma(source: string, opts?: { simple?: boolean }): unknown;
};

export type Migration = { tag: string; sql: string };

export type DeviceMeta = {
	userId: string | null;
	cursor: number;
	schema: string | null;
	cookies: Record<string, string>;
	/** The next pull must replace every table: nothing pulled yet, or the schema just changed. */
	full: boolean;
	/** This browser database's key (offline phase 3): kept through a wipe. */
	deviceKey: string | null;
	/** Its id slot, from the server; kept through a wipe. */
	slot: number | null;
};

const BREAKPOINT = '--> statement-breakpoint';

export function readMeta(db: SqliteDb): DeviceMeta {
	const rows = db.prepare('SELECT key, value FROM device_meta').all() as {
		key: string;
		value: string;
	}[];
	const m = new Map(rows.map((r) => [r.key, r.value]));
	return {
		userId: m.get('userId') ?? null,
		cursor: Number(m.get('cursor') ?? 0),
		schema: m.get('schema') ?? null,
		cookies: m.has('cookies') ? (JSON.parse(m.get('cookies')!) as Record<string, string>) : {},
		// A copy that was never pulled, or was wiped, has nothing to be incremental over.
		full: m.has('full') ? m.get('full') === '1' : true,
		deviceKey: m.get('deviceKey') ?? null,
		slot: m.has('slot') ? Number(m.get('slot')) : null
	};
}

export function writeMetaValue(db: SqliteDb, key: string, value: string): void {
	db.prepare(
		'INSERT INTO device_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
	).run(key, value);
}

/** Applies the migrations whose tag is absent, in order; returns how many it applied. */
export function migrateDevice(db: SqliteDb, migrations: Migration[]): number {
	db.exec(
		'CREATE TABLE IF NOT EXISTS device_migrations (tag text PRIMARY KEY NOT NULL);' +
			'CREATE TABLE IF NOT EXISTS device_meta (key text PRIMARY KEY NOT NULL, value text NOT NULL);'
	);
	const done = new Set(
		(db.prepare('SELECT tag FROM device_migrations').all() as { tag: string }[]).map((r) => r.tag)
	);
	let applied = 0;
	for (const m of migrations) {
		if (done.has(m.tag)) continue;
		db.exec('BEGIN');
		try {
			for (const part of m.sql.split(BREAKPOINT)) {
				if (part.trim()) db.exec(part);
			}
			db.prepare('INSERT INTO device_migrations (tag) VALUES (?)').run(m.tag);
			db.exec('COMMIT');
		} catch (e) {
			db.exec('ROLLBACK');
			throw e;
		}
		applied++;
	}
	// A schema change on the device means one full pull.
	if (applied > 0) writeMetaValue(db, 'full', '1');
	return applied;
}
