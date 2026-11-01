import { describe, expect, it } from 'vitest';
import { actionBlocks, extractBlock, inOrder } from './selection';

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

describe('actionBlocks', () => {
	it('blocks everything for an empty selection, with extract’s own reason', () => {
		expect(actionBlocks(0, 'Select the slots to make into a routine.')).toEqual({
			above: 'Select one slot to add next to it.',
			below: 'Select one slot to add next to it.',
			duplicate: 'Select slots first.',
			delete: 'Select slots first.',
			extract: 'Select the slots to make into a routine.'
		});
	});
	it('allows everything for one slot', () => {
		expect(Object.values(actionBlocks(1, null)).every((v) => v === null)).toBe(true);
	});
	it('blocks only the add-next-to actions for several', () => {
		expect(actionBlocks(3, null)).toEqual({
			above: 'Select one slot to add next to it.',
			below: 'Select one slot to add next to it.',
			duplicate: null,
			delete: null,
			extract: null
		});
	});
});
