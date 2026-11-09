/*
 * Songs on the phone (offline phase 4a): the device keeps the audio of every
 * song in its copy and the person's count takes, so the player works with no
 * signal. The copy is already walled (`syncScope`): what it holds, the person
 * may play. After each sync the store is brought to the copy: what is missing
 * comes, one file at a time, on any connection; what left the copy goes.
 */
import { mediaPath, type MediaFile, type MediaStore } from '$lib/offline/media-store';
import type { SqliteDb } from './migrate';

/** The copy's songs with audio (not archived) and the person's count takes, as files. */
export function wantedMedia(db: SqliteDb, userId: string): MediaFile[] {
	const songs = db
		.prepare(
			`SELECT audio_file AS file, mime FROM songs
			 WHERE audio_file IS NOT NULL AND mime IS NOT NULL AND archived_at IS NULL`
		)
		.all() as { file: string; mime: string }[];
	const takes = db.prepare('SELECT file FROM count_takes WHERE user_id = ?').all(userId) as {
		file: string;
	}[];
	return [
		...songs.map((s): MediaFile => ({ kind: 'audio', file: s.file, mime: s.mime })),
		...takes.map((t): MediaFile => ({ kind: 'count', file: t.file, mime: 'audio/wav' }))
	];
}

const key = (f: { kind: string; file: string }) => `${f.kind}/${f.file}`;

/** Brings the store to `wanted`: fetches what is missing one at a time, removes the rest. */
export async function syncMedia(deps: {
	wanted: MediaFile[];
	store: MediaStore;
	fetchMedia: (path: string) => Promise<Response>;
	online: () => boolean;
	log: Pick<Console, 'warn'>;
}): Promise<{ fetched: number; removed: number; failed: number }> {
	const out = { fetched: 0, removed: 0, failed: 0 };
	// Offline nothing changes: the copy may be behind, and nothing could come anyway.
	if (!deps.online()) return out;
	const want = new Map(deps.wanted.map((f) => [key(f), f]));
	const held = await deps.store.list();
	const have = new Set(held.map(key));
	for (const f of held) {
		if (want.has(key(f))) continue;
		await deps.store.remove(f.kind, f.file);
		out.removed++;
	}
	for (const f of want.values()) {
		if (have.has(key(f))) continue;
		if (!deps.online()) break;
		try {
			const res = await deps.fetchMedia(mediaPath(f.kind, f.file));
			if (!res.ok) throw new Error(`the server answered ${res.status}`);
			await deps.store.write(f, res);
			out.fetched++;
		} catch (e) {
			deps.log.warn(`[device] media: ${f.kind}/${f.file} did not come`, String(e));
			out.failed++;
		}
	}
	return out;
}
