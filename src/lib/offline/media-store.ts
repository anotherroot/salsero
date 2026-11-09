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
 * OPFS: `media/<kind>/<file>` is a whole file, `<file>.mime` its type beside
 * it. A download goes to `<file>.part` and is moved into place once whole;
 * `list` and `read` never see a `.part`.
 */
const PART = '.part';
const MIME = '.mime';
const ROOT = 'media';

type Writable = { write(data: Blob | BufferSource): Promise<void>; close(): Promise<void> };
type SyncHandle = {
	truncate(n: number): void;
	write(data: BufferSource, opts?: { at: number }): number;
	flush(): void;
	close(): void;
};
type FileHandle = FileSystemFileHandle & {
	createWritable?: () => Promise<Writable & WritableStream>;
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
		else await w.close();
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

async function rename(dir: FileSystemDirectoryHandle, from: string, to: string): Promise<void> {
	const handle = (await dir.getFileHandle(from)) as FileHandle;
	if (handle.move) {
		await handle.move(to);
		return;
	}
	await writeFile(dir, to, new Response(await handle.getFile()));
	await dir.removeEntry(from);
}

async function exists(dir: FileSystemDirectoryHandle, name: string): Promise<File | null> {
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

/** The store in OPFS; null where this browser has none (it then plays from the network, as before). */
export async function opfsMediaStore(): Promise<MediaStore | null> {
	if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
	let root: FileSystemDirectoryHandle;
	try {
		root = await (
			await navigator.storage.getDirectory()
		).getDirectoryHandle(ROOT, { create: true });
	} catch {
		return null;
	}
	const dirOf = (kind: MediaKind) => root.getDirectoryHandle(kind, { create: true });
	const wholeNames = async (kind: MediaKind) =>
		(await names(await dirOf(kind))).filter((n) => !n.endsWith(PART) && !n.endsWith(MIME));

	const store: MediaStore = {
		async list() {
			const out: MediaFile[] = [];
			for (const kind of KINDS) {
				const dir = await dirOf(kind);
				for (const file of await wholeNames(kind)) {
					const mime = await exists(dir, file + MIME);
					out.push({ kind, file, mime: mime ? await mime.text() : 'application/octet-stream' });
				}
			}
			return out;
		},
		async read(kind, file) {
			if (!NAME.test(file) || file.endsWith(PART) || file.endsWith(MIME)) return null;
			const dir = await dirOf(kind);
			const body = await exists(dir, file);
			if (!body) return null;
			const mime = await exists(dir, file + MIME);
			return { body, mime: mime ? await mime.text() : 'application/octet-stream' };
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
			await writeFile(dir, f.file + MIME, new Response(f.mime));
			await removeIfThere(dir, f.file);
			await rename(dir, part, f.file);
		},
		async remove(kind, file) {
			const dir = await dirOf(kind);
			await removeIfThere(dir, file);
			await removeIfThere(dir, file + MIME);
		},
		async clear() {
			for (const kind of KINDS) {
				try {
					await root.removeEntry(kind, { recursive: true });
				} catch {
					// Already gone.
				}
			}
		},
		async usage() {
			let n = 0;
			for (const kind of KINDS) {
				const dir = await dirOf(kind);
				for (const file of await wholeNames(kind)) n += (await exists(dir, file))?.size ?? 0;
			}
			return n;
		}
	};
	return store;
}
