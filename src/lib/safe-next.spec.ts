import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
	it.each([
		['/\\evil.example'],
		['/\tevil.example'],
		['/%5Cevil.example'],
		['/%09/evil.example'],
		['/\t/evil.example'],
		['//evil.example'],
		['https://evil.example'],
		['evil.example'],
		[''],
		[null]
	])('refuses %j', (raw) => {
		expect(safeNext(raw)).toBe('/');
	});

	it('keeps a normal path, query and hash', () => {
		expect(safeNext('/salsa/figures?x=1#h')).toBe('/salsa/figures?x=1#h');
	});
});
