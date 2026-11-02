/**
 * What a person has on disk, and whether one more upload fits.
 *
 * Used is computed from the size columns on every ask, never stored as a
 * running total. Archived parents count: archiving keeps the files. A saved
 * YouTube video counts once it has become a recording or a lesson video.
 */
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { and, count, eq, isNotNull, isNull, sum } from 'drizzle-orm';
import { byteSize, plural } from '$lib/format';
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
	users
} from './db/schema';

function total(value: string | number | null | undefined): number {
	return Number(value ?? 0);
}

export function usedBytes(db: Db, userId: string): number {
	const recs = db
		.select({ t: sum(recordings.sizeBytes) })
		.from(recordings)
		.innerJoin(figures, eq(figures.id, recordings.figureId))
		.where(eq(figures.userId, userId))
		.get();
	const vids = db
		.select({ t: sum(lessonVideos.sizeBytes) })
		.from(lessonVideos)
		.innerJoin(lessons, eq(lessons.id, lessonVideos.lessonId))
		.where(eq(lessons.userId, userId))
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

export function storageOf(
	db: Db,
	userId: string
): { usedBytes: number; limitBytes: number | null } {
	const row = db
		.select({ limit: users.storageLimitBytes })
		.from(users)
		.where(eq(users.id, userId))
		.get();
	// A signed-in person always has a row; a missing one is treated as no limit
	// rather than locking everything (only specs get there).
	return { usedBytes: usedBytes(db, userId), limitBytes: row?.limit ?? null };
}

export type Room =
	{ ok: true } | { ok: false; usedBytes: number; limitBytes: number; message: string };

export function roomFor(db: Db, userId: string, incomingBytes: number): Room {
	const { usedBytes: used, limitBytes } = storageOf(db, userId);
	if (limitBytes === null || used + incomingBytes <= limitBytes) return { ok: true };
	return {
		ok: false,
		usedBytes: used,
		limitBytes,
		message: `Not enough room: you use ${byteSize(used)} of ${byteSize(limitBytes)}. Free some space or ask for more in Settings.`
	};
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
			href: `/${r.dance}/figures/${r.figureId}`
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
			href: `/${v.dance}/lessons/${v.lessonId}`
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
			href: `/${s.dance}/songs/${s.id}`
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
