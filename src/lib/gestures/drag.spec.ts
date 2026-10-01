import { describe, expect, it } from 'vitest';
import { autoScroll, dropIndex, moved, shiftFor } from './drag';

const centers = [50, 150, 250, 350]; // four 100 px cards

describe('dropIndex', () => {
	it('stays put until the card passes a neighbour’s middle', () => {
		expect(dropIndex(centers, 140, 0)).toBe(0);
		expect(dropIndex(centers, 160, 0)).toBe(1);
	});

	it('reaches both ends', () => {
		expect(dropIndex(centers, 999, 1)).toBe(3);
		expect(dropIndex(centers, -50, 2)).toBe(0);
	});
});

describe('shiftFor', () => {
	it('slides the cards between from and to out of the way', () => {
		expect([0, 1, 2, 3].map((i) => shiftFor(i, 0, 2, 108))).toEqual([0, -108, -108, 0]);
		expect([0, 1, 2, 3].map((i) => shiftFor(i, 3, 1, 108))).toEqual([0, 108, 108, 0]);
	});
});

describe('autoScroll', () => {
	it('is still in the middle and speeds up toward each edge', () => {
		expect(autoScroll(400, 0, 800)).toBe(0);
		expect(autoScroll(36, 0, 800)).toBeLessThan(0);
		expect(autoScroll(0, 0, 800)).toBe(-16);
		expect(autoScroll(800, 0, 800)).toBe(16);
	});
});

describe('moved', () => {
	it('moves one item and leaves the input alone', () => {
		const list = ['a', 'b', 'c'];
		expect(moved(list, 0, 2)).toEqual(['b', 'c', 'a']);
		expect(list).toEqual(['a', 'b', 'c']);
	});
});
