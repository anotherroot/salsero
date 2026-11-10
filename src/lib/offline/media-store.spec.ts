import { describe, expect, it, vi } from 'vitest';
import {
	mediaOf,
	mediaPath,
	mediaStoreIn,
	memoryMediaStore,
	VIDEO_KINDS,
	type MediaFile
} from './media-store';

const SONG: MediaFile = {
	kind: 'audio',
	file: '54e60e0a-b733-4b4b-aef7-477f3ae68086.m4a',
	mime: 'audio/mp4'
};
const VIDEO: MediaFile = { kind: 'lesson-videos', file: 'v.mp4', mime: 'video/mp4', size: 300 };
const bytes = Uint8Array.from({ length: 300 }, (_, i) => i % 7);

/** A body that gives some bytes, then fails: a download cut off half way. */
function cutOff(): Response {
	let sent = false;
	return new Response(
		new ReadableStream<Uint8Array>({
			pull(c) {
				if (sent) return c.error(new Error('the signal went'));
				sent = true;
				c.enqueue(bytes.slice(0, 100));
			}
		})
	);
}

describe('the media store (offline phase 4a)', () => {
	it('write then read: the bytes and the mime come back', async () => {
		const store = memoryMediaStore();
		await store.write(SONG, new Response(bytes));
		const got = await store.read('audio', SONG.file);
		expect(got?.mime).toBe('audio/mp4');
		expect(new Uint8Array(await got!.body.arrayBuffer())).toEqual(bytes);
		expect(await store.list()).toEqual([SONG]);
		expect(await store.usage()).toBe(300);
		expect(await store.read('count', SONG.file)).toBeNull();
	});

	it('a body that errors half way stores nothing', async () => {
		const store = memoryMediaStore();
		await expect(store.write(SONG, cutOff())).rejects.toThrow();
		expect(await store.read('audio', SONG.file)).toBeNull();
		expect(await store.list()).toEqual([]);
		expect(await store.usage()).toBe(0);
	});

	it('remove and clear leave nothing', async () => {
		const store = memoryMediaStore();
		const take: MediaFile = { kind: 'count', file: 'a.wav', mime: 'audio/wav' };
		await store.write(SONG, new Response(bytes));
		await store.write(take, new Response(bytes));
		await store.remove('audio', SONG.file);
		expect(await store.list()).toEqual([take]);
		await store.clear();
		expect(await store.list()).toEqual([]);
		expect(await store.usage()).toBe(0);
	});

	it('a path to a file and back', () => {
		expect(mediaOf('/audio/x.wav')).toEqual({ kind: 'audio', file: 'x.wav' });
		expect(mediaOf('/count/y.wav')).toEqual({ kind: 'count', file: 'y.wav' });
		expect(mediaOf('/lesson-videos/x.mp4')).toEqual({ kind: 'lesson-videos', file: 'x.mp4' });
		expect(mediaOf('/recordings/y.webm')).toEqual({ kind: 'recordings', file: 'y.webm' });
		for (const path of [
			'/videos/x.mp4',
			'/lesson-videos/../x',
			'/audio/../x',
			'/audio/a/b',
			'/audio/',
			'/audio'
		]) {
			expect(mediaOf(path), path).toBeNull();
		}
		expect(mediaPath('audio', 'x.wav')).toBe('/audio/x.wav');
		expect(mediaPath('count', 'y.wav')).toBe('/count/y.wav');
		expect(mediaPath('recordings', 'y.webm')).toBe('/recordings/y.webm');
	});

	it('in memory: from, partSize, usage and clear by kind (offline phase 4b)', async () => {
		const store = memoryMediaStore();
		await expect(store.write(VIDEO, cutOff())).rejects.toThrow();
		expect(await store.partSize('lesson-videos', VIDEO.file)).toBe(0);
		await store.write(SONG, new Response(bytes));
		// Short of the size its row says: refused.
		await expect(store.write(VIDEO, new Response(bytes.slice(0, 100)))).rejects.toThrow();
		expect(await store.read('lesson-videos', VIDEO.file)).toBeNull();
		await store.write(VIDEO, new Response(bytes));
		expect(await store.usage(VIDEO_KINDS)).toBe(300);
		await store.clear(VIDEO_KINDS);
		expect((await store.list()).map((f) => f.kind)).toEqual(['audio']);
	});
});

/*
 * A stand-in for the browser's own storage (OPFS): directories and files, with
 * or without `move()`, `createWritable()` and the sync access handle, and a
 * step that can be made to fail (a crash or a full disk at that point).
 */
type Caps = { move: boolean; writable: boolean; sync: boolean };
type Fail = (op: 'write' | 'move' | 'remove', name: string) => boolean;

/** `d` written into `buf` at `at`, growing it. */
function put(buf: Uint8Array, d: Uint8Array, at: number): Uint8Array {
	const out = new Uint8Array(Math.max(buf.byteLength, at + d.byteLength));
	out.set(buf);
	out.set(d, at);
	return out;
}

class FakeFile {
	data = new Blob([]);
	constructor(
		private dir: FakeDir,
		public name: string
	) {}
	get handle(): Record<string, unknown> {
		const h: Record<string, unknown> = {
			kind: 'file',
			name: this.name,
			getFile: async () => new File([this.data], this.name)
		};
		if (this.dir.caps.writable) {
			// As Chrome's: writes go to a swap file, committed on close, dropped on abort.
			h.createWritable = async (opts?: { keepExistingData?: boolean }) => {
				if (this.dir.fail('write', this.name)) throw new Error(`disk full at ${this.name}`);
				let buf = opts?.keepExistingData
					? new Uint8Array(await this.data.arrayBuffer())
					: new Uint8Array(0);
				let at = 0;
				const stream = new WritableStream<Uint8Array>({
					write: (c) => {
						buf = put(buf, new Uint8Array(c), at);
						at += c.byteLength;
					},
					close: () => void (this.data = new Blob([buf]))
				});
				return Object.assign(stream, {
					write: async (c: Uint8Array) => {
						buf = put(buf, new Uint8Array(c), at);
						at += c.byteLength;
					},
					seek: async (n: number) => void (at = n),
					truncate: async (n: number) => void (buf = buf.slice(0, n))
				});
			};
		}
		if (this.dir.caps.sync) {
			h.createSyncAccessHandle = async () => {
				if (this.dir.fail('write', this.name)) throw new Error(`disk full at ${this.name}`);
				let buf = new Uint8Array(await this.data.arrayBuffer());
				return {
					getSize: () => buf.byteLength,
					truncate: (n: number) => void (buf = buf.slice(0, n)),
					write: (d: Uint8Array, opts?: { at?: number }) => {
						const at = opts?.at ?? 0;
						this.dir.syncLog.push({ name: this.name, at });
						buf = put(buf, new Uint8Array(d), at);
						return d.byteLength;
					},
					flush: () => void (this.data = new Blob([buf])),
					close: () => {}
				};
			};
		}
		if (this.dir.caps.move) {
			h.move = async (to: string) => {
				if (this.dir.fail('move', this.name)) throw new Error(`crash moving ${this.name}`);
				this.dir.entries.delete(this.name);
				this.name = to;
				this.dir.entries.set(to, this);
			};
		}
		return h;
	}
}

class FakeDir {
	entries = new Map<string, FakeFile | FakeDir>();
	refuseRecursive = false;
	/** Every sync-handle write: which file, at which offset. */
	syncLog: { name: string; at: number }[] = [];
	constructor(
		public caps: Caps,
		public fail: Fail = () => false
	) {}
	async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FakeDir> {
		let d = this.entries.get(name);
		if (!d && opts?.create) this.entries.set(name, (d = new FakeDir(this.caps, this.fail)));
		if (!(d instanceof FakeDir)) throw new DOMException('no such directory', 'NotFoundError');
		return d;
	}
	async getFileHandle(name: string, opts?: { create?: boolean }) {
		let f = this.entries.get(name);
		if (!f && opts?.create) this.entries.set(name, (f = new FakeFile(this, name)));
		if (!(f instanceof FakeFile)) throw new DOMException('no such file', 'NotFoundError');
		return f.handle;
	}
	async removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void> {
		const e = this.entries.get(name);
		if (!e) throw new DOMException('no such entry', 'NotFoundError');
		if (e instanceof FakeDir && opts?.recursive && e.refuseRecursive) {
			throw new DOMException('a file in it is open', 'NoModificationAllowedError');
		}
		if (this.fail('remove', name)) throw new Error(`crash removing ${name}`);
		this.entries.delete(name);
	}
	async *keys(): AsyncIterable<string> {
		for (const k of [...this.entries.keys()]) yield k;
	}
}

const asRoot = (d: FakeDir) => d as unknown as FileSystemDirectoryHandle;
const CAPS: [string, Caps][] = [
	[
		'Chrome and the Android WebView (createWritable, move)',
		{ move: true, writable: true, sync: false }
	],
	['a browser without move()', { move: false, writable: true, sync: false }],
	[
		'Safari before createWritable (a sync handle, no move)',
		{ move: false, writable: false, sync: true }
	]
];

describe.each(CAPS)('the media store in OPFS: %s', (_, caps) => {
	it('write then read: the bytes, the mime and the size', async () => {
		const store = mediaStoreIn(asRoot(new FakeDir(caps)));
		await store.write(SONG, new Response(bytes));
		const got = await store.read('audio', SONG.file);
		expect(got?.mime).toBe('audio/mp4');
		expect(new Uint8Array(await got!.body.arrayBuffer())).toEqual(bytes);
		expect(await store.list()).toEqual([SONG]);
		expect(await store.usage()).toBe(300);
	});

	it('a body that errors half way stores nothing', async () => {
		const store = mediaStoreIn(asRoot(new FakeDir(caps)));
		await expect(store.write(SONG, cutOff())).rejects.toThrow();
		expect(await store.read('audio', SONG.file)).toBeNull();
		expect(await store.list()).toEqual([]);
		expect(await store.usage()).toBe(0);
	});

	it('a crash at any step of the commit never leaves a file that reads as whole', async () => {
		for (const step of ['move', 'write-final', 'write-meta'] as const) {
			const fail: Fail = (op, name) =>
				(step === 'move' && op === 'move') ||
				(step === 'write-final' && op === 'write' && name === SONG.file) ||
				(step === 'write-meta' && op === 'write' && name.endsWith('.meta'));
			const store = mediaStoreIn(asRoot(new FakeDir(caps, fail)));
			await store.write(SONG, new Response(bytes)).catch(() => {});
			const got = await store.read('audio', SONG.file);
			// Either the whole file, or nothing at all.
			if (got) expect(got.body.size, step).toBe(300);
			const listed = await store.list();
			if (listed.length) expect(got, step).not.toBeNull();
		}
	});

	it('a file whose bytes are short of what was recorded is not served', async () => {
		const root = new FakeDir(caps);
		const store = mediaStoreIn(asRoot(root));
		await store.write(SONG, new Response(bytes));
		const dir = (await (
			await root.getDirectoryHandle('media')
		).getDirectoryHandle('audio')) as FakeDir;
		(dir.entries.get(SONG.file) as FakeFile).data = new Blob([bytes.slice(0, 10)]);
		expect(await store.read('audio', SONG.file)).toBeNull();
		expect(await store.list()).toEqual([]);
	});

	it('clear empties the store even when a folder refuses to go whole', async () => {
		const root = new FakeDir(caps);
		const store = mediaStoreIn(asRoot(root));
		await store.write(SONG, new Response(bytes));
		const media = (await root.getDirectoryHandle('media')) as FakeDir;
		(await media.getDirectoryHandle('audio')).refuseRecursive = true;
		await store.clear();
		expect(await store.list()).toEqual([]);
		expect(await store.read('audio', SONG.file)).toBeNull();
	});

	it('a video cut off half way keeps its part, and the next write goes on from it', async () => {
		const store = mediaStoreIn(asRoot(new FakeDir(caps)));
		await expect(store.write(VIDEO, cutOff())).rejects.toThrow();
		expect(await store.partSize('lesson-videos', 'v.mp4')).toBe(100);
		expect(await store.read('lesson-videos', 'v.mp4')).toBeNull();
		expect(await store.list()).toEqual([]);
		await store.write(VIDEO, new Response(bytes.slice(100)), { from: 100 });
		const got = await store.read('lesson-videos', 'v.mp4');
		expect(new Uint8Array(await got!.body.arrayBuffer())).toEqual(bytes);
		expect(await store.partSize('lesson-videos', 'v.mp4')).toBe(0);
	});

	it('a song cut off half way keeps nothing (4a, unchanged)', async () => {
		const store = mediaStoreIn(asRoot(new FakeDir(caps)));
		await expect(store.write(SONG, cutOff())).rejects.toThrow();
		expect(await store.partSize('audio', SONG.file)).toBe(0);
	});

	it('a whole file of another size than the row says is refused and dropped', async () => {
		const store = mediaStoreIn(asRoot(new FakeDir(caps)));
		await expect(store.write({ ...VIDEO, size: 999 }, new Response(bytes))).rejects.toThrow();
		expect(await store.read('lesson-videos', 'v.mp4')).toBeNull();
		expect(await store.partSize('lesson-videos', 'v.mp4')).toBe(0);
	});

	it('a long download commits its part as it goes, so a killed app keeps it', async () => {
		const store = mediaStoreIn(asRoot(new FakeDir(caps)), { checkpoint: 100 });
		let c!: ReadableStreamDefaultController<Uint8Array>;
		const body = new ReadableStream<Uint8Array>({ start: (ctl) => void (c = ctl) });
		const writing = store.write(VIDEO, new Response(body));
		c.enqueue(bytes.slice(0, 100));
		c.enqueue(bytes.slice(100, 200));
		// Never closed: the app is killed here.
		await vi.waitFor(async () =>
			expect(await store.partSize('lesson-videos', 'v.mp4')).toBeGreaterThanOrEqual(100)
		);
		c.error(new Error('killed'));
		await expect(writing).rejects.toThrow();
	});

	it('usage and clear by kind: clearing videos leaves the songs', async () => {
		const store = mediaStoreIn(asRoot(new FakeDir(caps)));
		await store.write(SONG, new Response(bytes));
		await store.write(VIDEO, new Response(bytes));
		expect(await store.usage(VIDEO_KINDS)).toBe(300);
		expect(await store.usage()).toBe(600);
		await store.clear(VIDEO_KINDS);
		expect((await store.list()).map((f) => f.kind)).toEqual(['audio']);
	});
});

describe('the media store on Safari before createWritable (offline phase 4b)', () => {
	it('writes each chunk as it comes, never the whole file at once', async () => {
		const root = new FakeDir({ move: false, writable: false, sync: true });
		const store = mediaStoreIn(asRoot(root));
		const body = new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(bytes.slice(0, 100));
				c.enqueue(bytes.slice(100, 200));
				c.enqueue(bytes.slice(200));
				c.close();
			}
		});
		await store.write(VIDEO, new Response(body));
		const dir = (await (
			await root.getDirectoryHandle('media')
		).getDirectoryHandle('lesson-videos')) as FakeDir;
		const file = dir.entries.get(VIDEO.file) as FakeFile;
		expect(new Uint8Array(await file.data.arrayBuffer())).toEqual(bytes);
		const partWrites = dir.syncLog.filter((w) => w.name === `${VIDEO.file}.part`);
		expect(partWrites.map((w) => w.at)).toEqual([0, 100, 200]);
		const got = await store.read('lesson-videos', VIDEO.file);
		expect(new Uint8Array(await got!.body.arrayBuffer())).toEqual(bytes);
	});
});
