import { createHash as nodeHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createHash, randomInt, timingSafeEqual } from './crypto';

describe("the device's createHash", () => {
	it("is Node's SHA-256 across the padding edges", () => {
		for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 70_000]) {
			const text = 'aé😀'.repeat(n).slice(0, n);
			const want = nodeHash('sha256').update(text).digest('hex');
			expect(createHash('sha256').update(text).digest('hex'), String(n)).toBe(want);
		}
	});

	it('takes updates in parts, bytes and the encodings Node gives', () => {
		const ours = () =>
			createHash('sha256')
				.update('field ')
				.update(new Uint8Array([1, 2, 255]));
		const node = () =>
			nodeHash('sha256')
				.update('field ')
				.update(new Uint8Array([1, 2, 255]));
		expect(ours().digest('hex')).toBe(node().digest('hex'));
		expect(ours().digest('base64')).toBe(node().digest('base64'));
		expect(ours().digest('base64url')).toBe(node().digest('base64url'));
		expect([...ours().digest()]).toEqual([...node().digest()]);
	});

	it('refuses another algorithm', () => {
		expect(() => createHash('md5')).toThrow(/md5/);
	});
});

describe('timingSafeEqual', () => {
	it('compares bytes, and refuses different lengths as Node does', () => {
		expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true);
		expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false);
		expect(() => timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toThrow();
	});
});

describe('randomInt', () => {
	it('stays in [lo, hi)', () => {
		const seen = new Set<number>();
		for (let i = 0; i < 500; i++) seen.add(randomInt(3, 6));
		expect([...seen].sort()).toEqual([3, 4, 5]);
		for (let i = 0; i < 100; i++) expect(randomInt(2)).toBeLessThan(2);
	});
});
