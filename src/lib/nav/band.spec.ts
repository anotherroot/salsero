import { describe, expect, it } from 'vitest';
import { bandMode } from './band';

describe('bandMode', () => {
	it('is full or compact at the top', () => {
		expect(bandMode(0, false, false)).toBe('full');
		expect(bandMode(0, true, false)).toBe('compact');
	});
	it('goes slim once scroll passes the band height', () => {
		expect(bandMode(147, false, false)).toBe('full');
		expect(bandMode(148, false, false)).toBe('slim');
		expect(bandMode(111, true, false)).toBe('compact');
		expect(bandMode(112, true, false)).toBe('slim');
		expect(bandMode(400, false, false)).toBe('slim');
	});
	it('never goes slim on the desktop: the band row stays', () => {
		expect(bandMode(400, false, true)).toBe('full');
		expect(bandMode(400, true, true)).toBe('compact');
	});
});
