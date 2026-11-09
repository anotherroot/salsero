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
import { keyString } from '$lib/sync/digest';
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

/**
 * Columns never put back: an order the action renumbers across rows (put back
 * on one row it would collide with its neighbours' unique slots).
 */
const NO_RESTORE = new Set(['position', 'warmup_order', 'sort_order']);

/** PURE: the columns to put back after a replayed update of an own row. */
export function fieldsToRestore(
	device: { before: Row; after: Row },
	server: { before: Row; after: Row },
	lastChangeAt: number | null,
	madeAt: number
): Row {
	const out: Row = {};
	for (const c of Object.keys(server.after)) {
		if (!(c in server.before) || NO_RESTORE.has(c)) continue;
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
		try {
			db.run(sql`UPDATE ${ident(r.tbl)} SET ${set} WHERE ${where}`);
			changed++;
		} catch (e) {
			// The action's value stands; one row that cannot take the server's back never refuses the entry.
			console.warn(`[sync] merge: ${r.tbl} ${r.key} kept as replayed`, String(e));
		}
	}
	return changed;
}

/**
 * Sets of rows an action replaces whole from its form (a figure's Starts in and
 * Ends in): the parent they hang on. A stale form would otherwise delete what
 * the PC added since, or put back what it removed; rows the entry itself added
 * or removed stay as it made them.
 */
const CHILD_SETS: Record<string, { col: string; parent: string }> = {
	figure_start_positions: { col: 'figure_id', parent: 'figures' },
	figure_end_positions: { col: 'figure_id', parent: 'figures' }
};

/** table → parent id → the server's rows before the action. */
export type SetSnapshot = Map<string, Map<number, Row[]>>;

const childRows = (db: Db, table: string, col: string, parentId: number): Row[] =>
	db.all<Row>(sql`SELECT * FROM ${ident(table)} WHERE ${ident(col)} = ${parentId}`);

/** The parents an entry touched (their row, or a row of their set), each set's rows now. */
export function snapshotSets(db: Db, rows: CapturedRow[]): SetSnapshot {
	const out: SetSnapshot = new Map();
	for (const [table, { col, parent }] of Object.entries(CHILD_SETS)) {
		const parents = new Set<number>();
		for (const r of rows) {
			if (r.tbl === parent) {
				const id = Number(r.key);
				if (Number.isInteger(id)) parents.add(id);
			} else if (r.tbl === table) {
				const id = (r.after ?? r.before)?.[col];
				if (typeof id === 'number') parents.add(id);
			}
		}
		if (parents.size === 0) continue;
		out.set(table, new Map([...parents].map((id) => [id, childRows(db, table, col, id)])));
	}
	return out;
}

/** After the action, on a person's own parents only: their sets as the server had them, plus the entry's own changes. */
export function restoreOwnSets(db: Db, rows: CapturedRow[], snap: SetSnapshot): number {
	const parentRow = (table: string, id: number) =>
		db.get<Record<string, unknown> | undefined>(
			sql`SELECT * FROM ${ident(table)} WHERE id = ${id}`
		) ?? null;
	let changed = 0;
	for (const [table, byParent] of snap) {
		const { col, parent } = CHILD_SETS[table];
		const key = SYNCED[table];
		const keyOf = (row: Row) => keyString(key.map((k) => row[k]));
		const added = new Set(rows.filter((r) => r.tbl === table && r.op === 'i').map((r) => r.key));
		const removed = new Set(rows.filter((r) => r.tbl === table && r.op === 'd').map((r) => r.key));
		const cols = columnsOf(db, table);
		for (const [parentId, before] of byParent) {
			const owner = parentRow(parent, parentId);
			if (!owner || ownerOf(parent, owner, parentRow) !== 'person') continue;
			const now = childRows(db, table, col, parentId);
			const nowKeys = new Set(now.map(keyOf));
			const beforeKeys = new Set(before.map(keyOf));
			try {
				for (const row of before) {
					const k = keyOf(row);
					if (nowKeys.has(k) || removed.has(k)) continue;
					const names = Object.keys(row).filter((c) => cols.has(c));
					db.run(
						sql`INSERT INTO ${ident(table)} (${sql.join(
							names.map((c) => ident(c)),
							sql`, `
						)}) VALUES (${sql.join(
							names.map((c) => sql`${row[c]}`),
							sql`, `
						)})`
					);
					changed++;
				}
				for (const row of now) {
					const k = keyOf(row);
					if (beforeKeys.has(k) || added.has(k)) continue;
					const where = sql.join(
						key.map((c) => sql`${ident(c)} = ${row[c]}`),
						sql` AND `
					);
					db.run(sql`DELETE FROM ${ident(table)} WHERE ${where}`);
					changed++;
				}
			} catch (e) {
				console.warn(`[sync] merge: ${table} of ${parent} ${parentId} kept as replayed`, String(e));
			}
		}
	}
	return changed;
}
