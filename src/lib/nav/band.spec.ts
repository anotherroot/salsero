import { describe, expect, it } from 'vitest';
import { bandMode } from './band';

describe('bandMode', () => {
	it('is full or compact at the top', () => {
		expect(bandMode(0, false)).toBe('full');
		expect(bandMode(0, true)).toBe('compact');
	});
	it('goes slim once scroll passes the band height', () => {
		expect(bandMode(147, false)).toBe('full');
		expect(bandMode(148, false)).toBe('slim');
		expect(bandMode(111, true)).toBe('compact');
		expect(bandMode(112, true)).toBe('slim');
	});
});
