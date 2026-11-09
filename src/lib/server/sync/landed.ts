/*
 * Outbox entries the server has replayed (offline phase 3): a resent entry (a
 * lost answer, a retry, two tabs) answers "landed" and never runs twice.
 */
import { and, eq, lt } from 'drizzle-orm';
import type { Db } from '../db';
import { syncLanded } from '../db/schema';

/** How long a landed entry's id is remembered: far longer than any device stays offline. */
export const LANDED_KEEP_MS = 180 * 24 * 3600_000;

export function isLanded(db: Db, entryId: string, userId: string): boolean {
	return !!db
		.select({ id: syncLanded.entryId })
		.from(syncLanded)
		.where(and(eq(syncLanded.entryId, entryId), eq(syncLanded.userId, userId)))
		.get();
}

export function markLanded(db: Db, entryId: string, userId: string, now: number): void {
	db.insert(syncLanded).values({ entryId, userId, landedAt: now }).onConflictDoNothing().run();
}

/** Forgets entries that landed more than `LANDED_KEEP_MS` ago; how many. */
export function pruneLanded(db: Db, now: number): number {
	return db
		.delete(syncLanded)
		.where(lt(syncLanded.landedAt, now - LANDED_KEEP_MS))
		.run().changes;
}
