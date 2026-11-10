import { describe, expect, it } from 'vitest';
import { startUpload, uploadOf } from './uploads.svelte';

describe('uploads in flight (offline phase 4c)', () => {
	it('how far, while it runs; gone after, done or failed', async () => {
		let step: (pct: number) => void = () => {};
		let finish: () => void = () => {};
		const run = startUpload('a.mp4', (onPct) => {
			step = onPct;
			return new Promise<void>((r) => (finish = r));
		});
		expect(uploadOf('a.mp4')).toBe(0);
		step(40);
		expect(uploadOf('a.mp4')).toBe(40);
		finish();
		await run;
		expect(uploadOf('a.mp4')).toBeNull();

		await expect(
			startUpload('b.mp4', async () => Promise.reject(new Error('cut')))
		).rejects.toThrow();
		expect(uploadOf('b.mp4')).toBeNull();
	});

	it('one at a time per file: a second start joins the first', async () => {
		let finish: () => void = () => {};
		let runs = 0;
		const go = () =>
			startUpload('c.mp4', () => {
				runs++;
				return new Promise<void>((r) => (finish = r));
			});
		const a = go();
		const b = go();
		finish();
		await Promise.all([a, b]);
		expect(runs).toBe(1);
	});
});
