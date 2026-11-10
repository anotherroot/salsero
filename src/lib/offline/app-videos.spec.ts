import { describe, expect, it, vi } from 'vitest';
import { appVideosOn } from './app-videos';

/** The app's bridge as a page sees it: postMessage out, onmessage in. */
function fakeBridge() {
	const sent: Record<string, unknown>[] = [];
	const bridge = {
		onmessage: null as ((e: { data: string }) => void) | null,
		postMessage(data: string) {
			sent.push(JSON.parse(data));
		}
	};
	const reply = (body: object) => bridge.onmessage?.({ data: JSON.stringify(body) });
	return { bridge, sent, reply };
}

describe('appVideos: the Android app keeps originals in the gallery (offline phase 4c)', () => {
	it('no bridge (an older app, a browser): null', () => {
		expect(appVideosOn({})).toBeNull();
	});

	it('a reply finds its question by id', async () => {
		const f = fakeBridge();
		const app = appVideosOn({ SalsaVideos: f.bridge })!;
		const asked = app.pick(true, 'u1');
		expect(f.sent[0]).toMatchObject({ op: 'pick', multiple: true, userId: 'u1' });
		f.reply({ id: 'other', files: [] });
		f.reply({
			id: f.sent[0].id,
			files: [{ file: 'a.mp4', mime: 'video/mp4', size: 5, name: 'x' }]
		});
		expect(await asked).toEqual([{ file: 'a.mp4', mime: 'video/mp4', size: 5, name: 'x' }]);
	});

	it('no answer in time: null, and a late one is dropped', async () => {
		vi.useFakeTimers();
		try {
			const f = fakeBridge();
			const app = appVideosOn({ SalsaVideos: f.bridge }, 1000)!;
			const asked = app.space();
			vi.advanceTimersByTime(1001);
			expect(await asked).toBeNull();
			f.reply({ id: f.sent[0].id, free: 1, gallery: 2 });
		} finally {
			vi.useRealTimers();
		}
	});

	it("an upload's progress reaches its listener", () => {
		const f = fakeBridge();
		const app = appVideosOn({ SalsaVideos: f.bridge })!;
		const seen: unknown[] = [];
		app.on((e) => seen.push(e));
		f.reply({ event: 'progress', file: 'a.mp4', pct: 40 });
		f.reply({ event: 'done', file: 'a.mp4', pct: null });
		expect(seen).toEqual([
			{ event: 'progress', file: 'a.mp4', pct: 40 },
			{ event: 'done', file: 'a.mp4', pct: null }
		]);
	});
});
