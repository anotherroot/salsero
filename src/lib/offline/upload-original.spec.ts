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
