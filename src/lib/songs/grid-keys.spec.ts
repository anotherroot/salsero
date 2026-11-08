import { describe, expect, it } from 'vitest';
import { countsFor } from '$lib/beatgrid/beatgrid';
import { gridRows } from './sections';
import { FOLLOW_PAUSE_MS, followRow, gridKey, shouldFollow, tabBeat } from './grid-keys';

const beats = Array.from({ length: 30 }, (_, i) => i * 0.5);
// 1s at 0, 8, 16 and 18 (a short row of 2 from 16), then 26.
const rows = gridRows(beats, countsFor(30, [0, 18], 0), [], 0);

describe('gridKey', () => {
	it('moves a beat left and right, and stops at the ends', () => {
		expect(gridKey('ArrowRight', 3, rows)).toBe(4);
		expect(gridKey('ArrowLeft', 3, rows)).toBe(2);
		expect(gridKey('ArrowLeft', 0, rows)).toBeNull();
		expect(gridKey('ArrowRight', 29, rows)).toBeNull();
	});

	it('moves a row up and down in the same column, or the row’s last beat when short', () => {
		expect(gridKey('ArrowDown', 3, rows)).toBe(11);
		expect(gridKey('ArrowDown', 11, rows)).toBe(17);
		expect(gridKey('ArrowDown', 17, rows)).toBe(19);
		expect(gridKey('ArrowUp', 19, rows)).toBe(17);
		expect(gridKey('ArrowUp', 3, rows)).toBeNull();
	});

	it('goes to the row’s ends, and ignores other keys', () => {
		expect(gridKey('Home', 13, rows)).toBe(8);
		expect(gridKey('End', 13, rows)).toBe(15);
		expect(gridKey('a', 13, rows)).toBeNull();
	});
});

describe('shouldFollow', () => {
	it('holds off for a while after a hand scroll', () => {
		expect(shouldFollow(10_000, 0)).toBe(true);
		expect(shouldFollow(10_000, 10_000 - FOLLOW_PAUSE_MS + 1)).toBe(false);
		expect(shouldFollow(10_000, 10_000 - FOLLOW_PAUSE_MS)).toBe(true);
	});
});

describe('the grid’s one tab stop', () => {
	const loud = rows.slice(1);
	it('stays on the focused beat while it is drawn', () => {
		expect(tabBeat(12, rows, -1)).toBe(12);
	});
	it('moves to the playing beat, else the first drawn beat, when the focused one is hidden or gone', () => {
		expect(tabBeat(3, loud, 20)).toBe(20);
		expect(tabBeat(3, loud, -1)).toBe(8);
		expect(tabBeat(500, rows, -1)).toBe(0);
		expect(tabBeat(0, [], -1)).toBeNull();
	});
});

describe('when the grid scrolls to the song', () => {
	it('only while playing, and only when the playing row changes', () => {
		expect(followRow(2, 3, true)).toBe(true);
		expect(followRow(3, 3, true)).toBe(false);
		expect(followRow(2, 3, false)).toBe(false);
		expect(followRow(2, -1, true)).toBe(false);
	});
});
