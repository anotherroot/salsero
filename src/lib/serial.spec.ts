import { describe, expect, it } from 'vitest';
import { serial } from './serial';

describe('serial', () => {
	it('runs one task at a time, in the order they came, and a failure stops none after it', async () => {
		const run = serial();
		const log: string[] = [];
		let release!: () => void;
		const first = run(async () => {
			log.push('a start');
			await new Promise<void>((r) => (release = r));
			log.push('a end');
			return 1;
		});
		const second = run(async () => {
			log.push('b');
			throw new Error('refused');
		});
		const third = run(async () => {
			log.push('c');
			return 3;
		});
		await Promise.resolve();
		expect(log).toEqual(['a start']);
		release();
		expect(await first).toBe(1);
		await expect(second).rejects.toThrow('refused');
		expect(await third).toBe(3);
		expect(log).toEqual(['a start', 'a end', 'b', 'c']);
	});
});
