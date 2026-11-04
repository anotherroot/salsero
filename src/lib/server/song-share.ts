/**
 * A group's songs, the class playlist: Share with the class, Stop sharing,
 * Delete (to Recently deleted) and Restore. Each is a group mutation, logged
 * in History in its own transaction.
 *
 * Stop sharing and Delete take the song off every member's practice entry
 * that used it (`reconcileEntries`, which records each drop); Share again
 * and Restore put it back on exactly those entries (`reviveSongDrops`),
 * unless the person picked another song since. They warn, they do not
 * refuse: a group song is the teacher's to withdraw (`songUsers` says how
 * many people it reaches).
 */
import { and, countDistinct, eq, isNotNull, isNull } from 'drizzle-orm';
import type { Db } from './db';
import { exercises, songs, type Song } from './db/schema';
import { logChange } from './changes';
import { reconcileEntries, reviveSongDrops } from './entries';
import { roleOf } from './teams';
import type { TeamSpace } from './scope';
import type { ArchiveRestore } from './trash';

/** What History files a song's change under. */
const ofSong = (id: number) => ({ rootKind: 'song' as const, rootId: id, subject: 'song' });

/** This group's song, when the one acting edits the group; else null. */
function editable(tx: Db, space: TeamSpace, id: number): Song | null {
	const role = roleOf(tx, space.actorId, space.teamId);
	if (role !== 'owner' && role !== 'editor') return null;
	const song = tx.select().from(songs).where(eq(songs.id, id)).get();
	if (!song || song.teamId !== space.teamId || song.dance !== space.dance) return null;
	return song;
}

/**
 * Share with the class: every member sees it, and the entries an earlier
 * Stop sharing took it from have it back. Only a ready song, not deleted.
 * Sharing a shared song changes nothing.
 */
export function shareSong(db: Db, space: TeamSpace, id: number, now: number): boolean {
	return db.transaction((tx) => {
		const song = editable(tx, space, id);
		if (!song || song.archivedAt !== null || song.status !== 'ready') return false;
		if (song.sharedAt !== null) return true;
		tx.update(songs).set({ sharedAt: now }).where(eq(songs.id, id)).run();
		reviveSongDrops(tx, id);
		logChange(tx, space, { ...ofSong(id), verb: 'share', after: { name: song.title } }, now);
		return true;
	});
}

/**
 * Stop sharing: back to a draft only editors see. Members' entries that used
 * it fall back to the count. Null for a song not this group's to edit, or
 * one deleted.
 */
export function unshareSong(
	db: Db,
	space: TeamSpace,
	id: number,
	now: number
): { ok: true } | null {
	return db.transaction((tx) => {
		const song = editable(tx, space, id);
		if (!song || song.archivedAt !== null) return null;
		if (song.sharedAt === null) return { ok: true as const };
		tx.update(songs).set({ sharedAt: null }).where(eq(songs.id, id)).run();
		reconcileEntries(tx, space.teamId, now);
		logChange(tx, space, { ...ofSong(id), verb: 'unshare', after: { name: song.title } }, now);
		return { ok: true as const };
	});
}

/**
 * Delete a group's song: archived, so it shows in Recently deleted (the file
 * stays) until Restore. Entries that used it fall back to the count.
 */
export function deleteGroupSong(db: Db, space: TeamSpace, id: number, now: number): boolean {
	return db.transaction((tx) => {
		const song = editable(tx, space, id);
		if (!song || song.archivedAt !== null) return false;
		tx.update(songs).set({ archivedAt: now }).where(eq(songs.id, id)).run();
		reconcileEntries(tx, space.teamId, now);
		logChange(tx, space, { ...ofSong(id), verb: 'delete', after: { name: song.title } }, now);
		return true;
	});
}

/**
 * Restore a deleted group song (Recently deleted), and give it back to the
 * entries its removal took it from, when it is shared.
 */
export function restoreSong(db: Db, space: TeamSpace, id: number, now: number): ArchiveRestore {
	return db.transaction((tx) => {
		const song = editable(tx, space, id);
		if (!song || song.archivedAt === null) return { ok: false, reason: 'gone' } as const;
		tx.update(songs).set({ archivedAt: null }).where(eq(songs.id, id)).run();
		reviveSongDrops(tx, id);
		logChange(tx, space, { ...ofSong(id), verb: 'restore', after: { name: song.title } }, now);
		return { ok: true } as const;
	});
}

/** How many people's live practice entries use the song: Stop sharing's and Delete's warning. */
export function songUsers(db: Db, songId: number): number {
	return (
		db
			.select({ n: countDistinct(exercises.userId) })
			.from(exercises)
			.where(
				and(eq(exercises.songId, songId), isNotNull(exercises.userId), isNull(exercises.archivedAt))
			)
			.get()?.n ?? 0
	);
}
