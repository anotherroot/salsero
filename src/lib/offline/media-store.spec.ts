import { describe, expect, it } from 'vitest';
import { mediaOf, mediaPath, memoryMediaStore, type MediaFile } from './media-store';

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
