import { describe, expect, it } from 'vitest';
import { hashSecret, newSecret } from './secrets';

describe('secrets', () => {
	it('are prefixed and long', () => {
		const s = newSecret('sa_at_');
		expect(s.startsWith('sa_at_')).toBe(true);
		expect(s.length).toBeGreaterThanOrEqual(6 + 43);
	});
	it('are never the same twice', () => expect(newSecret('sa_rt_')).not.toBe(newSecret('sa_rt_')));
	it('hash to a stable 64-char hex', () => {
		expect(hashSecret('abc')).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});
});
