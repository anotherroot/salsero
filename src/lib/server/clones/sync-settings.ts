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

/** The six kinds a copy can be: `clone_sync.kind` has no CHECK, so a write asks here. */
export const CLONE_KINDS: readonly CloneKind[] = [
	'figure',
	'routine',
	'drill',
	'song',
	'lesson',
	'position'
];

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

/** Writes the settings; false (nothing written) unless `kind` is a copy's and `actorId` may edit it. */
export function setSyncSettings(
	db: Db,
	actorId: string,
	kind: CloneKind,
	id: number,
	s: SyncSettings,
	now: number
): boolean {
	if (!CLONE_KINDS.includes(kind) || accessTo(db, actorId, kind, id) !== 'edit') return false;
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
