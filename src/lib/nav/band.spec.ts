import { describe, expect, it } from 'vitest';
import { BAND_FADE, bandMode, slimFade } from './band';

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

describe('slimFade', () => {
	it('follows the scroll over the last stretch before the pin', () => {
		expect(slimFade(0, false, 90)).toBe(0);
		expect(slimFade(90 - BAND_FADE, false, 90)).toBe(0);
		expect(slimFade(90 - BAND_FADE / 2, false, 90)).toBe(0.5);
		expect(slimFade(90, false, 90)).toBe(1);
		expect(slimFade(500, false, 90)).toBe(1);
	});
	it('a band that pins within the fade starts it at the top, not before', () => {
		expect(slimFade(0, false, 20)).toBe(0);
		expect(slimFade(10, false, 20)).toBe(0.5);
		expect(slimFade(20, false, 20)).toBe(1);
		expect(slimFade(0, false, 0)).toBe(1);
	});
	it('before it is measured: the band height', () => {
		expect(slimFade(148, false)).toBe(1);
		expect(slimFade(112 - BAND_FADE, true)).toBe(0);
	});
});
