/**
 * Make my own copy of a group's song: a personal song of the same dance with
 * the teacher's count (beats, downbeats, anchors, tempo, sample start), for
 * the person to re-tap their way. A wrapper around the clone engine
 * (`clones/clone.ts`), kept until Task 23: the copy is a member of the song's
 * family, so copying twice answers the first copy. The audio is hard-linked
 * under a new name, so the group's purge never takes the copy's file, and
 * charged to the person.
 */
import { error } from '@sveltejs/kit';
import type { Db } from './db';
import type { Song } from './db/schema';
import { songAccess } from './access';
import type { Room } from './storage';
import { getSong } from './songs';
import { cloneFilesOf, type CopyFiles } from './copy-lesson';
import { cloneInto } from './clones/clone';
import type { DanceSlug } from '$lib/dances/dances';

/**
 * A readable group song (shared, or any for its editors) → the person's own
 * song of its family: a new one, or the copy they made before. A personal
 * song, a deleted or unready one, and one they may not read are the missing
 * song's 404. Refused, writing nothing, when it does not fit the person's
 * room or would leave the disk under the floor. When the row cannot be
 * written, the new name is unlinked.
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
	const res = await cloneInto(
		db,
		{
			kind: 'song',
			id: from.id,
			into: { userId, dance: from.dance as DanceSlug },
			recordings: false
		},
		cloneFilesOf(files, 'audio'),
		now,
		freeDiskBytes
	);
	if (res.ok) return { song: getSong(db, res.id)! };
	if (res.reason === 'room') return { refused: res.room };
	throw error(404, 'Song not found');
}
