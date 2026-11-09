/*
 * The device's copy of one person's rows (offline phase 2): applying a pull,
 * wiping the copy, and building the next pull request. Any better-sqlite3-
 * shaped db. Foreign keys are off while a pull lands: the scope is not closed
 * over them (a row can point at one the person never reads), and an upsert
 * must keep a row's children, which `INSERT OR REPLACE` would cascade away.
 */
import { SYNCED } from '$lib/sync/tables';
import { digestInput, keyString } from '$lib/sync/digest';
import type { PullRequest, PullResponse } from '$lib/sync/wire';
import { readMeta, writeMetaValue, type SqliteDb } from './migrate';

const q = (name: string) => `"${name.replaceAll('"', '""')}"`;

function deviceColumns(db: SqliteDb, table: string): string[] {
	const info = db.pragma(`table_info(${q(table)})`) as { name: string }[];
	return info.map((c) => c.name);
}

/** Empties the synced tables and the meta; never removes the database file. The device key and slot stay: they are the database's, not a person's. */
export function wipeCopy(db: SqliteDb): void {
	db.pragma('foreign_keys = OFF');
	db.exec('BEGIN');
	try {
		for (const t of Object.keys(SYNCED)) db.exec(`DELETE FROM ${q(t)}`);
		db.exec("DELETE FROM device_meta WHERE key NOT IN ('deviceKey', 'slot')");
		db.exec('COMMIT');
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	} finally {
		db.pragma('foreign_keys = ON');
	}
}

function upsertSql(table: string, cols: string[]): string {
	const key = SYNCED[table];
	const missing = key.filter((k) => !cols.includes(k));
	if (missing.length) throw new Error(`pull for ${table} lacks key column ${missing.join(', ')}`);
	const insert = `INSERT INTO ${q(table)} (${cols.map(q).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
	const rest = cols.filter((c) => !key.includes(c));
	const on = `ON CONFLICT(${key.map(q).join(', ')})`;
	return rest.length
		? `${insert} ${on} DO UPDATE SET ${rest.map((c) => `${q(c)} = excluded.${q(c)}`).join(', ')}`
		: `${insert} ${on} DO NOTHING`;
}

export function applyPull(db: SqliteDb, res: PullResponse): void {
	const before = readMeta(db);
	if (before.userId !== null && before.userId !== res.userId) wipeCopy(db);

	db.pragma('foreign_keys = OFF');
	db.exec('BEGIN');
	try {
		for (const t of res.full) {
			if (t in SYNCED) db.exec(`DELETE FROM ${q(t)}`);
		}
		for (const [table, { cols, rows }] of Object.entries(res.changed)) {
			if (!(table in SYNCED)) continue;
			// Names come from the device's own table, never from the wire.
			const have = deviceColumns(db, table);
			if (have.length === 0) throw new Error(`the device has no table ${table}`);
			const keep = cols.map((c, i) => [c, i] as const).filter(([c]) => have.includes(c));
			const stmt = db.prepare(
				upsertSql(
					table,
					keep.map(([c]) => c)
				)
			);
			for (const row of rows) {
				if (row.length !== cols.length) {
					throw new Error(`a row of ${table} has ${row.length} values for ${cols.length} columns`);
				}
				stmt.run(...keep.map(([, i]) => row[i]));
			}
		}
		// The device logs nothing in phase 2.
		db.exec('DELETE FROM change_log');
		writeMetaValue(db, 'userId', res.userId);
		writeMetaValue(db, 'cursor', String(res.cursor));
		writeMetaValue(db, 'schema', res.schema);
		writeMetaValue(db, 'cookies', JSON.stringify(res.cookies));
		writeMetaValue(db, 'full', '0');
		if (res.slot !== undefined) writeMetaValue(db, 'slot', String(res.slot));
		db.exec('COMMIT');
	} catch (e) {
		try {
			db.exec('ROLLBACK');
		} catch {
			/* the transaction is already gone */
		}
		db.pragma('foreign_keys = ON');
		// An incremental pull can fail for good (a non-key unique index that two swapped
		// rows trip over) and the cursor did not move, so it would be sent again and fail
		// again. A full pull deletes before it inserts and cannot conflict: ask for that one.
		try {
			writeMetaValue(db, 'full', '1');
		} catch {
			/* the database itself is failing; the original error is the one to report */
		}
		throw e;
	}
	db.pragma('foreign_keys = ON');
}

async function sha256Hex(text: string): Promise<string> {
	const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The digest of every synced table's keys: what the server's `serverDigest` takes over its scope. */
export async function deviceDigests(db: SqliteDb): Promise<Record<string, string>> {
	const out: Record<string, string> = {};
	for (const [table, key] of Object.entries(SYNCED)) {
		const rows = db.prepare(`SELECT ${key.map(q).join(', ')} FROM ${q(table)}`).all() as Record<
			string,
			unknown
		>[];
		out[table] = await sha256Hex(digestInput(rows.map((r) => keyString(key.map((k) => r[k])))));
	}
	return out;
}

/**
 * The next pull: everything after a migration or a wipe, changes (with
 * digests) otherwise. It says whose copy it is: the server starts over for
 * anyone else.
 */
export async function pullRequestOf(db: SqliteDb, schema: string): Promise<PullRequest> {
	const meta = readMeta(db);
	const userId = meta.userId;
	const req: PullRequest = { cursor: meta.cursor, schema, userId };
	if (meta.deviceKey !== null) req.device = meta.deviceKey;
	if (!meta.full) req.digests = await deviceDigests(db);
	return req;
}

/** This database's key, written the first time (offline phase 3): the server keys its id slot on it. */
export function ensureDeviceKey(db: SqliteDb, newKey: () => string): string {
	const have = readMeta(db).deviceKey;
	if (have !== null) return have;
	const key = newKey();
	writeMetaValue(db, 'deviceKey', key);
	return key;
}
