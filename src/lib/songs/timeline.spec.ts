import { describe, expect, it } from 'vitest';
import { seekFraction, seekKey, tickPercents } from './timeline';

describe('tickPercents', () => {
	it('places times inside the song as percents and drops the rest', () => {
		expect(tickPercents([0, 30, 60, 400], 120)).toEqual([0, 25, 50]);
		expect(tickPercents([-1, 120], 120)).toEqual([100]);
	});

	it('has no ticks before the length is known', () => {
		expect(tickPercents([10], 0)).toEqual([]);
		expect(tickPercents([10], -5)).toEqual([]);
	});
});

describe('seekFraction', () => {
	it('is where the pointer sits along the track, clamped', () => {
		expect(seekFraction(150, 100, 200)).toBe(0.25);
		expect(seekFraction(50, 100, 200)).toBe(0);
		expect(seekFraction(400, 100, 200)).toBe(1);
	});

	it('is 0 for a track with no width', () => {
		expect(seekFraction(150, 100, 0)).toBe(0);
	});
});

describe('seekKey', () => {
	it('steps 5 s with the arrows, clamped', () => {
		expect(seekKey('ArrowRight', 10, 100)).toBe(15);
		expect(seekKey('ArrowUp', 98, 100)).toBe(100);
		expect(seekKey('ArrowLeft', 2, 100)).toBe(0);
		expect(seekKey('ArrowDown', 20, 100)).toBe(15);
	});

	it('steps 30 s by page, and jumps to the ends', () => {
		expect(seekKey('PageUp', 90, 100)).toBe(100);
		expect(seekKey('PageDown', 50, 100)).toBe(20);
		expect(seekKey('Home', 50, 100)).toBe(0);
		expect(seekKey('End', 50, 100)).toBe(100);
	});

	it('ignores any other key', () => {
		expect(seekKey('a', 50, 100)).toBeNull();
		expect(seekKey('Enter', 50, 100)).toBeNull();
	});
});
