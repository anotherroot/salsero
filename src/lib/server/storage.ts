/**
 * What a person or a group has on disk, and whether one more upload fits.
 *
 * Used is computed from the size columns on every ask, never stored as a
 * running total. Archived parents count: archiving keeps the files. A saved
 * YouTube video counts once it has become a recording or a lesson video.
 *
 * A group's files are the group's: an upload into a group's lesson or figure
 * is charged to and limited by the group, never the person who sent it. Over
 * every limit sits the disk floor: no upload may leave the server with less
 * than `DISK_FLOOR_BYTES` free, since limits can add up past the disk.
 */
import { stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { and, count, eq, isNotNull, isNull, sum } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { byteSize, plural } from '$lib/format';
import { DISK_FLOOR_BYTES, TEAM_BYTES_PER_PERSON } from '$lib/limits';
import type { StorageItem } from '$lib/types';
import type { Db } from './db';
import { audioDir } from './files';
import {
	appFlags,
	countTakes,
	figureGroups,
	figures,
	lessons,
	lessonVideos,
	recordings,
	songs,
	storageRequests,
	teamMembers,
	teams,
	teamTrash,
	users
} from './db/schema';

function total(value: string | number | null | undefined): number {
	return Number(value ?? 0);
}

/** Who a file is charged to: a person, or a group. */
export type Owner = { userId: string } | { teamId: number };

/** The owner of a root row (a lesson, a figure): its group's when it has one. */
export function ownerOfRow(row: { userId: string | null; teamId: number | null }): Owner {
	return row.teamId !== null ? { teamId: row.teamId } : { userId: row.userId ?? '' };
}

/** Who a lesson's or a figure's files are charged to; null when it is gone. */
export function ownerOfTarget(
	db: Db,
	target: { lessonId: number } | { figureId: number }
): Owner | null {
	const row =
		'figureId' in target
			? db
					.select({ userId: figures.userId, teamId: figures.teamId })
					.from(figures)
					.where(eq(figures.id, target.figureId))
					.get()
			: db
					.select({ userId: lessons.userId, teamId: lessons.teamId })
					.from(lessons)
					.where(eq(lessons.id, target.lessonId))
					.get();
	return row ? ownerOfRow(row) : null;
}

/** A person's own files. A group's rows carry no `user_id`, so they never count here. */
export function usedBytes(db: Db, userId: string): number {
	const recs = db
		.select({ t: sum(recordings.sizeBytes) })
		.from(recordings)
		.innerJoin(figures, eq(figures.id, recordings.figureId))
		.where(and(eq(figures.userId, userId), isNull(figures.teamId)))
		.get();
	const vids = db
		.select({ t: sum(lessonVideos.sizeBytes) })
		.from(lessonVideos)
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(and(eq(lessons.userId, userId), isNull(lessons.teamId)))
		.get();
	const sg = db
		.select({ t: sum(songs.sizeBytes) })
		.from(songs)
		.where(eq(songs.userId, userId))
		.get();
	const tk = db
		.select({ t: sum(countTakes.sizeBytes) })
		.from(countTakes)
		.where(eq(countTakes.userId, userId))
		.get();
	return total(recs?.t) + total(vids?.t) + total(sg?.t) + total(tk?.t);
}

/**
 * A group's files: its recordings and lesson videos, and what waits in its
 * Recently deleted (the files are kept until purged). A restored entry's file
 * is a live row again, so it counts once, there.
 */
function teamUsedBytes(db: Db, teamId: number): number {
	const recs = db
		.select({ t: sum(recordings.sizeBytes) })
		.from(recordings)
		.innerJoin(figures, eq(figures.id, recordings.figureId))
		.where(eq(figures.teamId, teamId))
		.get();
	const vids = db
		.select({ t: sum(lessonVideos.sizeBytes) })
		.from(lessonVideos)
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(eq(lessons.teamId, teamId))
		.get();
	const trash = db
		.select({ t: sum(teamTrash.sizeBytes) })
		.from(teamTrash)
		.where(
			and(eq(teamTrash.teamId, teamId), isNull(teamTrash.purgedAt), isNull(teamTrash.restoredAt))
		)
		.get();
	return total(recs?.t) + total(vids?.t) + total(trash?.t);
}

export function usedBytesOf(db: Db, owner: Owner): number {
	return 'teamId' in owner ? teamUsedBytes(db, owner.teamId) : usedBytes(db, owner.userId);
}

/**
 * A group's limit: the admin's override, else `TEAM_BYTES_PER_PERSON` for each
 * person in it, the owner included — counted now, never stored. A missing
 * group has none.
 */
export function teamLimitBytes(db: Db, teamId: number): number {
	const team = db
		.select({ limit: teams.storageLimitBytes })
		.from(teams)
		.where(eq(teams.id, teamId))
		.get();
	if (!team) return 0;
	if (team.limit !== null) return team.limit;
	const people = db
		.select({ n: count() })
		.from(teamMembers)
		.where(eq(teamMembers.teamId, teamId))
		.get();
	return (people?.n ?? 0) * TEAM_BYTES_PER_PERSON;
}

/** The owner's limit in bytes; null is none (the admin's). */
export function limitOf(db: Db, owner: Owner): number | null {
	if ('teamId' in owner) return teamLimitBytes(db, owner.teamId);
	const row = db
		.select({ limit: users.storageLimitBytes })
		.from(users)
		.where(eq(users.id, owner.userId))
		.get();
	// A signed-in person always has a row; a missing one is treated as no limit
	// rather than locking everything (only specs get there).
	return row?.limit ?? null;
}

export function storageOf(
	db: Db,
	userId: string
): { usedBytes: number; limitBytes: number | null } {
	return { usedBytes: usedBytes(db, userId), limitBytes: limitOf(db, { userId }) };
}

export type Room =
	{ ok: true } | { ok: false; usedBytes: number; limitBytes: number | null; message: string };

/**
 * Whether `incoming` more bytes fit: under the owner's limit, and leaving the
 * disk at least `DISK_FLOOR_BYTES` free, whatever the limits say. Routes pass
 * `await freeDisk()`; specs pass a number.
 */
export function roomForOwner(
	db: Db,
	owner: Owner,
	incomingBytes: number,
	freeDiskBytes: number
): Room {
	const used = usedBytesOf(db, owner);
	const limit = limitOf(db, owner);
	if (limit !== null && used + incomingBytes > limit) {
		return {
			ok: false,
			usedBytes: used,
			limitBytes: limit,
			message:
				'teamId' in owner
					? `Not enough room: the group uses ${byteSize(used)} of ${byteSize(limit)}. The owner can ask for more.`
					: `Not enough room: you use ${byteSize(used)} of ${byteSize(limit)}. Free some space or ask for more in Settings.`
		};
	}
	if (freeDiskBytes - incomingBytes < DISK_FLOOR_BYTES) {
		return {
			ok: false,
			usedBytes: used,
			limitBytes: limit,
			message: 'Not enough room on the server. Ask the admin.'
		};
	}
	return { ok: true };
}

/**
 * A person's own room, with no disk floor: for the asks that bring no bytes
 * yet (queueing a download), where the floor is checked when the bytes come.
 */
export function roomFor(db: Db, userId: string, incomingBytes: number): Room {
	return roomForOwner(db, { userId }, incomingBytes, Number.POSITIVE_INFINITY);
}

/** Bytes free on the disk that holds `$DATA_DIR`, for `roomForOwner`. */
export async function freeDisk(): Promise<number> {
	if (!env.DATA_DIR) throw new Error('DATA_DIR is not set');
	const s = await statfs(env.DATA_DIR);
	return s.bavail * s.bsize;
}

/** The size of the take a new one in the same slot would replace (0 when the slot is empty). */
export function takeSlotBytes(
	db: Db,
	userId: string,
	slot: { pattern: string; bpm: number; phrase: string }
): number {
	const row = db
		.select({ size: countTakes.sizeBytes })
		.from(countTakes)
		.where(
			and(
				eq(countTakes.userId, userId),
				eq(countTakes.pattern, slot.pattern as never),
				eq(countTakes.bpm, slot.bpm),
				eq(countTakes.phrase, slot.phrase as never)
			)
		)
		.get();
	return row?.size ?? 0;
}

const SONG_SIZES_FLAG = 'song-sizes';

/**
 * Fill `songs.size_bytes` for audio that was stored before the column existed,
 * once EVER (`app_flags` remembers), like `importNoteLinks`. A file that is
 * gone from the disk stays null and counts as nothing.
 */
export async function backfillSongSizes(db: Db, now: number): Promise<void> {
	const claimed = db
		.insert(appFlags)
		.values({ key: SONG_SIZES_FLAG, doneAt: now })
		.onConflictDoNothing()
		.run();
	if (claimed.changes === 0) return;
	const rows = db
		.select({ id: songs.id, file: songs.audioFile })
		.from(songs)
		.where(and(isNull(songs.sizeBytes), isNotNull(songs.audioFile)))
		.all();
	for (const row of rows) {
		const size = await stat(join(audioDir(), row.file!)).then(
			(s) => s.size,
			() => null
		);
		if (size !== null) db.update(songs).set({ sizeBytes: size }).where(eq(songs.id, row.id)).run();
	}
}

/**
 * Everything a person has on disk, biggest first. The count voice is one row
 * for all its takes. Archived parents are marked: their files still count.
 */
export function listStorageItems(db: Db, userId: string): StorageItem[] {
	const items: StorageItem[] = [];

	const recs = db
		.select({
			id: recordings.id,
			size: recordings.sizeBytes,
			kind: recordings.kind,
			figureId: figures.id,
			name: figures.name,
			figure: figureGroups.name,
			dance: figures.dance,
			figureArchived: figures.archivedAt,
			groupArchived: figureGroups.archivedAt
		})
		.from(recordings)
		.innerJoin(figures, eq(figures.id, recordings.figureId))
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(eq(figures.userId, userId))
		.all();
	for (const r of recs) {
		items.push({
			kind: 'recording',
			id: r.id,
			title: r.kind === 'video' ? 'Recording' : 'Audio recording',
			context: `${r.figure} · ${r.name}`,
			sizeBytes: r.size,
			archived: r.figureArchived !== null || r.groupArchived !== null,
			href:
				r.figureArchived !== null || r.groupArchived !== null
					? null
					: `/${r.dance}/figures/${r.figureId}`
		});
	}

	const vids = db
		.select({
			id: lessonVideos.id,
			size: lessonVideos.sizeBytes,
			lessonId: lessons.id,
			title: lessons.title,
			dance: lessons.dance,
			archived: lessons.archivedAt
		})
		.from(lessonVideos)
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(eq(lessons.userId, userId))
		.all();
	for (const v of vids) {
		items.push({
			kind: 'lessonVideo',
			id: v.id,
			title: 'Lesson video',
			context: `Lesson · ${v.title}`,
			sizeBytes: v.size,
			archived: v.archived !== null,
			href: v.archived !== null ? null : `/${v.dance}/lessons/${v.lessonId}`
		});
	}

	const sg = db
		.select()
		.from(songs)
		.where(and(eq(songs.userId, userId), isNotNull(songs.audioFile)))
		.all();
	for (const s of sg) {
		items.push({
			kind: 'song',
			id: s.id,
			title: s.title || 'Untitled song',
			context: s.artist ? `Song · ${s.artist}` : 'Song',
			sizeBytes: s.sizeBytes ?? 0,
			archived: s.archivedAt !== null,
			href: s.archivedAt !== null ? null : `/${s.dance}/songs/${s.id}`
		});
	}

	const takes = db
		.select({ n: count(), t: sum(countTakes.sizeBytes) })
		.from(countTakes)
		.where(eq(countTakes.userId, userId))
		.get();
	if (takes && takes.n > 0) {
		items.push({
			kind: 'voice',
			id: null,
			title: 'Your count voice',
			context: plural(takes.n, 'take', 'takes'),
			sizeBytes: total(takes.t),
			archived: false,
			href: '/voice'
		});
	}

	return items.sort((a, b) => b.sizeBytes - a.sizeBytes);
}

/** The person's open request for more room, if any. */
export function openRequest(
	db: Db,
	userId: string
): { createdAt: number; note: string | null } | null {
	return (
		db
			.select({ createdAt: storageRequests.createdAt, note: storageRequests.note })
			.from(storageRequests)
			.where(and(eq(storageRequests.userId, userId), isNull(storageRequests.resolvedAt)))
			.get() ?? null
	);
}

/** One open request per person: asking again while one waits changes nothing. */
export function askForMore(
	db: Db,
	userId: string,
	note: string | null,
	now: number
): 'asked' | 'already-open' {
	return db.transaction((tx) => {
		if (openRequest(tx, userId)) return 'already-open';
		tx.insert(storageRequests)
			.values({ userId, note: note?.trim() || null, createdAt: now })
			.run();
		return 'asked';
	});
}

function validLimit(limitBytes: number | null): boolean {
	return limitBytes === null || (Number.isSafeInteger(limitBytes) && limitBytes > 0);
}

/**
 * Everyone, oldest first. Numbers and the email only: the admin must not see
 * what anyone has (anti-goal), so nothing else is selected.
 */
export function listPeople(db: Db): {
	id: string;
	email: string;
	createdAt: number;
	usedBytes: number;
	limitBytes: number | null;
	isAdmin: boolean;
}[] {
	return db
		.select({
			id: users.id,
			email: users.email,
			createdAt: users.createdAt,
			limit: users.storageLimitBytes,
			isAdmin: users.isAdmin
		})
		.from(users)
		.orderBy(users.createdAt, users.email)
		.all()
		.map((u) => ({
			id: u.id,
			email: u.email,
			createdAt: u.createdAt,
			usedBytes: usedBytes(db, u.id),
			limitBytes: u.limit,
			isAdmin: u.isAdmin
		}));
}

/** Open requests, oldest first, with the asker's numbers. */
export function listOpenRequests(db: Db): {
	id: number;
	userId: string;
	email: string;
	note: string | null;
	createdAt: number;
	usedBytes: number;
	limitBytes: number | null;
}[] {
	return db
		.select({
			id: storageRequests.id,
			userId: storageRequests.userId,
			email: users.email,
			note: storageRequests.note,
			createdAt: storageRequests.createdAt,
			limit: users.storageLimitBytes
		})
		.from(storageRequests)
		.innerJoin(users, eq(users.id, storageRequests.userId))
		.where(isNull(storageRequests.resolvedAt))
		.orderBy(storageRequests.createdAt, storageRequests.id)
		.all()
		.map((r) => ({
			id: r.id,
			userId: r.userId,
			email: r.email,
			note: r.note,
			createdAt: r.createdAt,
			usedBytes: usedBytes(db, r.userId),
			limitBytes: r.limit
		}));
}

/** Sets one person's limit (null = no limit). False when nobody has that id or the limit is not valid. */
export function setStorageLimit(db: Db, userId: string, limitBytes: number | null): boolean {
	if (!validLimit(limitBytes)) return false;
	return (
		db.update(users).set({ storageLimitBytes: limitBytes }).where(eq(users.id, userId)).run()
			.changes === 1
	);
}

/**
 * Closes an open request. Granted sets the person's limit in the same
 * transaction; declined leaves it alone. False when the request is missing,
 * already closed, or the limit is not valid.
 */
export function resolveRequest(
	db: Db,
	id: number,
	outcome: 'granted' | 'declined',
	limitBytes: number | null,
	now: number
): boolean {
	if (outcome !== 'granted' && outcome !== 'declined') return false;
	if (outcome === 'granted' && (limitBytes === null || !validLimit(limitBytes))) return false;
	return db.transaction((tx) => {
		const req = tx
			.select()
			.from(storageRequests)
			.where(and(eq(storageRequests.id, id), isNull(storageRequests.resolvedAt)))
			.get();
		if (!req) return false;
		tx.update(storageRequests)
			.set({
				resolvedAt: now,
				outcome,
				grantedLimitBytes: outcome === 'granted' ? limitBytes : null
			})
			.where(eq(storageRequests.id, id))
			.run();
		if (outcome === 'granted') {
			tx.update(users).set({ storageLimitBytes: limitBytes }).where(eq(users.id, req.userId)).run();
		}
		return true;
	});
}
