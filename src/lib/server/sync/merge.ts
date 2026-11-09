/*
 * A person's own rows on replay (offline phase 3): the later edit wins, field
 * by field. A replayed form writes its whole row back, so after the action
 * the fields the entry never changed get the server's value again, and a
 * field both sides changed keeps whichever change was MADE later: the entry's
 * made-at against that row's last change in `change_log`. A group's row is
 * the clash check's (`clash.ts`), never touched here.
 */
import { sql, type SQL } from 'drizzle-orm';
import type { Db } from '../db';
import { ownerOf } from '$lib/sync/owners';
import { SYNCED } from '$lib/sync/tables';
import type { CapturedRow, Row } from '$lib/sync/outbox';

export type ServerRowState = { before: Row | null; lastChangeAt: number | null };

/** Numbers and their text compare alike; undefined is null. */
function norm(v: unknown): string | number | null {
	if (v === null || v === undefined) return null;
	if (typeof v === 'number') return v;
	if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)) return Number(v);
	return String(v);
}
const same = (a: unknown, b: unknown) => norm(a) === norm(b);

/** PURE: the columns to put back after a replayed update of an own row. */
export function fieldsToRestore(
	device: { before: Row; after: Row },
	server: { before: Row; after: Row },
	lastChangeAt: number | null,
	madeAt: number
): Row {
	const out: Row = {};
	for (const c of Object.keys(server.after)) {
		if (!(c in server.before)) continue;
		const entryChanged = !same(device.before[c], device.after[c]);
		if (!entryChanged) {
			if (!same(server.after[c], server.before[c])) out[c] = server.before[c];
			continue;
		}
		const serverChangedSince = !same(server.before[c], device.before[c]);
		if (serverChangedSince && lastChangeAt !== null && lastChangeAt > madeAt) {
			out[c] = server.before[c];
		}
	}
	return out;
}

const ident = (name: string) => sql.identifier(name);

function columnsOf(db: Db, table: string): Map<string, string> {
	const info = db.all<{ name: string; type: string }>(
		sql`SELECT name, type FROM pragma_table_info(${table})`
	);
	return new Map(info.map((c) => [c.name, c.type.toUpperCase()]));
}

/** The WHERE for a row by its key string, names from the table's own columns; null when it cannot be read. */
function whereKey(db: Db, table: string, key: string): SQL | null {
	const keyCols = SYNCED[table];
	if (!keyCols) return null;
	const cols = columnsOf(db, table);
	let values: unknown[];
	if (keyCols.length === 1) {
		values = [cols.get(keyCols[0])?.startsWith('INT') ? Number(key) : key];
	} else {
		try {
			const parsed = JSON.parse(key);
			if (!Array.isArray(parsed) || parsed.length !== keyCols.length) return null;
			values = parsed;
		} catch {
			return null;
		}
	}
	if (!keyCols.every((k) => cols.has(k))) return null;
	return sql.join(
		keyCols.map((k, i) => sql`${ident(k)} = ${values[i]}`),
		sql` AND `
	);
}

function readRow(db: Db, table: string, key: string): Row | null {
	const where = whereKey(db, table, key);
	if (!where) return null;
	return db.get<Row | undefined>(sql`SELECT * FROM ${ident(table)} WHERE ${where}`) ?? null;
}

/** Before the action: each `u` row's server state and its last change_log time. Key: `${tbl}:${key}`. */
export function snapshotRows(db: Db, rows: CapturedRow[]): Map<string, ServerRowState> {
	const out = new Map<string, ServerRowState>();
	for (const r of rows) {
		if (r.op !== 'u' || !(r.tbl in SYNCED)) continue;
		const last = db.get<{ at: number | null }>(
			sql`SELECT max(at) AS at FROM change_log WHERE tbl = ${r.tbl} AND key = ${r.key}`
		);
		out.set(`${r.tbl}:${r.key}`, { before: readRow(db, r.tbl, r.key), lastChangeAt: last.at });
	}
	return out;
}

/** After the action: for own rows only (`ownerOf` on the server row is 'person'), writes fieldsToRestore back. Returns rows changed. */
export function restoreOwnFields(
	db: Db,
	rows: CapturedRow[],
	snap: Map<string, ServerRowState>,
	madeAt: number
): number {
	const parent = (table: string, id: number) =>
		db.get<Record<string, unknown> | undefined>(
			sql`SELECT * FROM ${ident(table)} WHERE id = ${id}`
		) ?? null;
	let changed = 0;
	for (const r of rows) {
		if (r.op !== 'u' || !r.before || !r.after) continue;
		const state = snap.get(`${r.tbl}:${r.key}`);
		if (!state?.before) continue;
		const now = readRow(db, r.tbl, r.key);
		if (!now) continue;
		if (ownerOf(r.tbl, now, parent) !== 'person') continue;
		const put = fieldsToRestore(
			{ before: r.before, after: r.after },
			{ before: state.before, after: now },
			state.lastChangeAt,
			madeAt
		);
		const cols = columnsOf(db, r.tbl);
		const names = Object.keys(put).filter((c) => cols.has(c));
		if (names.length === 0) continue;
		const where = whereKey(db, r.tbl, r.key);
		if (!where) continue;
		const set = sql.join(
			names.map((c) => sql`${ident(c)} = ${put[c]}`),
			sql`, `
		);
		db.run(sql`UPDATE ${ident(r.tbl)} SET ${set} WHERE ${where}`);
		changed++;
	}
	return changed;
}
