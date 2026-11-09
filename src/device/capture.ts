/*
 * What a write on the device changed (offline phase 3). While a device-first
 * write runs, triggers on every synced table copy each row it touches, before
 * and after, into `capture_rows`; the outbox entry carries them (the main
 * spec's `seen`), so the server can merge a person's own rows per field and
 * run a group's through the clash check. No form changes.
 *
 * The tables here are the device's own and never synced: `outbox` (the
 * entries on their way), `capture_rows` and `outbox_capture` (the switch the
 * triggers read). Their integer keys are local bookkeeping the server never
 * sees, so they do not mint ids (CLAUDE.md, "Every insert mints its id").
 * They live outside `schema.ts`: the server has no use for them.
 */
import { SYNCED } from '$lib/sync/tables';
import { foldCaptured, type CapturedRow, type Row } from '$lib/sync/outbox';
import type { SqliteDb } from './migrate';

const q = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** The key as the change log writes it: one column as text, several as a JSON array. */
function keyOf(row: 'NEW' | 'OLD', key: readonly string[]): string {
	if (key.length === 1) return `CAST(${row}.${q(key[0])} AS TEXT)`;
	return `json_array(${key.map((k) => `${row}.${q(k)}`).join(', ')})`;
}

function rowOf(row: 'NEW' | 'OLD', cols: readonly string[]): string {
	return `json_object(${cols.map((c) => `'${c.replaceAll("'", "''")}', ${row}.${q(c)}`).join(', ')})`;
}

const ON = 'EXISTS (SELECT 1 FROM outbox_capture)';

/** `<t>_cap_i`, `_u`, `_k` (an update that changes the key: a delete and an insert) and `_d`. */
export function captureTriggerSql(
	table: string,
	key: readonly string[],
	cols: readonly string[]
): string[] {
	const put = (op: 'i' | 'u' | 'd', before: string, after: string, k: string) =>
		`INSERT INTO capture_rows (tbl, key, op, before_json, after_json) VALUES ('${table}', ${k}, '${op}', ${before}, ${after});`;
	const t = q(table);
	const sameKey = `${keyOf('OLD', key)} IS ${keyOf('NEW', key)}`;
	return [
		`CREATE TRIGGER ${q(`${table}_cap_i`)} AFTER INSERT ON ${t} WHEN ${ON} BEGIN ${put('i', 'NULL', rowOf('NEW', cols), keyOf('NEW', key))} END`,
		`CREATE TRIGGER ${q(`${table}_cap_u`)} AFTER UPDATE ON ${t} WHEN ${ON} AND ${sameKey} BEGIN ${put('u', rowOf('OLD', cols), rowOf('NEW', cols), keyOf('NEW', key))} END`,
		`CREATE TRIGGER ${q(`${table}_cap_k`)} AFTER UPDATE ON ${t} WHEN ${ON} AND NOT (${sameKey}) BEGIN ${put('d', rowOf('OLD', cols), 'NULL', keyOf('OLD', key))} ${put('i', 'NULL', rowOf('NEW', cols), keyOf('NEW', key))} END`,
		`CREATE TRIGGER ${q(`${table}_cap_d`)} AFTER DELETE ON ${t} WHEN ${ON} BEGIN ${put('d', rowOf('OLD', cols), 'NULL', keyOf('OLD', key))} END`
	];
}

/**
 * The device-only tables, and every synced table's capture triggers rebuilt
 * from its columns now: at each open, so they always match the migrated schema.
 */
export function installCapture(db: SqliteDb): void {
	db.exec(`CREATE TABLE IF NOT EXISTS outbox (
		seq integer PRIMARY KEY AUTOINCREMENT,
		id text NOT NULL UNIQUE,
		user_id text NOT NULL,
		made_at integer NOT NULL,
		epoch integer NOT NULL,
		cls text NOT NULL,
		url text NOT NULL,
		method text NOT NULL,
		headers_json text NOT NULL,
		minted_json text NOT NULL,
		rows_json text NOT NULL,
		label_json text NOT NULL,
		body blob,
		state text NOT NULL,
		reason text,
		message text,
		detail_json text,
		held_by text
	)`);
	db.exec(`CREATE TABLE IF NOT EXISTS capture_rows (
		n integer PRIMARY KEY AUTOINCREMENT,
		tbl text NOT NULL,
		key text NOT NULL,
		op text NOT NULL,
		before_json text,
		after_json text
	)`);
	db.exec('CREATE TABLE IF NOT EXISTS outbox_capture (on_ integer NOT NULL)');
	db.exec('BEGIN');
	try {
		const old = db
			.prepare(
				"SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE '%\\_cap\\_%' ESCAPE '\\'"
			)
			.all() as { name: string }[];
		for (const { name } of old) db.exec(`DROP TRIGGER IF EXISTS ${q(name)}`);
		for (const [table, key] of Object.entries(SYNCED)) {
			const cols = (db.pragma(`table_info(${q(table)})`) as { name: string }[]).map((c) => c.name);
			if (cols.length === 0) continue;
			for (const stmt of captureTriggerSql(table, key, cols)) db.exec(stmt);
		}
		db.exec('COMMIT');
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
}

/** From here until `stopCapture`, every synced row a write touches is copied. */
export function startCapture(db: SqliteDb): void {
	db.exec('DELETE FROM capture_rows');
	db.exec('DELETE FROM outbox_capture');
	db.prepare('INSERT INTO outbox_capture (on_) VALUES (1)').run();
}

/** What was captured, folded per row; capturing stops and the copies are cleared. */
export function stopCapture(db: SqliteDb): CapturedRow[] {
	const raw = db
		.prepare('SELECT tbl, key, op, before_json, after_json FROM capture_rows ORDER BY n')
		.all() as {
		tbl: string;
		key: string;
		op: 'i' | 'u' | 'd';
		before_json: string | null;
		after_json: string | null;
	}[];
	db.exec('DELETE FROM outbox_capture');
	db.exec('DELETE FROM capture_rows');
	return foldCaptured(
		raw.map((r) => ({
			tbl: r.tbl,
			key: r.key,
			op: r.op,
			before: r.before_json === null ? null : (JSON.parse(r.before_json) as Row),
			after: r.after_json === null ? null : (JSON.parse(r.after_json) as Row)
		}))
	);
}
