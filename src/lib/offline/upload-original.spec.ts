import { describe, expect, it } from 'vitest';
import { uploadOriginal } from './upload-original';
import { uploadOf } from './uploads.svelte';

describe('uploadOriginal: Upload on a phone-only video (offline phase 4c)', () => {
	it('reads the original here and sends it to its row’s file route', async () => {
		const urls: string[] = [];
		const out = await uploadOriginal(
			{ table: 'recordings', id: 12, file: 'a.mp4' },
			{
				get: async () => new Blob([new Uint8Array(5)], { type: 'video/mp4' }),
				put: async (url) => {
					urls.push(url);
					expect(uploadOf('a.mp4')).toBe(0);
					return { ok: true, body: '{}' };
				},
				uuid: () => '0f8fad5b-d9cb-469f-a165-70867728950e',
				synced: () => {}
			}
		);
		expect(out).toEqual({ ok: true });
		expect(urls).toEqual(['/api/recordings/12/file/0f8fad5b-d9cb-469f-a165-70867728950e']);
		expect(uploadOf('a.mp4')).toBeNull();
	});

	it('no original here: not sent', async () => {
		let sent = false;
		const out = await uploadOriginal(
			{ table: 'lesson_videos', id: 3, file: 'b.mp4' },
			{
				get: async () => null,
				put: async () => {
					sent = true;
					return { ok: true, body: '' };
				},
				uuid: () => 'x',
				synced: () => {}
			}
		);
		expect(out.ok).toBe(false);
		expect(sent).toBe(false);
	});
});

describe('uploadOriginal: after the review (4c minors)', () => {
	const deps = (log: string[], put: () => Promise<{ ok: true; body: string }>) => ({
		get: async () => new Blob([new Uint8Array(5)], { type: 'video/mp4' }),
		put: async () => {
			log.push('put');
			return put();
		},
		uuid: () => 'u',
		synced: () => {},
		pushFirst: async () => {
			log.push('push');
		}
	});

	it('pushes what waits first, so the row is on the server before its bytes', async () => {
		const log: string[] = [];
		await uploadOriginal(
			{ table: 'recordings', id: 1, file: 'p.mp4' },
			deps(log, async () => ({ ok: true, body: '' }))
		);
		expect(log).toEqual(['push', 'put']);
	});

	it('a second Upload while one runs joins it, and is no failure', async () => {
		const log: string[] = [];
		let finish: () => void = () => {};
		const slow = () =>
			new Promise<{ ok: true; body: string }>((r) => (finish = () => r({ ok: true, body: '' })));
		const first = uploadOriginal({ table: 'recordings', id: 1, file: 'j.mp4' }, deps(log, slow));
		await new Promise((r) => setTimeout(r, 0));
		const second = uploadOriginal({ table: 'recordings', id: 1, file: 'j.mp4' }, deps(log, slow));
		finish();
		expect(await second).toEqual({ ok: true });
		expect(await first).toEqual({ ok: true });
		expect(log.filter((l) => l === 'put')).toHaveLength(1);
	});
});
