import { describe, expect, it } from 'vitest';
import { eightsSpan, isLengthCounts, isStartCount, nextCount } from './timing';

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
