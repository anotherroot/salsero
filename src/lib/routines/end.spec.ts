import { describe, expect, it } from 'vitest';
import type { Graph } from '$lib/graph/graph';
import type { OptionsSlot } from './routines';
import { endChoices, endFits, sharedEnds, slotEnd } from './end';

/*
 * Positions: A=1, B=2, X=3.
 * 20 M ends A|B. 21 N ends A|B. 22 K ends A|X. 23 Z no ends. 24 O ends A only.
 * 25 P ends B only.
 */
const g: Graph = {
	positions: [],
	figures: [
		{ id: 20, starts: [], ends: [1, 2], start: 1, length: 8 },
		{ id: 21, starts: [], ends: [2, 1], start: 1, length: 8 },
		{ id: 22, starts: [], ends: [1, 3], start: 1, length: 8 },
		{ id: 23, starts: [], ends: [], start: 1, length: 8 },
		{ id: 24, starts: [], ends: [1], start: 1, length: 8 },
		{ id: 25, starts: [], ends: [2], start: 1, length: 8 }
	]
};

const slot = (figureIds: number[], end?: number): OptionsSlot => ({
	kind: 'options',
	figureIds,
	...(end !== undefined ? { end } : {})
});

describe('sharedEnds', () => {
	it('is what every option can end in', () => {
		expect(sharedEnds(g, slot([20, 21]))).toEqual([1, 2]);
		expect(sharedEnds(g, slot([20, 22]))).toEqual([1]);
	});

	it('is [] when no option has an end, and ignores an option with none', () => {
		expect(sharedEnds(g, slot([23]))).toEqual([]);
		expect(sharedEnds(g, slot([20, 23]))).toEqual([1, 2]);
	});

	it('is unknown (null) when options have ends but share none', () => {
		expect(sharedEnds(g, slot([22, 25]))).toBeNull();
	});
});

describe('slotEnd', () => {
	it('has nothing to choose without positions, or with one shared end', () => {
		expect(slotEnd(g, slot([23]), null)).toEqual({ ends: [], state: 'none', stored: null });
		expect(slotEnd(g, slot([24]), null)).toEqual({ ends: [1], state: 'single', stored: null });
	});

	it('is decided by a slot below that starts in one of its ends only', () => {
		expect(slotEnd(g, slot([20]), [1])).toEqual({ ends: [1], state: 'decided', stored: null });
	});

	it('lets the slot below override a stored end, keeping what was stored', () => {
		expect(slotEnd(g, slot([20], 2), [1])).toEqual({ ends: [1], state: 'decided', stored: 2 });
	});

	it('reads a stored end when the slot below does not decide', () => {
		expect(slotEnd(g, slot([20], 2), [1, 2])).toEqual({ ends: [2], state: 'chosen', stored: 2 });
		expect(slotEnd(g, slot([20], 2), null)).toEqual({ ends: [2], state: 'chosen', stored: 2 });
	});

	it('ignores a stored end the slot can no longer take', () => {
		expect(slotEnd(g, slot([20], 3), null)).toEqual({ ends: [1, 2], state: 'open', stored: null });
	});

	it('is open with no choice and nothing deciding', () => {
		expect(slotEnd(g, slot([20]), null).state).toBe('open');
		expect(slotEnd(g, slot([20]), []).state).toBe('open');
		expect(slotEnd(g, slot([20]), [3]).state).toBe('open');
	});

	it('is open and unknown when the options share no end', () => {
		expect(slotEnd(g, slot([22, 25]), null)).toEqual({ ends: null, state: 'open', stored: null });
	});

	it('reads the stored end through the graph’s canon (a twin)', () => {
		const twinned: Graph = { ...g, canon: new Map([[9, 2]]) };
		expect(slotEnd(twinned, slot([20], 9), null)).toEqual({
			ends: [2],
			state: 'chosen',
			stored: 2
		});
	});
});

describe('endFits', () => {
	it('takes an alternative that can end where the slot ends', () => {
		expect(endFits([1, 3], [1], [1, 2])).toBe(true);
		expect(endFits([], [1], [1, 2])).toBe(true);
	});

	it('refuses one that cannot', () => {
		expect(endFits([3], [1], [1, 2])).toBe(false);
	});

	it('needs the same ends while nothing is fixed', () => {
		expect(endFits([1, 3], [1, 2], [1, 2])).toBe(false);
		expect(endFits([2, 1], [1, 2], [1, 2])).toBe(true);
		expect(endFits([2, 1], null, [1, 2])).toBe(true);
	});
});

describe('endChoices', () => {
	it('lists the main figure’s ends, each with why it cannot be or what it costs', () => {
		expect(endChoices(g, slot([20, 22]), [2])).toEqual([
			{ id: 1, blockedBy: null, belowMisses: true },
			{ id: 2, blockedBy: 22, belowMisses: false }
		]);
	});

	it('marks nothing below when there is no slot below or it enters anywhere', () => {
		expect(endChoices(g, slot([20]), null).every((c) => !c.belowMisses)).toBe(true);
		expect(endChoices(g, slot([20]), []).every((c) => !c.belowMisses)).toBe(true);
	});
});
