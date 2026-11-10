/*
 * Songs on the phone (offline phase 4a): the device keeps the audio of every
 * song in its copy and the person's count takes, so the player works with no
 * signal. The copy is already walled (`syncScope`): what it holds, the person
 * may play. After each sync the store is brought to the copy: what is missing
 * comes, one file at a time, on any connection; what left the copy goes.
 * Kept videos (offline phase 4b, `keep.ts`) go through the same keeper, on
 * Wi-Fi when asked, while there is space, resumed from where they were cut off.
 */
import {
	mediaPath,
	VIDEO_KINDS,
	type MediaFile,
	type MediaKind,
	type MediaStore
} from '$lib/offline/media-store';
import { fits } from '$lib/offline/network';
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
const isVideo = (f: MediaFile) => VIDEO_KINDS.includes(f.kind);

/** Why wanted videos are not coming now (offline phase 4b). */
export type Waiting = 'wifi' | 'space' | 'offline' | null;
export type PassOut = { fetched: number; removed: number; failed: number; waiting: Waiting };

/** How often progress is told while a file comes. */
const PROGRESS_MS = 500;

/** The start of a `Content-Range: bytes <start>-<end>/<size>`, or null. */
function rangeStart(res: Response): number | null {
	const m = /^bytes (\d+)-\d+\/(\d+|\*)$/.exec(res.headers.get('content-range') ?? '');
	return m ? Number(m[1]) : null;
}

/** `res` with its bytes counted on the way through. */
function counted(res: Response, start: number, tell: (received: number) => void): Response {
	if (!res.body) return res;
	let n = start;
	let last = 0;
	const body = res.body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, c) {
				n += chunk.byteLength;
				const now = Date.now();
				if (now - last >= PROGRESS_MS) {
					last = now;
					tell(n);
				}
				c.enqueue(chunk);
			},
			flush() {
				tell(n);
			}
		})
	);
	return new Response(body, { status: res.status, headers: res.headers });
}

/**
 * Brings the store to `wanted`: removes what is not wanted, then fetches what
 * is missing one at a time, songs first, then videos in `wanted`'s order. A
 * video comes only while `videosMayCome` (Only on Wi-Fi) and while it leaves
 * enough space; a cut-off one goes on from its part with `Range`.
 */
export async function syncMedia(deps: {
	wanted: MediaFile[];
	store: MediaStore;
	/** `range`: ask from that byte on (`Range: bytes=<range>-`). */
	fetchMedia: (path: string, signal?: AbortSignal, range?: number) => Promise<Response>;
	online: () => boolean;
	/** Videos may come now (the Wi-Fi rule); songs always may. */
	videosMayCome?: () => boolean;
	/** Free bytes now, or null when the browser won't say. */
	free?: () => Promise<number | null>;
	onProgress?: (key: string, received: number, total: number) => void;
	log: Pick<Console, 'warn'>;
	/** Aborted: stop now, the file in flight included (the store is being emptied, or the settings changed). */
	signal?: AbortSignal;
}): Promise<PassOut> {
	const out: PassOut = { fetched: 0, removed: 0, failed: 0, waiting: null };
	const held = await deps.store.list();
	const have = new Set(held.map(key));
	const missing = deps.wanted.filter((f) => !have.has(key(f)));
	const want = new Set(deps.wanted.map(key));
	const online = deps.online();
	// What is not wanted goes. Offline only videos: the person took them off (a switch,
	// the button, a low-space suggestion), which must free room on a train too; a song
	// waits, as in 4a. A cut-off part of a video no longer wanted goes with it.
	const unwanted = [
		...held.filter((f) => !want.has(key(f)) && (online || isVideo(f))),
		...(await deps.store.parts()).filter((p) => !want.has(key(p)) && !have.has(key(p)))
	];
	for (const f of unwanted) {
		if (deps.signal?.aborted) return out;
		await deps.store.remove(f.kind, f.file);
		out.removed++;
	}
	if (!online) {
		if (missing.some(isVideo)) out.waiting = 'offline';
		return out;
	}
	const ordered = [...missing.filter((f) => !isVideo(f)), ...missing.filter(isVideo)];
	for (const f of ordered) {
		if (deps.signal?.aborted) break;
		if (!deps.online()) {
			if (isVideo(f)) out.waiting = 'offline';
			break;
		}
		const video = isVideo(f);
		if (video && deps.videosMayCome && !deps.videosMayCome()) {
			out.waiting = 'wifi';
			break;
		}
		let from = video ? await deps.store.partSize(f.kind, f.file) : 0;
		if (f.size !== undefined && from >= f.size) {
			// Whole but never committed (the app closed just then): asking past the end gets a 416.
			await deps.store.remove(f.kind, f.file);
			from = 0;
		}
		if (deps.free && !fits(await deps.free(), Math.max(0, (f.size ?? 0) - from))) {
			if (video) out.waiting = 'space';
			continue;
		}
		try {
			const res = await deps.fetchMedia(
				mediaPath(f.kind, f.file),
				deps.signal,
				from > 0 ? from : undefined
			);
			let start = 0;
			if (res.status === 206) {
				if (from === 0 || rangeStart(res) !== from) {
					throw new Error(`the server answered from byte ${rangeStart(res)}, not ${from}`);
				}
				start = from;
			} else if (!res.ok) {
				throw new Error(`the server answered ${res.status}`);
			}
			if (deps.signal?.aborted) break;
			const k = key(f);
			const total = f.size ?? start + Number(res.headers.get('content-length') ?? 0);
			const body = deps.onProgress
				? counted(res, start, (n) => deps.onProgress!(k, n, total))
				: res;
			await deps.store.write(f, body, { from: start });
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
 * The device worker's keeper of the media on the phone: one pass at a time (a
 * pass asked during one runs once more after it); `restart` stops the file in
 * flight (a video keeps its part) and runs again, after a settings or a
 * connection change; `clear` for another person, a forgotten copy or Clear
 * kept videos, which aborts the pass in flight and waits for it before it
 * empties the store, so nothing of the first person lands after.
 */
export function mediaKeeper(deps: {
	store: () => Promise<MediaStore | null>;
	/** The copy's files; null while there is no copy to read (starting, another person's). */
	wanted: () => MediaFile[] | null;
	fetchMedia: (path: string, signal: AbortSignal, range?: number) => Promise<Response>;
	online: () => boolean;
	videosMayCome?: () => boolean;
	free?: () => Promise<number | null>;
	onProgress?: (key: string, received: number, total: number) => void;
	/** After every pass that ran. */
	onPass?: (out: PassOut) => void;
	log: Pick<Console, 'info' | 'warn'>;
}): {
	sync(): Promise<void>;
	restart(): Promise<void>;
	clear(kinds?: readonly MediaKind[]): Promise<void>;
} {
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
			fetchMedia: (path, _signal, range) => deps.fetchMedia(path, signal, range),
			online: deps.online,
			videosMayCome: deps.videosMayCome,
			free: deps.free,
			onProgress: deps.onProgress,
			log: deps.log,
			signal
		});
		if (out.fetched || out.removed || out.failed) deps.log.info('[device] media on the phone', out);
		deps.onPass?.(out);
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
					await pass().catch((e) => deps.log.warn('[device] media on the phone', String(e)));
				} while (again);
			} finally {
				running = null;
				controller = null;
			}
		})();
		return running;
	}

	function restart(): Promise<void> {
		if (running) {
			again = true;
			controller?.abort();
			return running;
		}
		return sync();
	}

	async function clear(kinds?: readonly MediaKind[]): Promise<void> {
		again = false;
		controller?.abort();
		await running;
		await (await deps.store())?.clear(kinds);
	}

	return { sync, restart, clear };
}
