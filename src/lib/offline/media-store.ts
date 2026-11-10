/*
 * The media store (offline phase 4a): files the device keeps so the player
 * works with no signal, under their server names, in the browser's own
 * storage (OPFS, `media/<kind>/`). The device worker fills it; the service
 * worker answers from it (`media-range.ts`); Settings reads its size. One
 * store on every device, Android's WebView too. A file shows only once it is
 * whole: a download cut off half way is never served.
 *
 * Client-safe: runs in a window, the service worker and the device worker.
 */

/**
 * Song audio (`/audio/<file>`) and count takes (`/count/<file>`), 4a; lesson
 * videos (`/lesson-videos/<file>`) and recordings (`/recordings/<file>`), 4b.
 * The kind is the URL's first segment.
 */
export type MediaKind = 'audio' | 'count' | 'lesson-videos' | 'recordings';
/** `size`, when the row knows it (videos): a whole file of another size is refused. */
export type MediaFile = { kind: MediaKind; file: string; mime: string; size?: number };

export const SONG_KINDS: readonly MediaKind[] = ['audio', 'count'];
/** Kept videos: big, so a download cut off keeps its part and goes on from it. */
export const VIDEO_KINDS: readonly MediaKind[] = ['lesson-videos', 'recordings'];

export type MediaStore = {
	/** What the store holds, whole files only. */
	list(): Promise<MediaFile[]>;
	/** The file and its type, or null. */
	read(kind: MediaKind, file: string): Promise<{ body: Blob; mime: string } | null>;
	/**
	 * Reads the response's body to the end, then commits; a body that fails stores
	 * nothing whole. A video's part stays for the next write to go on `from`.
	 */
	write(f: MediaFile, res: Response, opts?: { from?: number }): Promise<void>;
	/** Bytes of a cut-off download kept to go on from; 0 when none. */
	partSize(kind: MediaKind, file: string): Promise<number>;
	/** The cut-off downloads kept to go on from, by the name they will have. */
	parts(): Promise<{ kind: MediaKind; file: string }[]>;
	remove(kind: MediaKind, file: string): Promise<void>;
	/** Every kind, or only `kinds`. */
	clear(kinds?: readonly MediaKind[]): Promise<void>;
	/** Bytes held, of every kind or only `kinds`. */
	usage(kinds?: readonly MediaKind[]): Promise<number>;
};

const KINDS: readonly MediaKind[] = [...SONG_KINDS, ...VIDEO_KINDS];
const resumable = (kind: MediaKind) => VIDEO_KINDS.includes(kind);
/** A server name: no slashes, no dot first (so never `..`). */
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function mediaPath(kind: MediaKind, file: string): string {
	return `/${kind}/${file}`;
}

/** The kind and name a media path asks for, or null when it is no media path. */
export function mediaOf(path: string): { kind: MediaKind; file: string } | null {
	const m = /^\/([a-z-]+)\/([^/]+)$/.exec(path);
	if (!m || !KINDS.includes(m[1] as MediaKind) || !NAME.test(m[2])) return null;
	return { kind: m[1] as MediaKind, file: m[2] };
}

/** In memory: the specs', and a browser with no OPFS keeps nothing between loads. */
export function memoryMediaStore(): MediaStore {
	const files = new Map<string, { f: MediaFile; body: Blob }>();
	const key = (kind: MediaKind, file: string) => `${kind}/${file}`;
	return {
		async list() {
			return [...files.values()].map((e) => e.f);
		},
		async read(kind, file) {
			const e = files.get(key(kind, file));
			return e ? { body: e.body, mime: e.f.mime } : null;
		},
		async write(f, res, opts) {
			// No parts in memory: nothing is ever cut off to go on from.
			if ((opts?.from ?? 0) > 0) throw new Error('the memory store keeps no parts');
			const body = new Blob([await res.arrayBuffer()]);
			if (f.size !== undefined && body.size !== f.size) {
				throw new Error(`the file is ${body.size} bytes, not ${f.size}`);
			}
			files.set(key(f.kind, f.file), { f, body });
		},
		async partSize() {
			return 0;
		},
		async parts() {
			return [];
		},
		async remove(kind, file) {
			files.delete(key(kind, file));
		},
		async clear(kinds = KINDS) {
			for (const [k, e] of files) if (kinds.includes(e.f.kind)) files.delete(k);
		},
		async usage(kinds = KINDS) {
			let n = 0;
			for (const e of files.values()) if (kinds.includes(e.f.kind)) n += e.body.size;
			return n;
		}
	};
}

/*
 * OPFS: `media/<kind>/<file>` holds the bytes and `<file>.meta` (`{ mime, size }`)
 * says they are whole. The meta is written last, after the bytes are in place
 * under their name, and dropped first; a file counts only when its meta is
 * there and its size matches. So a crash or a full disk at any step leaves
 * nothing that reads as whole, on every path (`move()`, a copy, Safari's sync
 * handle), and the next pass fetches it again. A download goes to
 * `<file>.part` first.
 */
const PART = '.part';
const META = '.meta';
const ROOT = 'media';

type Meta = { mime: string; size: number };
type SyncHandle = {
	truncate(n: number): void;
	write(data: Uint8Array, opts?: { at: number }): number;
	flush(): void;
	close(): void;
};
/** Chrome's: writes land in a swap file, committed by `close()`. */
type Writable = {
	write(data: Uint8Array): Promise<void>;
	seek(at: number): Promise<void>;
	truncate(n: number): Promise<void>;
	close(): Promise<void>;
};
/** The parts of a file handle used here; each browser has some of them. */
type FileHandle = {
	getFile(): Promise<File>;
	createWritable?: (opts?: { keepExistingData?: boolean }) => Promise<Writable>;
	createSyncAccessHandle?: () => Promise<SyncHandle>;
	move?: (name: string) => Promise<void>;
};

/** How often a long download commits what it has, so a killed app keeps it. */
const CHECKPOINT = 8 * 1024 * 1024;

async function openAt(handle: FileHandle, at: number): Promise<Writable> {
	const w = await handle.createWritable!({ keepExistingData: at > 0 });
	if (at > 0) {
		await w.truncate(at);
		await w.seek(at);
	}
	return w;
}

/**
 * `res`'s body into `name`, from byte `from` on, a chunk at a time as it
 * comes (never the whole file in memory). What came is committed every
 * `checkpoint` bytes and when the body fails, so a cut-off download leaves
 * its bytes for the next write to go on from.
 */
async function writeFile(
	dir: FileSystemDirectoryHandle,
	name: string,
	res: Response,
	from = 0,
	checkpoint = CHECKPOINT
): Promise<void> {
	const handle = (await dir.getFileHandle(name, { create: true })) as unknown as FileHandle;
	const reader = res.body?.getReader();
	const chunks = async (each: (chunk: Uint8Array) => Promise<void>) => {
		if (!reader) return;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) return;
			await each(value);
		}
	};
	let at = from;
	let since = 0;
	try {
		// A sync handle first, where there is one (a dedicated worker: the device's):
		// it writes in place. Chrome's `createWritable` copies the whole file into a
		// swap at every reopen, gigabytes over a long video's checkpoints.
		if (handle.createSyncAccessHandle) {
			const h = await handle.createSyncAccessHandle();
			try {
				h.truncate(from);
				await chunks(async (chunk) => {
					h.write(chunk, { at });
					at += chunk.byteLength;
					since += chunk.byteLength;
					if (since >= checkpoint) {
						since = 0;
						h.flush();
					}
				});
			} finally {
				h.flush();
				h.close();
			}
			return;
		}
		// A window or the service worker (no sync handle there): a swap file, committed on close.
		if (!handle.createWritable) throw new Error('this browser cannot write files here');
		let w = await openAt(handle, at);
		try {
			await chunks(async (chunk) => {
				await w.write(chunk);
				at += chunk.byteLength;
				since += chunk.byteLength;
				if (since >= checkpoint) {
					since = 0;
					await w.close();
					w = await openAt(handle, at);
				}
			});
		} catch (e) {
			await w.close().catch(() => {});
			throw e;
		}
		await w.close();
	} catch (e) {
		// A write that failed (a full disk) leaves the body open: let it go.
		await reader?.cancel().catch(() => {});
		throw e;
	}
}

/** `from` under the name `to`: `move()` where there is one, else a copy (the meta, written after, vouches for it). */
async function rename(dir: FileSystemDirectoryHandle, from: string, to: string): Promise<void> {
	const handle = (await dir.getFileHandle(from)) as unknown as FileHandle;
	if (handle.move) {
		await handle.move(to);
		return;
	}
	await writeFile(dir, to, new Response(await handle.getFile()));
	await dir.removeEntry(from);
}

async function fileOf(dir: FileSystemDirectoryHandle, name: string): Promise<File | null> {
	try {
		return await (await dir.getFileHandle(name)).getFile();
	} catch {
		return null;
	}
}

async function removeIfThere(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
	try {
		await dir.removeEntry(name);
	} catch {
		// Not there: nothing to remove.
	}
}

async function names(dir: FileSystemDirectoryHandle): Promise<string[]> {
	const out: string[] = [];
	for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) {
		out.push(name);
	}
	return out;
}

/** The bytes and their meta when they are whole; null otherwise. */
async function whole(
	dir: FileSystemDirectoryHandle,
	file: string
): Promise<{ body: File; meta: Meta } | null> {
	const metaFile = await fileOf(dir, file + META);
	if (!metaFile) return null;
	let meta: Meta;
	try {
		meta = JSON.parse(await metaFile.text()) as Meta;
	} catch {
		return null;
	}
	const body = await fileOf(dir, file);
	if (!body || typeof meta.size !== 'number' || body.size !== meta.size) return null;
	return { body, meta };
}

/** The store in OPFS; null where this browser has none (it then plays from the network, as before). */
export async function opfsMediaStore(): Promise<MediaStore | null> {
	if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
	let root: FileSystemDirectoryHandle;
	try {
		root = await navigator.storage.getDirectory();
	} catch {
		return null;
	}
	return mediaStoreIn(root);
}

/** The store under `top`'s `media/` (OPFS's root in a browser; a stand-in in the specs). */
export function mediaStoreIn(
	top: FileSystemDirectoryHandle,
	opts: { checkpoint?: number } = {}
): MediaStore {
	const rootP = top.getDirectoryHandle(ROOT, { create: true });
	const dirOf = async (kind: MediaKind) => (await rootP).getDirectoryHandle(kind, { create: true });
	const fileNames = async (kind: MediaKind) =>
		(await names(await dirOf(kind))).filter((n) => !n.endsWith(PART) && !n.endsWith(META));

	return {
		async list() {
			const out: MediaFile[] = [];
			for (const kind of KINDS) {
				const dir = await dirOf(kind);
				for (const file of await fileNames(kind)) {
					const w = await whole(dir, file);
					if (w) out.push({ kind, file, mime: w.meta.mime });
				}
			}
			return out;
		},
		async read(kind, file) {
			if (!NAME.test(file) || file.endsWith(PART) || file.endsWith(META)) return null;
			const w = await whole(await dirOf(kind), file);
			return w ? { body: w.body, mime: w.meta.mime } : null;
		},
		async write(f, res, wopts) {
			if (!NAME.test(f.file)) throw new Error(`not a media name: ${f.file}`);
			const dir = await dirOf(f.kind);
			const part = f.file + PART;
			try {
				await writeFile(dir, part, res, wopts?.from ?? 0, opts.checkpoint);
			} catch (e) {
				// A video's part stays: the next write goes on from it.
				if (!resumable(f.kind)) await removeIfThere(dir, part);
				throw e;
			}
			const size = (await fileOf(dir, part))?.size ?? -1;
			if (f.size !== undefined && size !== f.size) {
				await removeIfThere(dir, part);
				throw new Error(`the file is ${size} bytes, not ${f.size}`);
			}
			// The old vouch goes first: from here until the new one, the name reads as missing.
			await removeIfThere(dir, f.file + META);
			await removeIfThere(dir, f.file);
			await rename(dir, part, f.file);
			const meta: Meta = { mime: f.mime, size };
			await writeFile(dir, f.file + META, new Response(JSON.stringify(meta)));
		},
		async partSize(kind, file) {
			if (!NAME.test(file)) return 0;
			return (await fileOf(await dirOf(kind), file + PART))?.size ?? 0;
		},
		async parts() {
			const out: { kind: MediaKind; file: string }[] = [];
			for (const kind of KINDS) {
				for (const n of await names(await dirOf(kind))) {
					if (n.endsWith(PART)) out.push({ kind, file: n.slice(0, -PART.length) });
				}
			}
			return out;
		},
		async remove(kind, file) {
			const dir = await dirOf(kind);
			await removeIfThere(dir, file + META);
			await removeIfThere(dir, file);
			await removeIfThere(dir, file + PART);
		},
		async clear(kinds = KINDS) {
			const root = await rootP;
			for (const kind of kinds) {
				try {
					await root.removeEntry(kind, { recursive: true });
					continue;
				} catch (e) {
					if ((e as DOMException)?.name === 'NotFoundError') continue;
				}
				// The folder would not go whole (a file in it still open): one entry at a time,
				// the vouches first, so whatever stays reads as missing.
				const dir = await dirOf(kind);
				const all = await names(dir);
				for (const n of [...all.filter((n) => n.endsWith(META)), ...all]) {
					await removeIfThere(dir, n);
				}
			}
		},
		async usage(kinds = KINDS) {
			let n = 0;
			for (const kind of kinds) {
				const dir = await dirOf(kind);
				for (const file of await fileNames(kind)) n += (await whole(dir, file))?.body.size ?? 0;
				// A cut-off download takes room too (the On this phone page counts it, Clear frees it).
				for (const part of (await names(dir)).filter((n) => n.endsWith(PART))) {
					n += (await fileOf(dir, part))?.size ?? 0;
				}
			}
			return n;
		}
	};
}
