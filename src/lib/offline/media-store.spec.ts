import { describe, expect, it } from 'vitest';
import { mediaOf, mediaPath, mediaStoreIn, memoryMediaStore, type MediaFile } from './media-store';

const SONG: MediaFile = {
	kind: 'audio',
	file: '54e60e0a-b733-4b4b-aef7-477f3ae68086.m4a',
	mime: 'audio/mp4'
};
const bytes = Uint8Array.from({ length: 300 }, (_, i) => i % 7);

/** A body that gives some bytes, then fails: a download cut off half way. */
function cutOff(): Response {
	return new Response(
		new ReadableStream<Uint8Array>({
			start(c) {
				c.enqueue(bytes.slice(0, 100));
				c.error(new Error('the signal went'));
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
		for (const path of ['/recordings/x.mp4', '/audio/../x', '/audio/a/b', '/audio/', '/audio']) {
			expect(mediaOf(path), path).toBeNull();
		}
		expect(mediaPath('audio', 'x.wav')).toBe('/audio/x.wav');
		expect(mediaPath('count', 'y.wav')).toBe('/count/y.wav');
	});
});

/*
 * A stand-in for the browser's own storage (OPFS): directories and files, with
 * or without `move()`, `createWritable()` and the sync access handle, and a
 * step that can be made to fail (a crash or a full disk at that point).
 */
type Caps = { move: boolean; writable: boolean; sync: boolean };
type Fail = (op: 'write' | 'move' | 'remove', name: string) => boolean;

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
			h.createWritable = async () => {
				if (this.dir.fail('write', this.name)) throw new Error(`disk full at ${this.name}`);
				const parts: BlobPart[] = [];
				return new WritableStream<Uint8Array>({
					write: (c) => void parts.push(new Uint8Array(c)),
					close: () => void (this.data = new Blob(parts))
				});
			};
		}
		if (this.dir.caps.sync) {
			h.createSyncAccessHandle = async () => {
				if (this.dir.fail('write', this.name)) throw new Error(`disk full at ${this.name}`);
				let buf = new Uint8Array(0);
				return {
					truncate: () => void (buf = new Uint8Array(0)),
					write: (d: Uint8Array) => {
						buf = new Uint8Array(d);
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
});
