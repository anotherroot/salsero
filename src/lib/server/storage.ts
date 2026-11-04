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
import { and, count, eq, isNotNull, isNull, sum, type SQL } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { byteSize, plural } from '$lib/format';
import { fullName } from '$lib/names';
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

/** The owner of a root row (a lesson, a figure): its group's when it has one. Throws on a row with neither. */
export function ownerOfRow(row: { userId: string | null; teamId: number | null }): Owner {
	if (row.teamId !== null) return { teamId: row.teamId };
	// A row with neither owner would be charged to nobody and pass every limit.
	if (row.userId === null) throw new Error('row has no owner');
	return { userId: row.userId };
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
		.where(and(eq(songs.userId, userId), isNull(songs.teamId)))
		.get();
	const tk = db
		.select({ t: sum(countTakes.sizeBytes) })
		.from(countTakes)
		.where(eq(countTakes.userId, userId))
		.get();
	return total(recs?.t) + total(vids?.t) + total(sg?.t) + total(tk?.t);
}

/**
 * A group's files: its recordings, lesson videos and songs (archived ones
 * too, as for a person), and what waits in its Recently deleted (the files are
 * kept until purged). A restored entry's file is a live row again, so it
 * counts once, there.
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
	const sg = db
		.select({ t: sum(songs.sizeBytes) })
		.from(songs)
		.where(eq(songs.teamId, teamId))
		.get();
	const trash = db
		.select({ t: sum(teamTrash.sizeBytes) })
		.from(teamTrash)
		.where(
			and(eq(teamTrash.teamId, teamId), isNull(teamTrash.purgedAt), isNull(teamTrash.restoredAt))
		)
		.get();
	return total(recs?.t) + total(vids?.t) + total(sg?.t) + total(trash?.t);
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

/** The songs with audio that `owner` picks out, as storage items. */
function songItems(db: Db, owner: SQL): StorageItem[] {
	return db
		.select()
		.from(songs)
		.where(and(owner, isNotNull(songs.audioFile)))
		.all()
		.map((s) => ({
			kind: 'song' as const,
			id: s.id,
			title: s.title || 'Untitled song',
			context: s.artist ? `Song · ${s.artist}` : 'Song',
			sizeBytes: s.sizeBytes ?? 0,
			archived: s.archivedAt !== null,
			href: s.archivedAt !== null ? null : `/${s.dance}/songs/${s.id}`
		}));
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

	items.push(...songItems(db, and(eq(songs.userId, userId), isNull(songs.teamId))!));

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

/** Who asks: a person for their own space (no `teamId`), or a group's owner for the group's. */
export type Asker = { userId: string; teamId?: number | null };

/**
 * The open request for more room, if any. Keyed on (person, group): a person's
 * own request and their group's never block each other.
 */
export function openRequest(
	db: Db,
	userId: string,
	teamId?: number | null
): { createdAt: number; note: string | null } | null {
	return (
		db
			.select({ createdAt: storageRequests.createdAt, note: storageRequests.note })
			.from(storageRequests)
			.where(
				and(
					eq(storageRequests.userId, userId),
					teamId == null ? isNull(storageRequests.teamId) : eq(storageRequests.teamId, teamId),
					isNull(storageRequests.resolvedAt)
				)
			)
			.get() ?? null
	);
}

/** One open request per (person, group): asking again while one waits changes nothing. */
export function askForMore(
	db: Db,
	asker: Asker,
	note: string | null,
	now: number
): 'asked' | 'already-open' {
	return db.transaction((tx) => {
		if (openRequest(tx, asker.userId, asker.teamId)) return 'already-open';
		tx.insert(storageRequests)
			.values({
				userId: asker.userId,
				teamId: asker.teamId ?? null,
				note: note?.trim() || null,
				createdAt: now
			})
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

/**
 * Open requests, oldest first, with the numbers asked about: the person's, or
 * the group's (with its name) when `teamId` is set. Numbers and names only.
 */
export function listOpenRequests(db: Db): {
	id: number;
	userId: string;
	email: string;
	note: string | null;
	createdAt: number;
	usedBytes: number;
	limitBytes: number | null;
	teamId: number | null;
	teamName: string | null;
}[] {
	return db
		.select({
			id: storageRequests.id,
			userId: storageRequests.userId,
			email: users.email,
			note: storageRequests.note,
			createdAt: storageRequests.createdAt,
			limit: users.storageLimitBytes,
			teamId: storageRequests.teamId,
			teamName: teams.name
		})
		.from(storageRequests)
		.innerJoin(users, eq(users.id, storageRequests.userId))
		.leftJoin(teams, eq(teams.id, storageRequests.teamId))
		.where(isNull(storageRequests.resolvedAt))
		.orderBy(storageRequests.createdAt, storageRequests.id)
		.all()
		.map((r) => {
			const owner: Owner = r.teamId === null ? { userId: r.userId } : { teamId: r.teamId };
			return {
				id: r.id,
				userId: r.userId,
				email: r.email,
				note: r.note,
				createdAt: r.createdAt,
				usedBytes: usedBytesOf(db, owner),
				limitBytes: r.teamId === null ? r.limit : teamLimitBytes(db, r.teamId),
				teamId: r.teamId,
				teamName: r.teamName
			};
		});
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
 * Closes an open request. Granted sets the person's (or, for a group's
 * request, the group's) limit in the same
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
			if (req.teamId !== null) {
				tx.update(teams)
					.set({ storageLimitBytes: limitBytes })
					.where(eq(teams.id, req.teamId))
					.run();
			} else {
				tx.update(users)
					.set({ storageLimitBytes: limitBytes })
					.where(eq(users.id, req.userId))
					.run();
			}
		}
		return true;
	});
}

/** Sets a group's limit (null = back to the computed one). False when no such group or an invalid limit. */
export function setTeamLimit(db: Db, teamId: number, limitBytes: number | null): boolean {
	if (!validLimit(limitBytes)) return false;
	return (
		db.update(teams).set({ storageLimitBytes: limitBytes }).where(eq(teams.id, teamId)).run()
			.changes === 1
	);
}

/** How many groups a person may make: null = the default. False when no such person or invalid. */
export function setGroupLimit(db: Db, userId: string, n: number | null): boolean {
	if (n !== null && !(Number.isSafeInteger(n) && n >= 0 && n <= 1000)) return false;
	return db.update(users).set({ groupLimit: n }).where(eq(users.id, userId)).run().changes === 1;
}

/**
 * What every limit adds up to: each person's limit (none counts as nothing)
 * and each group's that is not yet purged. Compared with the free disk at the
 * top of the admin page.
 */
export function limitsTotal(db: Db): number {
	const people = db
		.select({ t: sum(users.storageLimitBytes) })
		.from(users)
		.get();
	const live = db.select({ id: teams.id }).from(teams).where(isNull(teams.purgedAt)).all();
	return total(people?.t) + live.reduce((n, t) => n + teamLimitBytes(db, t.id), 0);
}

/** Groups for the admin: names and numbers, never content. */
export function listTeamsForAdmin(db: Db): {
	id: number;
	name: string;
	dance: string;
	owner: string;
	people: number;
	usedBytes: number;
	limitBytes: number;
	overridden: boolean;
	deleted: boolean;
}[] {
	const rows = db
		.select({
			id: teams.id,
			name: teams.name,
			dance: teams.dance,
			override: teams.storageLimitBytes,
			deletedAt: teams.deletedAt
		})
		.from(teams)
		.where(isNull(teams.purgedAt))
		.orderBy(teams.name, teams.id)
		.all();
	return rows.map((t) => {
		const owner = db
			.select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
			.from(teamMembers)
			.innerJoin(users, eq(users.id, teamMembers.userId))
			.where(and(eq(teamMembers.teamId, t.id), eq(teamMembers.role, 'owner')))
			.get();
		const n = db.select({ n: count() }).from(teamMembers).where(eq(teamMembers.teamId, t.id)).get();
		return {
			id: t.id,
			name: t.name,
			dance: t.dance,
			owner: owner ? fullName(owner) : '',
			people: n?.n ?? 0,
			usedBytes: teamUsedBytes(db, t.id),
			limitBytes: teamLimitBytes(db, t.id),
			overridden: t.override !== null,
			deleted: t.deletedAt !== null
		};
	});
}

/**
 * A group's files, biggest first, for its editors: videos with their lesson's
 * title, recordings with their figure, its songs, and what waits in Recently
 * deleted (the file stays until the purge, and counts).
 */
export function listTeamStorageItems(db: Db, teamId: number): StorageItem[] {
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
			archived: figures.archivedAt
		})
		.from(recordings)
		.innerJoin(figures, eq(figures.id, recordings.figureId))
		.innerJoin(figureGroups, eq(figureGroups.id, figures.groupId))
		.where(eq(figures.teamId, teamId))
		.all();
	for (const r of recs) {
		items.push({
			kind: 'recording',
			id: r.id,
			title: r.kind === 'video' ? 'Recording' : 'Audio recording',
			context: `${r.figure} · ${r.name}`,
			sizeBytes: r.size,
			archived: r.archived !== null,
			href: r.archived !== null ? null : `/${r.dance}/figures/${r.figureId}`
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
		.where(eq(lessons.teamId, teamId))
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
	items.push(...songItems(db, eq(songs.teamId, teamId)));
	const trash = db
		.select()
		.from(teamTrash)
		.where(
			and(eq(teamTrash.teamId, teamId), isNull(teamTrash.purgedAt), isNull(teamTrash.restoredAt))
		)
		.all();
	for (const t of trash) {
		if (t.sizeBytes <= 0) continue;
		items.push({
			kind: 'trash',
			id: t.id,
			title: t.kind === 'recording' ? 'Recording' : 'Lesson video',
			context: `${t.label} · in Recently deleted`,
			sizeBytes: t.sizeBytes,
			archived: false,
			href: null
		});
	}
	return items.sort((a, b) => b.sizeBytes - a.sizeBytes);
}
