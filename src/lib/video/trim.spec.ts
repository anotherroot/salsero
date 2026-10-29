import { describe, expect, it } from 'vitest';
import { fitWindow, handleAt, msAtX, pctOf, trimWindow } from './trim';

describe('trimWindow', () => {
	it('is the section with three seconds either side', () => {
		expect(trimWindow({ startMs: 10_000, endMs: 17_000 }, 60)).toEqual({
			fromMs: 7000,
			toMs: 20_000
		});
	});
	it('stays inside the video', () => {
		expect(trimWindow({ startMs: 1000, endMs: 5000 }, 6)).toEqual({ fromMs: 0, toMs: 6000 });
	});
	it('is bounded only at 0 while the duration is unknown', () => {
		expect(trimWindow({ startMs: 1000, endMs: 5000 }, NaN)).toEqual({ fromMs: 0, toMs: 8000 });
	});
	it('centres on a point', () => {
		expect(trimWindow({ startMs: 10_000, endMs: null }, 60)).toEqual({
			fromMs: 7000,
			toMs: 13_000
		});
	});
});

describe('fitWindow', () => {
	const win = { fromMs: 7000, toMs: 20_000 };
	it('keeps the same window while both edges are well inside', () => {
		expect(fitWindow(win, { startMs: 10_000, endMs: 17_000 }, 60)).toBe(win);
	});
	it('widens the side an edge has come close to', () => {
		expect(fitWindow(win, { startMs: 10_000, endMs: 19_800 }, 60)).toEqual({
			fromMs: 7000,
			toMs: 22_800
		});
		expect(fitWindow(win, { startMs: 7200, endMs: 17_000 }, 60)).toEqual({
			fromMs: 4200,
			toMs: 20_000
		});
	});
});

describe('msAtX', () => {
	const win = { fromMs: 7000, toMs: 20_000 };
	it('maps a position across the strip to a time, clamped', () => {
		expect(msAtX(0, 300, win)).toBe(7000);
		expect(msAtX(150, 300, win)).toBe(13_500);
		expect(msAtX(-20, 300, win)).toBe(7000);
		expect(msAtX(400, 300, win)).toBe(20_000);
	});
});

describe('pctOf', () => {
	const win = { fromMs: 7000, toMs: 20_000 };
	it('maps a time to a percentage of the strip, clamped', () => {
		expect(pctOf(13_500, win)).toBe(50);
		expect(pctOf(0, win)).toBe(0);
		expect(pctOf(99_999, win)).toBe(100);
	});
});

describe('handleAt', () => {
	const win = { fromMs: 7000, toMs: 20_000 };
	const spot = { startMs: 10_000, endMs: 17_000 };
	it('picks the handle within reach', () => {
		expect(handleAt(75, 300, win, spot)).toBe('start');
		expect(handleAt(225, 300, win, spot)).toBe('end');
	});
	it('is null away from both handles', () => {
		expect(handleAt(150, 300, win, spot)).toBeNull();
	});
	it('only ever answers start for a point', () => {
		expect(handleAt(60, 300, win, { startMs: 10_000, endMs: null })).toBe('start');
	});
});
