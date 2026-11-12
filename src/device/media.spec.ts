import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import {
	mediaStoreIn,
	memoryMediaStore,
	ORIGINALS,
	VIDEO_KINDS,
	type MediaFile,
	type MediaStore
} from '$lib/offline/media-store';
import { LOW_SPACE_BYTES } from '$lib/offline/network';
import { asRoot, CAPS, FakeDir } from '$lib/offline/test-opfs';
import { migrateDevice } from './migrate';
import { repoMigrations } from './test-migrations';
import { landedOriginals, mediaKeeper, sweepOriginals, syncMedia, wantedMedia } from './media';

let db: Database.Database;
beforeEach(() => {
	db = new Database(':memory:');
	migrateDevice(db, repoMigrations());
	// A group's song without its group row: the copy's walls are the pull's, not this spec's.
	db.pragma('foreign_keys = OFF');
});

let ids = 1;
function song(over: Record<string, unknown> = {}): void {
	const row = {
		id: ids++,
		user_id: 'u1',
		team_id: null,
		status: 'ready',
		audio_file: `${ids}.m4a`,
		mime: 'audio/mp4',
		archived_at: null,
		...over
	};
	db.prepare(
		`INSERT INTO songs (id, user_id, team_id, status, audio_file, mime, archived_at, source_url, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, 'https://youtu.be/x', 0)`
	).run(row.id, row.user_id, row.team_id, row.status, row.audio_file, row.mime, row.archived_at);
}
function take(userId: string, file: string, phrase: 'a' | 'b' = 'a'): void {
	db.prepare(
		`INSERT INTO count_takes (id, user_id, pattern, bpm, phrase, file, sample_rate, pre_roll_s, length_s, duration_s, size_bytes, created_at)
		 VALUES (?, ?, 'salsa', 90, ?, ?, 48000, 0.5, 4, 5, 1000, 0)`
	).run(ids++, userId, phrase, file);
}

describe('wantedMedia: what the device keeps (offline phase 4a)', () => {
	it("the copy's songs with audio and the person's count takes", () => {
		song({ audio_file: 'mine.m4a' });
		song({ user_id: null, team_id: 7, audio_file: 'group.mp3', mime: 'audio/mpeg' });
		song({ audio_file: 'old.m4a', archived_at: 5 });
		song({ audio_file: null, mime: null, status: 'waiting_download' });
		take('u1', 'take.wav');
		take('u2', 'theirs.wav');
		const got = wantedMedia(db, 'u1');
		expect(got).toEqual(
			expect.arrayContaining([
				{ kind: 'audio', file: 'mine.m4a', mime: 'audio/mp4' },
				{ kind: 'audio', file: 'group.mp3', mime: 'audio/mpeg' },
				{ kind: 'count', file: 'take.wav', mime: 'audio/wav' }
			])
		);
		expect(got).toHaveLength(3);
	});
});

const A: MediaFile = { kind: 'audio', file: 'a.m4a', mime: 'audio/mp4' };
const B: MediaFile = { kind: 'audio', file: 'b.m4a', mime: 'audio/mp4' };
const T: MediaFile = { kind: 'count', file: 't.wav', mime: 'audio/wav' };

function run(
	wanted: MediaFile[],
	store: MediaStore,
	fetchMedia: (path: string) => Promise<Response> = async (p) => new Response(`bytes of ${p}`),
	online = true
) {
	const fetched: string[] = [];
	const result = syncMedia({
		wanted,
		store,
		fetchMedia: (p) => {
			fetched.push(p);
			return fetchMedia(p);
		},
		online: () => online,
		log: { warn: vi.fn() }
	});
	return { result, fetched };
}

describe('syncMedia: the store follows the copy', () => {
	it('fetches only what the store lacks', async () => {
		const store = memoryMediaStore();
		await store.write(A, new Response('held'));
		const { result, fetched } = run([A, B, T], store);
		expect(await result).toEqual({ fetched: 2, removed: 0, failed: 0, waiting: null });
		expect(fetched).toEqual(['/audio/b.m4a', '/count/t.wav']);
		const b = await store.read('audio', 'b.m4a');
		expect(await b?.body.text()).toBe('bytes of /audio/b.m4a');
		expect(b?.mime).toBe('audio/mp4');
	});

	it('removes what is no longer wanted (a song gone from the copy)', async () => {
		const store = memoryMediaStore();
		await store.write(A, new Response('a'));
		await store.write(B, new Response('b'));
		expect(await run([A], store).result).toEqual({
			fetched: 0,
			removed: 1,
			failed: 0,
			waiting: null
		});
		expect((await store.list()).map((f) => f.file)).toEqual(['a.m4a']);
	});

	it("a song's new audio: the old file goes, the new one comes", async () => {
		const store = memoryMediaStore();
		await store.write(A, new Response('old'));
		const { result, fetched } = run([B], store);
		expect(await result).toEqual({ fetched: 1, removed: 1, failed: 0, waiting: null });
		expect(fetched).toEqual(['/audio/b.m4a']);
		expect((await store.list()).map((f) => f.file)).toEqual(['b.m4a']);
	});

	it('a 404 or a failed fetch stores nothing, and the next file still comes', async () => {
		const store = memoryMediaStore();
		const { result } = run([A, B, T], store, async (p) => {
			if (p.endsWith('a.m4a')) return new Response('Not found', { status: 404 });
			if (p.endsWith('b.m4a')) throw new TypeError('Failed to fetch');
			return new Response('take');
		});
		expect(await result).toEqual({ fetched: 1, removed: 0, failed: 2, waiting: null });
		expect((await store.list()).map((f) => f.file)).toEqual(['t.wav']);
	});

	it('a body cut off half way stores nothing', async () => {
		const store = memoryMediaStore();
		const { result } = run([A], store, async () => {
			return new Response(
				new ReadableStream<Uint8Array>({
					start(c) {
						c.enqueue(new Uint8Array(10));
						c.error(new Error('the signal went'));
					}
				})
			);
		});
		expect(await result).toEqual({ fetched: 0, removed: 0, failed: 1, waiting: null });
		expect(await store.list()).toEqual([]);
	});

	it('offline: nothing fetched and nothing removed', async () => {
		const store = memoryMediaStore();
		await store.write(A, new Response('a'));
		const { result, fetched } = run([B], store, undefined, false);
		expect(await result).toEqual({ fetched: 0, removed: 0, failed: 0, waiting: null });
		expect(fetched).toEqual([]);
		expect((await store.list()).map((f) => f.file)).toEqual(['a.m4a']);
	});
});

describe('mediaKeeper: another person mid-download (the final review)', () => {
	/** A fetch that waits until released, then gives its bytes unless aborted. */
	function slowFetch() {
		const started: string[] = [];
		let release: () => void = () => {};
		const fetchMedia = (path: string, signal: AbortSignal) => {
			started.push(path);
			return new Promise<Response>((resolve, reject) => {
				signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
				release = () => resolve(new Response(`bytes of ${path}`));
			});
		};
		return { fetchMedia, started, release: () => release() };
	}

	it('clear stops the download in flight, and nothing of the first person lands after', async () => {
		const store = memoryMediaStore();
		await store.write(A, new Response('a'));
		const slow = slowFetch();
		const keeper = mediaKeeper({
			store: async () => store,
			wanted: () => [A, B, T],
			fetchMedia: slow.fetchMedia,
			online: () => true,
			log: { info: vi.fn(), warn: vi.fn() }
		});
		const running = keeper.sync();
		await vi.waitFor(() => expect(slow.started).toEqual(['/audio/b.m4a']));
		await keeper.clear();
		expect(await store.list()).toEqual([]);
		slow.release();
		await running;
		await new Promise((r) => setTimeout(r, 0));
		expect(await store.list()).toEqual([]);
		expect(slow.started).toEqual(['/audio/b.m4a']);
	});

	it('no copy to read: nothing is fetched or removed', async () => {
		const store = memoryMediaStore();
		await store.write(A, new Response('a'));
		const fetchMedia = vi.fn();
		const keeper = mediaKeeper({
			store: async () => store,
			wanted: () => null,
			fetchMedia,
			online: () => true,
			log: { info: vi.fn(), warn: vi.fn() }
		});
		await keeper.sync();
		expect(fetchMedia).not.toHaveBeenCalled();
		expect((await store.list()).map((f) => f.file)).toEqual(['a.m4a']);
	});

	it('a sync asked during one runs once more after it', async () => {
		const store = memoryMediaStore();
		let wanted: MediaFile[] = [A];
		const slow = slowFetch();
		const keeper = mediaKeeper({
			store: async () => store,
			wanted: () => wanted,
			fetchMedia: slow.fetchMedia,
			online: () => true,
			log: { info: vi.fn(), warn: vi.fn() }
		});
		const first = keeper.sync();
		await vi.waitFor(() => expect(slow.started).toHaveLength(1));
		wanted = [A, B];
		const second = keeper.sync();
		slow.release();
		await vi.waitFor(() => expect(slow.started).toHaveLength(2));
		slow.release();
		await Promise.all([first, second]);
		expect((await store.list()).map((f) => f.file).sort()).toEqual(['a.m4a', 'b.m4a']);
	});
});

const V_NEW: MediaFile = { kind: 'lesson-videos', file: 'new.mp4', mime: 'video/mp4', size: 300 };
const V_OLD: MediaFile = { kind: 'lesson-videos', file: 'old.mp4', mime: 'video/mp4', size: 10 };
const bytes = Uint8Array.from({ length: 300 }, (_, i) => i % 7);

/** syncMedia with 4b's deps; every fetch is logged with the range it asked for. */
function pass(
	wanted: MediaFile[],
	store: MediaStore,
	o: {
		fetchMedia?: (path: string, range?: number) => Promise<Response>;
		videosMayCome?: () => boolean;
		free?: () => Promise<number | null>;
		online?: boolean;
	} = {}
) {
	const fetched: { path: string; range?: number }[] = [];
	const progress: [string, number, number][] = [];
	const result = syncMedia({
		wanted,
		store,
		fetchMedia: (path, _signal, range) => {
			fetched.push({ path, range });
			return (o.fetchMedia ?? (async () => new Response(bytes)))(path, range);
		},
		online: () => o.online ?? true,
		videosMayCome: o.videosMayCome,
		free: o.free,
		onProgress: (k, r, t) => progress.push([k, r, t]),
		log: { warn: vi.fn() }
	});
	return { result, fetched, progress };
}

/** A body of `n` bytes of `bytes`, then the signal goes. */
function cutAfter(n: number): Response {
	let sent = false;
	return new Response(
		new ReadableStream<Uint8Array>({
			pull(c) {
				if (sent) return c.error(new Error('the signal went'));
				sent = true;
				c.enqueue(bytes.slice(0, n));
			}
		})
	);
}

describe('syncMedia: kept videos (offline phase 4b)', () => {
	it('songs come first, then videos in the order given (newest lesson first)', async () => {
		const store = memoryMediaStore();
		const { result, fetched } = pass([V_NEW, A, { ...V_OLD, size: 300 }], store);
		await result;
		expect(fetched.map((f) => f.path)).toEqual([
			'/audio/a.m4a',
			'/lesson-videos/new.mp4',
			'/lesson-videos/old.mp4'
		]);
	});

	it('on mobile data with Only on Wi-Fi, songs come and videos wait', async () => {
		const store = memoryMediaStore();
		await store.write({ ...V_OLD, size: undefined }, new Response('held'));
		const { result, fetched } = pass([A, V_NEW, V_OLD], store, { videosMayCome: () => false });
		expect(await result).toMatchObject({ fetched: 1, removed: 0, waiting: 'wifi' });
		expect(fetched.map((f) => f.path)).toEqual(['/audio/a.m4a']);
	});

	it('offline: videos still missing wait for a connection', async () => {
		const store = memoryMediaStore();
		const { result, fetched } = pass([V_NEW], store, { online: false });
		expect(await result).toMatchObject({ fetched: 0, waiting: 'offline' });
		expect(fetched).toEqual([]);
	});

	it('a video that would leave too little space waits; a smaller one still comes', async () => {
		const store = memoryMediaStore();
		const { result, fetched } = pass([V_NEW, V_OLD], store, {
			free: async () => LOW_SPACE_BYTES + 50,
			fetchMedia: async () => new Response(bytes.slice(0, 10))
		});
		expect(await result).toMatchObject({ fetched: 1, waiting: 'space' });
		expect(fetched.map((f) => f.path)).toEqual(['/lesson-videos/old.mp4']);
	});

	it.each(CAPS)('a cut-off video resumes from its part (%s)', async (_, caps) => {
		const store = mediaStoreIn(asRoot(new FakeDir(caps)));
		const first = pass([V_NEW], store, { fetchMedia: async () => cutAfter(100) });
		expect(await first.result).toMatchObject({ fetched: 0, failed: 1 });
		const second = pass([V_NEW], store, {
			fetchMedia: async () =>
				new Response(bytes.slice(100), {
					status: 206,
					headers: { 'Content-Range': 'bytes 100-299/300' }
				})
		});
		expect(await second.result).toMatchObject({ fetched: 1, failed: 0 });
		expect(second.fetched).toEqual([{ path: '/lesson-videos/new.mp4', range: 100 }]);
		const got = await store.read('lesson-videos', 'new.mp4');
		expect(new Uint8Array(await got!.body.arrayBuffer())).toEqual(bytes);
	});

	it('a 200 to a resume starts over instead of appending', async () => {
		const store = mediaStoreIn(asRoot(new FakeDir(CAPS[0][1])));
		await pass([V_NEW], store, { fetchMedia: async () => cutAfter(100) }).result;
		const second = pass([V_NEW], store);
		expect(await second.result).toMatchObject({ fetched: 1 });
		const got = await store.read('lesson-videos', 'new.mp4');
		expect(new Uint8Array(await got!.body.arrayBuffer())).toEqual(bytes);
	});

	it('a 206 from another byte than asked is a failure, not a file', async () => {
		const store = mediaStoreIn(asRoot(new FakeDir(CAPS[0][1])));
		await pass([V_NEW], store, { fetchMedia: async () => cutAfter(100) }).result;
		const second = pass([V_NEW], store, {
			fetchMedia: async () =>
				new Response(bytes.slice(50), {
					status: 206,
					headers: { 'Content-Range': 'bytes 50-299/300' }
				})
		});
		expect(await second.result).toMatchObject({ fetched: 0, failed: 1 });
		expect(await store.read('lesson-videos', 'new.mp4')).toBeNull();
	});

	it('progress is told, ending at the whole size', async () => {
		const store = memoryMediaStore();
		const { result, progress } = pass([V_NEW], store);
		await result;
		expect(progress.at(-1)).toEqual(['lesson-videos/new.mp4', 300, 300]);
	});
});

describe('mediaKeeper.restart (offline phase 4b)', () => {
	it('stops the file in flight and runs again', async () => {
		const store = memoryMediaStore();
		const signals: AbortSignal[] = [];
		let release: () => void = () => {};
		const keeper = mediaKeeper({
			store: async () => store,
			wanted: () => [V_NEW],
			fetchMedia: (path, signal) => {
				signals.push(signal);
				return new Promise<Response>((resolve, reject) => {
					signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
					release = () => resolve(new Response(bytes));
				});
			},
			online: () => true,
			videosMayCome: () => true,
			free: async () => null,
			onProgress: () => {},
			onPass: () => {},
			log: { info: vi.fn(), warn: vi.fn() }
		});
		const running = keeper.sync();
		await vi.waitFor(() => expect(signals).toHaveLength(1));
		const again = keeper.restart();
		await vi.waitFor(() => expect(signals).toHaveLength(2));
		expect(signals[0].aborted).toBe(true);
		release();
		await Promise.all([running, again]);
		expect((await store.list()).map((f) => f.file)).toEqual(['new.mp4']);
	});
});

describe('syncMedia: parts and removals (final review 3, 4, 5)', () => {
	const opfs = () => mediaStoreIn(asRoot(new FakeDir(CAPS[0][1])));

	it("a cut-off part of a video no longer wanted goes, and the store's size counts parts", async () => {
		const store = opfs();
		await pass([V_NEW], store, { fetchMedia: async () => cutAfter(100) }).result;
		expect(await store.usage(VIDEO_KINDS)).toBe(100);
		expect(await pass([], store).result).toMatchObject({ removed: 1 });
		expect(await store.partSize('lesson-videos', 'new.mp4')).toBe(0);
		expect(await store.usage(VIDEO_KINDS)).toBe(0);
	});

	it('a part that reached the whole size starts over instead of asking past the end', async () => {
		const store = opfs();
		await pass([V_NEW], store, { fetchMedia: async () => cutAfter(300) }).result;
		expect(await store.partSize('lesson-videos', 'new.mp4')).toBe(300);
		const second = pass([V_NEW], store);
		expect(await second.result).toMatchObject({ fetched: 1, failed: 0 });
		expect(second.fetched).toEqual([{ path: '/lesson-videos/new.mp4', range: undefined }]);
		const got = await store.read('lesson-videos', 'new.mp4');
		expect(new Uint8Array(await got!.body.arrayBuffer())).toEqual(bytes);
	});

	it('offline, a kept video no longer wanted goes (the person asked); a song stays', async () => {
		const store = memoryMediaStore();
		await store.write({ ...V_OLD, size: undefined }, new Response('v'));
		await store.write(A, new Response('a'));
		const { result } = pass([], store, { online: false });
		expect(await result).toMatchObject({ removed: 1, fetched: 0 });
		expect((await store.list()).map((f) => f.kind)).toEqual(['audio']);
	});
});

describe('syncMedia tells each file as it lands (phone, 2026-11-10)', () => {
	it('onStored after every write, in order', async () => {
		const store = memoryMediaStore();
		const stored: string[] = [];
		await syncMedia({
			wanted: [V_NEW, { ...V_OLD, size: 300 }],
			store,
			fetchMedia: async () => new Response(bytes),
			online: () => true,
			onStored: (f) => stored.push(f.file),
			log: { warn: vi.fn() }
		});
		expect(stored).toEqual(['new.mp4', 'old.mp4']);
	});
});

describe('sweepOriginals: an original goes only when the person deleted it (offline phase 4c)', () => {
	const O = (file: string, owner: string): MediaFile => ({
		kind: 'originals',
		file,
		mime: 'video/mp4',
		owner
	});
	async function storeWith(...fs: MediaFile[]) {
		const store = memoryMediaStore();
		for (const f of fs) await store.write(f, new Response(new Uint8Array(3)));
		return store;
	}
	const names = async (s: Awaited<ReturnType<typeof storeWith>>) =>
		(await s.list(ORIGINALS)).map((f) => f.file).sort();
	const sweep = (
		store: MediaStore,
		o: { rowFiles: string[]; landed: string[]; online?: boolean; person?: string }
	) =>
		sweepOriginals({
			store,
			person: o.person ?? 'u1',
			pulledOnline: o.online ?? true,
			rowFiles: new Set(o.rowFiles),
			landed: new Set(o.landed)
		});

	it('landed on the server, then its row gone after an online pull (deleted): the original goes', async () => {
		const store = await storeWith(O('kept.mp4', 'u1'), O('gone.mp4', 'u1'));
		expect(
			await sweep(store, { rowFiles: ['kept.mp4'], landed: ['kept.mp4', 'gone.mp4'] })
		).toEqual(['gone.mp4']);
		expect(await names(store)).toEqual(['kept.mp4']);
	});

	it('never landed (its add refused or held, or not sent yet): it stays, row or no row (final review 1, 2)', async () => {
		const store = await storeWith(O('refused.mp4', 'u1'), O('new.mp4', 'u1'));
		expect(await sweep(store, { rowFiles: [], landed: [] })).toEqual([]);
		expect(await names(store)).toEqual(['new.mp4', 'refused.mp4']);
	});

	it('offline: nothing goes', async () => {
		const store = await storeWith(O('gone.mp4', 'u1'));
		await sweep(store, { rowFiles: [], landed: ['gone.mp4'], online: false });
		expect(await names(store)).toEqual(['gone.mp4']);
	});

	it("another person's original stays, whatever this copy holds", async () => {
		const store = await storeWith(O('theirs.mp4', 'u2'), O('none.mp4', ''));
		await sweep(store, { rowFiles: [], landed: ['theirs.mp4', 'none.mp4'] });
		expect(await names(store)).toEqual(['none.mp4', 'theirs.mp4']);
	});

	it("the keeper's not-wanted sweep never touches originals", async () => {
		const store = await storeWith(O('mine.mp4', 'u1'));
		await syncMedia({
			wanted: [],
			store,
			fetchMedia: async () => new Response(null, { status: 404 }),
			online: () => true,
			log: console
		});
		expect(await names(store)).toEqual(['mine.mp4']);
	});
});

describe('landedOriginals: which originals the server has the rows of', () => {
	it('held here, its row in the copy, and no change waiting that names it', () => {
		expect(
			[
				...landedOriginals({
					before: new Set(['old.mp4']),
					held: ['old.mp4', 'synced.mp4', 'waiting.mp4', 'norow.mp4'],
					rowFiles: new Set(['old.mp4', 'synced.mp4', 'waiting.mp4']),
					pending: new Set(['waiting.mp4'])
				})
			].sort()
		).toEqual(['old.mp4', 'synced.mp4']);
	});

	it('one no longer held drops out', () => {
		expect([
			...landedOriginals({
				before: new Set(['gone.mp4']),
				held: [],
				rowFiles: new Set(),
				pending: new Set()
			})
		]).toEqual([]);
	});
});

describe('wantedMedia: figure loops (picker preview)', () => {
	function section(o: {
		spot: number;
		start?: number;
		end?: number | null;
		on: 'lesson' | 'recording';
		serverCopy?: 0 | 1;
		link?: 'figure' | 'drill' | null;
	}): void {
		const video = ids++;
		if (o.on === 'lesson') {
			db.prepare(
				`INSERT INTO lesson_videos (id, lesson_id, file, mime, size_bytes, created_at, server_copy)
				 VALUES (?, 1, ?, 'video/mp4', 10, 0, ?)`
			).run(video, `${video}.mp4`, o.serverCopy ?? 1);
		} else {
			db.prepare(
				`INSERT INTO recordings (id, figure_id, file, mime, kind, size_bytes, created_at, server_copy)
				 VALUES (?, 1, ?, 'video/mp4', 'video', 10, 0, ?)`
			).run(video, `${video}.mp4`, o.serverCopy ?? 1);
		}
		db.prepare(
			`INSERT INTO video_spots (id, lesson_video_id, recording_id, start_ms, end_ms, created_at)
			 VALUES (?, ?, ?, ?, ?, 0)`
		).run(
			o.spot,
			o.on === 'lesson' ? video : null,
			o.on === 'recording' ? video : null,
			o.start ?? 0,
			o.end === undefined ? 1000 : o.end
		);
		const link = o.link === undefined ? 'figure' : o.link;
		if (link)
			db.prepare(
				`INSERT INTO spot_links (id, spot_id, figure_id, exercise_id, created_at) VALUES (?, ?, ?, ?, 0)`
			).run(ids++, o.spot, link === 'figure' ? 1 : null, link === 'drill' ? 1 : null);
	}
	const loops = () =>
		wantedMedia(db, 'u1')
			.filter((f) => f.kind === 'loops')
			.map((f) => f.file)
			.sort();

	it('the strip and the still of every section linked to a figure, on a video the server has', () => {
		section({ spot: 900, start: 1000, end: 7000, on: 'lesson' });
		section({ spot: 901, on: 'recording' });
		section({ spot: 902, on: 'lesson', serverCopy: 0 });
		section({ spot: 903, on: 'lesson', link: 'drill' });
		section({ spot: 904, on: 'lesson', link: null });
		expect(loops()).toEqual([
			'900-1000-7000-still.jpg',
			'900-1000-7000.jpg',
			'901-0-1000-still.jpg',
			'901-0-1000.jpg'
		]);
		expect(wantedMedia(db, 'u1').find((f) => f.kind === 'loops')?.mime).toBe('image/jpeg');
	});

	it('a loop not cut yet (404) is neither fetched nor failed, and the next file still comes', async () => {
		const L: MediaFile = { kind: 'loops', file: '900-0-1000.jpg', mime: 'image/jpeg' };
		const store = memoryMediaStore();
		const { result } = run([L, A], store, async (p) =>
			p.startsWith('/loops/') ? new Response('Not found', { status: 404 }) : new Response('song')
		);
		expect(await result).toEqual({ fetched: 1, removed: 0, failed: 0, waiting: null });
	});
});
