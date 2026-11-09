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

/** Song audio (`/audio/<file>`) and count takes (`/count/<file>`). */
export type MediaKind = 'audio' | 'count';
export type MediaFile = { kind: MediaKind; file: string; mime: string };

export type MediaStore = {
	/** What the store holds, whole files only. */
	list(): Promise<MediaFile[]>;
	/** The file and its type, or null. */
	read(kind: MediaKind, file: string): Promise<{ body: Blob; mime: string } | null>;
	/** Reads the response's body to the end, then commits; a body that fails stores nothing. */
	write(f: MediaFile, res: Response): Promise<void>;
	remove(kind: MediaKind, file: string): Promise<void>;
	clear(): Promise<void>;
	/** Bytes held. */
	usage(): Promise<number>;
};

const KINDS: readonly MediaKind[] = ['audio', 'count'];
/** A server name: no slashes, no dot first (so never `..`). */
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function mediaPath(kind: MediaKind, file: string): string {
	return `/${kind}/${file}`;
}

/** The kind and name a media path asks for, or null when it is no media path. */
export function mediaOf(path: string): { kind: MediaKind; file: string } | null {
	const m = /^\/([a-z]+)\/([^/]+)$/.exec(path);
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
		async write(f, res) {
			const body = new Blob([await res.arrayBuffer()]);
			files.set(key(f.kind, f.file), { f, body });
		},
		async remove(kind, file) {
			files.delete(key(kind, file));
		},
		async clear() {
			files.clear();
		},
		async usage() {
			let n = 0;
			for (const e of files.values()) n += e.body.size;
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
	write(data: BufferSource, opts?: { at: number }): number;
	flush(): void;
	close(): void;
};
type FileHandle = FileSystemFileHandle & {
	createWritable?: () => Promise<WritableStream>;
	createSyncAccessHandle?: () => Promise<SyncHandle>;
	move?: (name: string) => Promise<void>;
};

async function writeFile(
	dir: FileSystemDirectoryHandle,
	name: string,
	res: Response
): Promise<void> {
	const handle = (await dir.getFileHandle(name, { create: true })) as FileHandle;
	if (handle.createWritable) {
		const w = await handle.createWritable();
		if (res.body) await res.body.pipeTo(w);
		else await w.getWriter().close();
		return;
	}
	// Safari before createWritable: a sync handle, which only a dedicated worker has.
	if (!handle.createSyncAccessHandle) throw new Error('this browser cannot write files here');
	const data = new Uint8Array(await res.arrayBuffer());
	const h = await handle.createSyncAccessHandle();
	try {
		h.truncate(0);
		h.write(data, { at: 0 });
		h.flush();
	} finally {
		h.close();
	}
}

/** `from` under the name `to`: `move()` where there is one, else a copy (the meta, written after, vouches for it). */
async function rename(dir: FileSystemDirectoryHandle, from: string, to: string): Promise<void> {
	const handle = (await dir.getFileHandle(from)) as FileHandle;
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
export function mediaStoreIn(top: FileSystemDirectoryHandle): MediaStore {
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
		async write(f, res) {
			if (!NAME.test(f.file)) throw new Error(`not a media name: ${f.file}`);
			const dir = await dirOf(f.kind);
			const part = f.file + PART;
			try {
				await writeFile(dir, part, res);
			} catch (e) {
				await removeIfThere(dir, part);
				throw e;
			}
			const size = (await fileOf(dir, part))?.size ?? -1;
			// The old vouch goes first: from here until the new one, the name reads as missing.
			await removeIfThere(dir, f.file + META);
			await removeIfThere(dir, f.file);
			await rename(dir, part, f.file);
			const meta: Meta = { mime: f.mime, size };
			await writeFile(dir, f.file + META, new Response(JSON.stringify(meta)));
		},
		async remove(kind, file) {
			const dir = await dirOf(kind);
			await removeIfThere(dir, file + META);
			await removeIfThere(dir, file);
			await removeIfThere(dir, file + PART);
		},
		async clear() {
			const root = await rootP;
			for (const kind of KINDS) {
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
		async usage() {
			let n = 0;
			for (const kind of KINDS) {
				const dir = await dirOf(kind);
				for (const file of await fileNames(kind)) n += (await whole(dir, file))?.body.size ?? 0;
			}
			return n;
		}
	};
}
