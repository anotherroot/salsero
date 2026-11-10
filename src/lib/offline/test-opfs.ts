/* Shared by the media store's and the keeper's specs (offline phase 4a, 4b). */
/*
 * A stand-in for the browser's own storage (OPFS): directories and files, with
 * or without `move()`, `createWritable()` and the sync access handle, and a
 * step that can be made to fail (a crash or a full disk at that point).
 */
export type Caps = { move: boolean; writable: boolean; sync: boolean };
export type Fail = (op: 'write' | 'move' | 'remove', name: string) => boolean;

/** `d` written into `buf` at `at`, growing it. */
function put(buf: Uint8Array, d: Uint8Array, at: number): Uint8Array {
	const out = new Uint8Array(Math.max(buf.byteLength, at + d.byteLength));
	out.set(buf);
	out.set(d, at);
	return out;
}

export class FakeFile {
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

export class FakeDir {
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

export const asRoot = (d: FakeDir) => d as unknown as FileSystemDirectoryHandle;
export const CAPS: [string, Caps][] = [
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
