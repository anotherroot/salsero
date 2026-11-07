/**
 * Keep in step settings, per copy (`clone_sync`). A missing row reads the
 * defaults. Only someone who may edit the copy changes them. A setting, not
 * content: it is not logged in History.
 */
import { and, eq } from 'drizzle-orm';
import { DEFAULT_SYNC } from '$lib/clones/sync';
import type { CloneKind, SyncSettings } from '$lib/types';
import type { Db } from '../db';
import { cloneSync } from '../db/schema';
import { accessTo } from './genes';

export function syncSettingsOf(db: Db, kind: CloneKind, id: number): SyncSettings {
	const row = db
		.select()
		.from(cloneSync)
		.where(and(eq(cloneSync.kind, kind), eq(cloneSync.rowId, id)))
		.get();
	if (!row) return { ...DEFAULT_SYNC };
	return {
		on: row.on,
		names: row.names,
		small: row.small,
		sections: row.sections,
		media: row.media
	};
}

/** Writes the settings; false (nothing written) unless `actorId` may edit the copy. */
export function setSyncSettings(
	db: Db,
	actorId: string,
	kind: CloneKind,
	id: number,
	s: SyncSettings,
	now: number
): boolean {
	if (accessTo(db, actorId, kind, id) !== 'edit') return false;
	const values = {
		on: s.on,
		names: s.names,
		small: s.small,
		sections: s.sections,
		media: s.media,
		at: now
	};
	db.insert(cloneSync)
		.values({ kind, rowId: id, ...values })
		.onConflictDoUpdate({ target: [cloneSync.kind, cloneSync.rowId], set: values })
		.run();
	return true;
}
