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
	fetchMedia: (path: string, signal?: AbortSignal) => Promise<Response>;
	online: () => boolean;
	log: Pick<Console, 'warn'>;
	/** Aborted: stop now, the file in flight included (the store is being emptied). */
	signal?: AbortSignal;
}): Promise<{ fetched: number; removed: number; failed: number }> {
	const out = { fetched: 0, removed: 0, failed: 0 };
	// Offline nothing changes: the copy may be behind, and nothing could come anyway.
	if (!deps.online()) return out;
	const want = new Map(deps.wanted.map((f) => [key(f), f]));
	const held = await deps.store.list();
	const have = new Set(held.map(key));
	for (const f of held) {
		if (deps.signal?.aborted) return out;
		if (want.has(key(f))) continue;
		await deps.store.remove(f.kind, f.file);
		out.removed++;
	}
	for (const f of want.values()) {
		if (have.has(key(f))) continue;
		if (!deps.online() || deps.signal?.aborted) break;
		try {
			const res = await deps.fetchMedia(mediaPath(f.kind, f.file), deps.signal);
			if (!res.ok) throw new Error(`the server answered ${res.status}`);
			if (deps.signal?.aborted) break;
			await deps.store.write(f, res);
			out.fetched++;
		} catch (e) {
			if (deps.signal?.aborted) break;
			deps.log.warn(`[device] media: ${f.kind}/${f.file} did not come`, String(e));
			out.failed++;
		}
	}
	return out;
}

/**
 * The device worker's keeper of the songs on the phone: one pass at a time (a
 * pass asked during one runs once more after it), and `clear` for another
 * person or a forgotten copy, which aborts the pass in flight and waits for it
 * before it empties the store, so nothing of the first person lands after.
 */
export function mediaKeeper(deps: {
	store: () => Promise<MediaStore | null>;
	/** The copy's files; null while there is no copy to read (starting, another person's). */
	wanted: () => MediaFile[] | null;
	fetchMedia: (path: string, signal: AbortSignal) => Promise<Response>;
	online: () => boolean;
	log: Pick<Console, 'info' | 'warn'>;
}): { sync(): Promise<void>; clear(): Promise<void> } {
	let running: Promise<void> | null = null;
	let again = false;
	let controller: AbortController | null = null;

	async function pass(): Promise<void> {
		const store = await deps.store();
		const wanted = deps.wanted();
		if (!store || wanted === null) return;
		const signal = (controller = new AbortController()).signal;
		const out = await syncMedia({
			wanted,
			store,
			fetchMedia: (path) => deps.fetchMedia(path, signal),
			online: deps.online,
			log: deps.log,
			signal
		});
		if (out.fetched || out.removed || out.failed) deps.log.info('[device] songs on the phone', out);
	}

	function sync(): Promise<void> {
		if (running) {
			again = true;
			return running;
		}
		running = (async () => {
			try {
				do {
					again = false;
					await pass().catch((e) => deps.log.warn('[device] songs on the phone', String(e)));
				} while (again);
			} finally {
				running = null;
				controller = null;
			}
		})();
		return running;
	}

	async function clear(): Promise<void> {
		again = false;
		controller?.abort();
		await running;
		await (await deps.store())?.clear();
	}

	return { sync, clear };
}
