/**
 * Make my own copy of a group's song: a personal song of the same dance with
 * the teacher's count (beats, downbeats, anchors, tempo, sample start), for
 * the person to re-tap their way. The audio is hard-linked under a new name
 * (`linkCopy` with `AUDIO_FILE_RE`, as `copy-lesson.ts` links videos), so the
 * group's purge never takes the copy's file, and charged to the person.
 */
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import type { Db } from './db';
import { songs, type Song } from './db/schema';
import { songAccess } from './access';
import { roomForOwner, type Room } from './storage';
import { getSong } from './songs';
import type { CopyFiles } from './copy-lesson';

/**
 * A readable group song (shared, or any for its editors) → a new song of the
 * person's. A personal song, a deleted or unready one, and one they may not
 * read are the missing song's 404. Refused, writing nothing, when it does not
 * fit the person's room or would leave the disk under the floor. When the row
 * cannot be written, the new name is unlinked.
 */
export async function copySong(
	db: Db,
	userId: string,
	songId: number,
	now: number,
	files: CopyFiles,
	freeDiskBytes = Number.POSITIVE_INFINITY
): Promise<{ song: Song } | { refused: Room }> {
	const from = getSong(db, songId);
	if (
		!from ||
		from.teamId === null ||
		from.archivedAt !== null ||
		from.status !== 'ready' ||
		!from.audioFile ||
		songAccess(db, userId, from) === null
	) {
		throw error(404, 'Song not found');
	}
	const room = roomForOwner(db, { userId }, from.sizeBytes ?? 0, freeDiskBytes);
	if (!room.ok) return { refused: room };

	const file = await files.link(files.dir, from.audioFile);
	try {
		const song = db
			.insert(songs)
			.values({
				userId,
				teamId: null,
				sharedAt: null,
				dance: from.dance,
				title: from.title,
				artist: from.artist,
				style: from.style,
				sourceUrl: from.sourceUrl,
				status: 'ready',
				audioFile: file,
				mime: from.mime,
				durationS: from.durationS,
				bpm: from.bpm,
				beatsJson: from.beatsJson,
				downbeatsJson: from.downbeatsJson,
				anchorsJson: from.anchorsJson,
				tempoFactor: from.tempoFactor,
				sampleStartS: from.sampleStartS,
				sizeBytes: from.sizeBytes,
				createdAt: now
			})
			.returning()
			.get();
		return { song };
	} catch (err) {
		await unlink(join(files.dir, file)).catch(() => {});
		throw err;
	}
}
