import { describe, expect, it } from 'vitest';
import { bandMode, bandProgress, lerp } from './band';

describe('bandMode', () => {
	it('is full or compact at the top', () => {
		expect(bandMode(0, false, false)).toBe('full');
		expect(bandMode(0, true, false)).toBe('compact');
	});
	it('before it is measured: slim once scroll passes the band height', () => {
		expect(bandMode(147, false, false)).toBe('full');
		expect(bandMode(148, false, false)).toBe('slim');
		expect(bandMode(111, true, false)).toBe('compact');
		expect(bandMode(112, true, false)).toBe('slim');
		expect(bandMode(400, false, false)).toBe('slim');
	});
	it('measured: slim from where the sheet meets the slim band', () => {
		expect(bandMode(89, false, false, 90)).toBe('full');
		expect(bandMode(90, false, false, 90)).toBe('slim');
	});
	it('never goes slim on the desktop: the band row stays', () => {
		expect(bandMode(400, false, true)).toBe('full');
		expect(bandMode(400, true, true, 10)).toBe('compact');
	});
});

describe('bandProgress', () => {
	it('folds over the whole way to the pin', () => {
		expect(bandProgress(0, false, 100)).toBe(0);
		expect(bandProgress(25, false, 100)).toBe(0.25);
		expect(bandProgress(100, false, 100)).toBe(1);
		expect(bandProgress(400, false, 100)).toBe(1);
		expect(bandProgress(-20, false, 100)).toBe(0);
	});
	it('a band that pins at the top is folded already; unmeasured, the band height', () => {
		expect(bandProgress(0, false, 0)).toBe(1);
		expect(bandProgress(74, false)).toBe(0.5);
	});
	it('lerps', () => {
		expect(lerp(10, 20, 0.5)).toBe(15);
		expect(lerp(10, 20, 0)).toBe(10);
	});
});
