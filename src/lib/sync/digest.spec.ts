import { describe, expect, it } from 'vitest';
import { digestInput, keyString } from './digest';
import { serverDigest } from '$lib/server/sync/pull';

describe('digest', () => {
	it('writes one key as its text and several as JSON', () => {
		expect(keyString([7])).toBe('7');
		expect(keyString([3, 'u1'])).toBe('[3,"u1"]');
	});
	it('sorts the keys before joining', () => {
		expect(digestInput(['b', 'a'])).toBe('a\nb');
	});
	it('gives the same digest with node:crypto and WebCrypto', async () => {
		const keys = ['10', '9', '[3,"u1"]', 'é'];
		const bytes = new TextEncoder().encode(digestInput(keys));
		const web = await crypto.subtle.digest('SHA-256', bytes);
		const hex = [...new Uint8Array(web)].map((b) => b.toString(16).padStart(2, '0')).join('');
		expect(serverDigest(keys)).toBe(hex);
		expect(serverDigest([])).toBe(serverDigest(new Set()));
	});
});
