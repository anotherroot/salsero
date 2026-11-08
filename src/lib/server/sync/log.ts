import { sql } from 'drizzle-orm';
import type { Db } from '../db';

/** How long the change log keeps a row. A device behind it re-pulls everything. */
export const LOG_KEEP_MS = 30 * 24 * 3600_000;

/** The newest `seq` ever written (`sqlite_sequence`, so a prune keeps it), else 0. */
export function logHead(db: Db): number {
	const row = db.get<{ seq: number } | undefined>(
		sql`SELECT seq FROM sqlite_sequence WHERE name = 'change_log'`
	);
	return row?.seq ?? 0;
}

/** The lowest `seq` still in the log, or null when it is empty. */
export function logOldest(db: Db): number | null {
	const row = db.get<{ s: number | null } | undefined>(sql`SELECT min(seq) AS s FROM change_log`);
	return row?.s ?? null;
}

/** The distinct (table, key) pairs changed after `cursor`. */
export function changedSince(db: Db, cursor: number): { tbl: string; key: string }[] {
	return db.all<{ tbl: string; key: string }>(
		sql`SELECT DISTINCT tbl, key FROM change_log WHERE seq > ${cursor} ORDER BY tbl, key`
	);
}

/**
 * Delete the rows before the first one newer than LOG_KEEP_MS; returns how
 * many. By `seq`, never by `at` alone: `at` is SQLite's clock, which can step
 * back, and a row pruned out of seq order would be a hole a device's cursor
 * walks past unseen. With no row that new, all go; the head stays in
 * `sqlite_sequence`.
 */
export function pruneChangeLog(db: Db, now: number): number {
	const cutoff = now - LOG_KEEP_MS;
	return db.run(
		sql`DELETE FROM change_log WHERE seq < coalesce((SELECT min(seq) FROM change_log WHERE at >= ${cutoff}), (SELECT max(seq) FROM change_log) + 1)`
	).changes;
}
