import { describe, expect, it } from 'vitest';
import { extractBlock, inOrder } from './selection';

const rows = [
	{ id: 10, isRoutine: false },
	{ id: 11, isRoutine: false },
	{ id: 12, isRoutine: true },
	{ id: 13, isRoutine: false }
];

describe('inOrder', () => {
	it('puts a selection in routine order, whatever order it was tapped in', () => {
		expect(inOrder(rows, [13, 10, 11])).toEqual([10, 11, 13]);
	});
});

describe('extractBlock', () => {
	it('allows a contiguous run of figure slots', () => {
		expect(extractBlock(rows, [11, 10], [])).toBeNull();
	});

	it('names the reason it cannot', () => {
		expect(extractBlock(rows, [10, 13], [])).toBe('Select slots next to each other.');
		expect(extractBlock(rows, [11, 12], [])).toBe('Slot 3 is a routine — embedding is one level.');
		expect(extractBlock(rows, [10], ['Social mix'])).toBe(
			'This routine is embedded in Social mix — embedding is one level.'
		);
	});
});
