import { beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { memoryMediaStore, type MediaFile, type MediaStore } from '$lib/offline/media-store';
import { migrateDevice } from './migrate';
import { repoMigrations } from './test-migrations';
import { syncMedia, wantedMedia } from './media';

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
		expect(await result).toEqual({ fetched: 2, removed: 0, failed: 0 });
		expect(fetched).toEqual(['/audio/b.m4a', '/count/t.wav']);
		const b = await store.read('audio', 'b.m4a');
		expect(await b?.body.text()).toBe('bytes of /audio/b.m4a');
		expect(b?.mime).toBe('audio/mp4');
	});

	it('removes what is no longer wanted (a song gone from the copy)', async () => {
		const store = memoryMediaStore();
		await store.write(A, new Response('a'));
		await store.write(B, new Response('b'));
		expect(await run([A], store).result).toEqual({ fetched: 0, removed: 1, failed: 0 });
		expect((await store.list()).map((f) => f.file)).toEqual(['a.m4a']);
	});

	it("a song's new audio: the old file goes, the new one comes", async () => {
		const store = memoryMediaStore();
		await store.write(A, new Response('old'));
		const { result, fetched } = run([B], store);
		expect(await result).toEqual({ fetched: 1, removed: 1, failed: 0 });
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
		expect(await result).toEqual({ fetched: 1, removed: 0, failed: 2 });
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
		expect(await result).toEqual({ fetched: 0, removed: 0, failed: 1 });
		expect(await store.list()).toEqual([]);
	});

	it('offline: nothing fetched and nothing removed', async () => {
		const store = memoryMediaStore();
		await store.write(A, new Response('a'));
		const { result, fetched } = run([B], store, undefined, false);
		expect(await result).toEqual({ fetched: 0, removed: 0, failed: 0 });
		expect(fetched).toEqual([]);
		expect((await store.list()).map((f) => f.file)).toEqual(['a.m4a']);
	});
});
