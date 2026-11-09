/*
 * The device's outbox (offline phase 3): the changes made here, in order,
 * until the server has them. Every query takes the person: a previous
 * person's entries (signed out with changes waiting, then someone else signed
 * in) are kept aside, never counted, listed or sent, until that person signs
 * in here again.
 */
import type { ClashInfo, GoneInfo } from '$lib/clash/clash';
import type { OutboxItem, OutboxSummary } from '$lib/offline/protocol';
import {
	PUSH_BATCH,
	PUSH_MAX_BYTES,
	base64Of,
	bodyFields,
	heldBy,
	queuedMarks,
	type CapturedRow,
	type EntryLabel,
	type EntryResult,
	type RefusalReason,
	type WireEntry
} from '$lib/sync/outbox';
import { readMeta, type SqliteDb } from './migrate';

export type OutboxRow = {
	seq: number;
	id: string;
	userId: string;
	madeAt: number;
	epoch: number;
	cls: 'device' | 'queued';
	url: string;
	method: string;
	headers: [string, string][];
	body: Uint8Array | null;
	minted: Record<string, number[]>;
	rows: CapturedRow[];
	label: EntryLabel;
	state: 'waiting' | 'sending' | 'refused' | 'held';
	reason: RefusalReason | null;
	message: string | null;
	clash: ClashInfo | null;
	gone: GoneInfo | null;
	heldBy: string | null;
};
export type NewEntry = Omit<
	OutboxRow,
	'seq' | 'state' | 'reason' | 'message' | 'clash' | 'gone' | 'heldBy'
>;

type Raw = {
	seq: number;
	id: string;
	user_id: string;
	made_at: number;
	epoch: number;
	cls: string;
	url: string;
	method: string;
	headers_json: string;
	minted_json: string;
	rows_json: string;
	label_json: string;
	body: Uint8Array | null;
	state: string;
	reason: string | null;
	message: string | null;
	detail_json: string | null;
	held_by: string | null;
};

function rowOf(r: Raw): OutboxRow {
	const detail = r.detail_json
		? (JSON.parse(r.detail_json) as { clash: ClashInfo | null; gone: GoneInfo | null })
		: { clash: null, gone: null };
	return {
		seq: r.seq,
		id: r.id,
		userId: r.user_id,
		madeAt: r.made_at,
		epoch: r.epoch,
		cls: r.cls as OutboxRow['cls'],
		url: r.url,
		method: r.method,
		headers: JSON.parse(r.headers_json) as [string, string][],
		body: r.body === null ? null : new Uint8Array(r.body),
		minted: JSON.parse(r.minted_json) as Record<string, number[]>,
		rows: JSON.parse(r.rows_json) as CapturedRow[],
		label: JSON.parse(r.label_json) as EntryLabel,
		state: r.state as OutboxRow['state'],
		reason: r.reason as RefusalReason | null,
		message: r.message,
		clash: detail.clash,
		gone: detail.gone,
		heldBy: r.held_by
	};
}

const all = (db: SqliteDb, where: string, ...params: unknown[]): OutboxRow[] =>
	(db.prepare(`SELECT * FROM outbox WHERE ${where} ORDER BY seq`).all(...params) as Raw[]).map(
		rowOf
	);

export function recordEntry(db: SqliteDb, e: NewEntry): number {
	db.prepare(
		`INSERT INTO outbox (id, user_id, made_at, epoch, cls, url, method, headers_json, minted_json, rows_json, label_json, body, state)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting')`
	).run(
		e.id,
		e.userId,
		e.madeAt,
		e.epoch,
		e.cls,
		e.url,
		e.method,
		JSON.stringify(e.headers),
		JSON.stringify(e.minted),
		JSON.stringify(e.rows),
		JSON.stringify(e.label),
		e.body
	);
	const row = db.prepare('SELECT seq FROM outbox WHERE id = ?').get(e.id) as { seq: number };
	return row.seq;
}

const sizeOf = (r: OutboxRow) => (r.body?.length ?? 0) + JSON.stringify(r.rows).length;

/** The next batch to send: waiting entries by seq, at most PUSH_BATCH and PUSH_MAX_BYTES (at least one). */
export function toSend(db: SqliteDb, userId: string): OutboxRow[] {
	const out: OutboxRow[] = [];
	let bytes = 0;
	for (const r of all(db, "user_id = ? AND state = 'waiting'", userId)) {
		if (out.length >= PUSH_BATCH) break;
		const size = sizeOf(r);
		if (out.length > 0 && bytes + size > PUSH_MAX_BYTES) break;
		out.push(r);
		bytes += size;
	}
	return out;
}

export function setStates(db: SqliteDb, ids: string[], state: 'waiting' | 'sending'): void {
	const stmt = db.prepare('UPDATE outbox SET state = ? WHERE id = ?');
	for (const id of ids) stmt.run(state, id);
}

/** Every waiting entry that now depends on a refused one becomes held, and a held one whose root is gone waits again. */
function recomputeHeld(db: SqliteDb, userId: string): void {
	const rows = all(db, "user_id = ? AND state IN ('waiting', 'held', 'refused')", userId);
	const refused = new Set(rows.filter((r) => r.state === 'refused').map((r) => r.id));
	const held = heldBy(rows, refused);
	const set = db.prepare('UPDATE outbox SET state = ?, held_by = ? WHERE id = ?');
	for (const r of rows) {
		if (r.state === 'refused') continue;
		const root = held.get(r.id);
		if (root !== undefined && (r.state !== 'held' || r.heldBy !== root))
			set.run('held', root, r.id);
		if (root === undefined && r.state === 'held') set.run('waiting', null, r.id);
	}
}

export function applyResults(
	db: SqliteDb,
	userId: string,
	results: EntryResult[]
): { landed: number } {
	let landed = 0;
	db.exec('BEGIN');
	try {
		for (const r of results) {
			if (r.state === 'landed') {
				landed += Number(
					(
						db.prepare('DELETE FROM outbox WHERE id = ? AND user_id = ?').run(r.id, userId) as {
							changes: number;
						}
					).changes > 0
				);
			} else if (r.state === 'refused') {
				db.prepare(
					`UPDATE outbox SET state = 'refused', reason = ?, message = ?, detail_json = ?, held_by = NULL WHERE id = ? AND user_id = ?`
				).run(r.reason, r.message, JSON.stringify({ clash: r.clash, gone: r.gone }), r.id, userId);
			} else if (r.state === 'held') {
				db.prepare(
					`UPDATE outbox SET state = 'held', held_by = ? WHERE id = ? AND user_id = ?`
				).run(r.heldBy, r.id, userId);
			} else {
				db.prepare(`UPDATE outbox SET state = 'waiting' WHERE id = ? AND user_id = ?`).run(
					r.id,
					userId
				);
			}
		}
		recomputeHeld(db, userId);
		db.exec('COMMIT');
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	}
	return { landed };
}

/** After a restart nothing is on its way: what was being sent waits again. */
export function resetSending(db: SqliteDb): void {
	db.exec("UPDATE outbox SET state = 'waiting' WHERE state = 'sending'");
}

export function outboxSummary(db: SqliteDb, userId: string | null): OutboxSummary {
	const meta = new Map(
		(
			db.prepare('SELECT key, value FROM device_meta').all() as { key: string; value: string }[]
		).map((r) => [r.key, r.value])
	);
	const lastSyncedAt = meta.has('lastSyncedAt') ? Number(meta.get('lastSyncedAt')) : null;
	const signedOut = meta.get('signedOut') === '1';
	const empty: OutboxSummary = {
		waiting: 0,
		oldestWaitingAt: null,
		refused: 0,
		held: 0,
		signedOut,
		lastSyncedAt,
		seq: 0,
		queued: {},
		epochs: []
	};
	if (userId === null) return empty;
	const rows = all(db, 'user_id = ?', userId);
	const waiting = rows.filter((r) => r.state === 'waiting' || r.state === 'sending');
	const queued: Record<string, number> = {};
	for (const r of waiting) {
		if (r.cls !== 'queued') continue;
		for (const mark of queuedMarks(r.rows)) queued[mark] ??= r.madeAt;
	}
	return {
		...empty,
		waiting: waiting.length,
		oldestWaitingAt: waiting.length ? Math.min(...waiting.map((r) => r.madeAt)) : null,
		refused: rows.filter((r) => r.state === 'refused').length,
		held: rows.filter((r) => r.state === 'held').length,
		seq: newestSeq(db),
		queued,
		epochs: [...new Set(waiting.map((r) => r.epoch))].sort((a, b) => a - b)
	};
}

/**
 * The newest seq ever handed out, landed or not: a high-water mark. A landed
 * entry is deleted at once, so the max of the rows left would fall back, and
 * the service worker's "this page wrote seq N" would then outlive the landing.
 */
function newestSeq(db: SqliteDb): number {
	const row = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'outbox'").get() as
		{ seq: number } | undefined;
	return row?.seq ?? 0;
}

export async function outboxItems(db: SqliteDb, userId: string): Promise<OutboxItem[]> {
	const rows = all(db, 'user_id = ?', userId);
	const dependents = new Map<string, number>();
	for (const r of rows) {
		if (r.heldBy) dependents.set(r.heldBy, (dependents.get(r.heldBy) ?? 0) + 1);
	}
	return Promise.all(
		rows.map(async (r) => ({
			id: r.id,
			seq: r.seq,
			state: r.state,
			madeAt: r.madeAt,
			url: r.url,
			label: r.label,
			reason: r.reason,
			message: r.message,
			clash: r.clash,
			gone: r.gone,
			heldBy: r.heldBy,
			dependents: dependents.get(r.id) ?? 0,
			fields: await bodyFields(
				r.headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? null,
				r.body
			)
		}))
	);
}

/** A refused entry and those held by it wait again; how many. */
export function retryEntry(db: SqliteDb, userId: string, id: string): number {
	const res = db
		.prepare(
			`UPDATE outbox SET state = 'waiting', reason = NULL, message = NULL, detail_json = NULL, held_by = NULL
			 WHERE user_id = ? AND (id = ? OR held_by = ?)`
		)
		.run(userId, id, id) as { changes: number };
	return res.changes;
}

/** A refused entry and those held by it are dropped; how many. */
export function discardEntry(db: SqliteDb, userId: string, id: string): number {
	const res = db
		.prepare('DELETE FROM outbox WHERE user_id = ? AND (id = ? OR held_by = ?)')
		.run(userId, id, id) as { changes: number };
	return res.changes;
}

/**
 * A clash settled on the Sync page (Mine sent again and landed, or Theirs
 * kept): that entry goes, and those held by it wait again. Returns 1 when it
 * was there.
 */
export function resolveEntry(db: SqliteDb, userId: string, id: string): number {
	db.prepare(
		`UPDATE outbox SET state = 'waiting', reason = NULL, message = NULL, detail_json = NULL, held_by = NULL
		 WHERE user_id = ? AND held_by = ?`
	).run(userId, id);
	const res = db.prepare('DELETE FROM outbox WHERE user_id = ? AND id = ?').run(userId, id) as {
		changes: number;
	};
	return res.changes;
}

/** Every entry of that person (Sign out, confirmed). */
export function forgetPerson(db: SqliteDb, userId: string): void {
	db.prepare('DELETE FROM outbox WHERE user_id = ?').run(userId);
}

export function toWire(row: OutboxRow): WireEntry {
	return {
		id: row.id,
		madeAt: row.madeAt,
		epoch: row.epoch,
		url: row.url,
		method: row.method,
		headers: row.headers,
		body: row.body === null ? null : base64Of(row.body),
		minted: row.minted,
		rows: row.rows
	};
}

/** Whose copy this is, for callers that have only the database. */
export const copyPerson = (db: SqliteDb): string | null => readMeta(db).userId;
