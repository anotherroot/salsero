import { describe, expect, it } from 'vitest';
import {
	countsOfMask,
	eightsSpan,
	isLengthCounts,
	isStartCount,
	LENGTH_CHOICES,
	maskOf,
	nextCount,
	startOn
} from './timing';

describe('nextCount', () => {
	it.each([
		[1, 8, 1],
		[5, 4, 1],
		[1, 4, 5],
		[1, 16, 1],
		[3, 6, 1],
		[8, 1, 1],
		[7, 3, 2]
	])('a figure from %i taking %i counts leaves the next on %i', (start, length, next) => {
		expect(nextCount(start, length)).toBe(next);
	});
});

describe('eightsSpan', () => {
	it('rounds up to whole 8-counts, never below one', () => {
		expect(eightsSpan(8)).toBe(1);
		expect(eightsSpan(4)).toBe(1);
		expect(eightsSpan(12)).toBe(2);
		expect(eightsSpan(16)).toBe(2);
		expect(eightsSpan(1)).toBe(1);
	});
});

describe('limits', () => {
	it('accepts start counts 1..8 only, as integers', () => {
		expect([1, 5, 8].every(isStartCount)).toBe(true);
		expect([0, 9, 1.5, NaN, '1', null].some(isStartCount)).toBe(false);
	});

	it('accepts lengths 1..64 only, as integers', () => {
		expect([1, 8, 64].every(isLengthCounts)).toBe(true);
		expect([0, 65, 4.5, NaN, '8', null].some(isLengthCounts)).toBe(false);
	});
});

describe('start sets', () => {
	it('a null or empty mask reads as the one start count', () => {
		expect(countsOfMask(null, 5)).toEqual([5]);
		expect(countsOfMask(0, 3)).toEqual([3]);
		expect(countsOfMask(null, null)).toEqual([1]);
	});

	it('a mask round-trips, sorted', () => {
		expect(countsOfMask(maskOf([5, 1]), 1)).toEqual([1, 5]);
		expect(maskOf([1, 2, 3, 4, 5, 6, 7, 8])).toBe(255);
		expect(maskOf([1])).toBe(1);
	});

	it('starts on the incoming count when the set holds it, else the usual start', () => {
		expect(startOn([1, 5], 1, 5)).toBe(5);
		expect(startOn([1, 5], 1, 3)).toBe(1);
		expect(startOn([1], 1, null)).toBe(1);
	});

	it('offers the How long? lengths', () => {
		expect([...LENGTH_CHOICES]).toEqual([2, 4, 6, 8, 12, 16, 24]);
	});
});
