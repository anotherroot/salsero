/**
 * What a person has on disk, and whether one more upload fits.
 *
 * Used is computed from the size columns on every ask, never stored as a
 * running total. Archived parents count: archiving keeps the files. A saved
 * YouTube video counts once it has become a recording or a lesson video.
 */
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { and, eq, isNotNull, isNull, sum } from 'drizzle-orm';
import { byteSize } from '$lib/format';
import type { Db } from './db';
import { audioDir } from './files';
import {
	appFlags,
	countTakes,
	figures,
	lessons,
	lessonVideos,
	recordings,
	songs,
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
