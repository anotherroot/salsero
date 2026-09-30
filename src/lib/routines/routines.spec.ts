import { describe, expect, it } from 'vitest';
import type { Graph } from '$lib/graph/graph';
import {
	breaks,
	flatten,
	loops,
	slotAt,
	routineEnd,
	routineStarts,
	sharedEnd,
	sharedNextCount,
	slotStartCounts,
	slotStarts,
	slotTiming,
	timingBreaks,
	timingSeams,
	type RoutineShape,
	type Slot
} from './routines';

/**
 * Positions 1 open (neutral), 2 closed, 3 hammerlock.
 *
 * 10 untagged — both sides neutral, which is most of the repertoire.
 * 11 open → closed. 12 closed → open. 13 open|closed → hammerlock, 2 eights.
 * 14 hammerlock → open.
 */
const g: Graph = {
	neutral: 1,
	figures: [
		{ id: 10, starts: [], end: null, start: 1, length: 8 },
		{ id: 11, starts: [1], end: 2, start: 1, length: 8 },
		{ id: 12, starts: [2], end: 1, start: 1, length: 8 },
		{ id: 13, starts: [1, 2], end: 3, start: 1, length: 16 },
		{ id: 14, starts: [3], end: 1, start: 1, length: 8 }
	]
};

const opts = (...figureIds: number[]): RoutineShape => ({
	slots: figureIds.map((id) => ({ kind: 'options', figureIds: [id] }))
});

describe('slotStarts', () => {
	it('is the union of its options, deduplicated', () => {
		expect(slotStarts(g, { kind: 'options', figureIds: [11, 13] })).toEqual([1, 2]);
	});

	it('resolves an untagged option to the neutral position', () => {
		expect(slotStarts(g, { kind: 'options', figureIds: [10] })).toEqual([1]);
	});

	it('ignores an option the graph does not know', () => {
		expect(slotStarts(g, { kind: 'options', figureIds: [11, 999] })).toEqual([1]);
	});
});

describe('sharedEnd', () => {
	it('is the end every option agrees on', () => {
		expect(sharedEnd(g, { kind: 'options', figureIds: [12, 14] })).toBe(1);
	});

	it('counts an untagged option as ending at neutral, whichever order it comes in', () => {
		// Both orders on purpose. With the untagged figure FIRST, `sharedEnd`'s
		// `end === null` sentinel would absorb a raw unresolved `f.end` and the
		// assertion would pass with the bug present; with it second, the same bug
		// returns null. Only the pair has teeth.
		expect(sharedEnd(g, { kind: 'options', figureIds: [10, 14] })).toBe(1);
		expect(sharedEnd(g, { kind: 'options', figureIds: [14, 10] })).toBe(1);
	});

	it('is null when the options disagree', () => {
		expect(sharedEnd(g, { kind: 'options', figureIds: [11, 12] })).toBeNull();
	});
});

describe('flatten', () => {
	it('splices an embedded routine in place', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11] },
				{ kind: 'child', routineId: 7, slots: [{ kind: 'options', figureIds: [12] }] },
				{ kind: 'options', figureIds: [13] }
			]
		};
		expect(flatten(g, shape).map((s) => s.figureIds)).toEqual([[11], [12], [13]]);
	});

	it('drops options the graph does not know, and slots left empty', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11, 999] },
				{ kind: 'options', figureIds: [998] }
			]
		};
		expect(flatten(g, shape).map((s) => s.figureIds)).toEqual([[11]]);
	});

	it('contributes nothing for an embedded routine with no slots of its own', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11] },
				{ kind: 'child', routineId: 7, slots: [] }
			]
		};
		expect(flatten(g, shape).map((s) => s.figureIds)).toEqual([[11]]);
	});
});

describe('routineStarts and routineEnd', () => {
	it('borrow the first and last slot', () => {
		const shape = opts(13, 14);
		expect(routineStarts(g, shape)).toEqual([1, 2]);
		expect(routineEnd(g, shape)).toBe(1);
	});

	it('see through an embedded routine at either end', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'child', routineId: 7, slots: [{ kind: 'options', figureIds: [11] }] },
				{ kind: 'child', routineId: 8, slots: [{ kind: 'options', figureIds: [12] }] }
			]
		};
		expect(routineStarts(g, shape)).toEqual([1]);
		expect(routineEnd(g, shape)).toBe(1);
	});

	it('are empty and null for a routine with nothing danceable', () => {
		expect(routineStarts(g, { slots: [] })).toEqual([]);
		expect(routineEnd(g, { slots: [] })).toBeNull();
	});
});

describe('breaks', () => {
	it('reports the seam the hands cannot cross, and does not refuse it', () => {
		// 11 ends closed; 14 starts only from hammerlock.
		expect(breaks(g, opts(11, 14))).toEqual([0]);
	});

	it('is empty when every seam joins', () => {
		expect(breaks(g, opts(11, 12, 13, 14))).toEqual([]);
	});

	it('sees a break inside an embedded routine and at its seam', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11] },
				{
					kind: 'child',
					routineId: 7,
					slots: [
						{ kind: 'options', figureIds: [14] },
						{ kind: 'options', figureIds: [14] }
					]
				}
			]
		};
		// flat: 11 (→closed), 14 (needs hammerlock), 14 (needs hammerlock, gets open)
		expect(breaks(g, shape)).toEqual([0, 1]);
	});

	it('cannot report a break out of a slot whose end is unknown', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11, 12] },
				{ kind: 'options', figureIds: [14] }
			]
		};
		expect(breaks(g, shape)).toEqual([]);
	});

	it('is empty for a routine with nothing danceable', () => {
		expect(breaks(g, { slots: [] })).toEqual([]);
	});
});

describe('loops', () => {
	it('is true when the end is one of the starts', () => {
		expect(loops(g, opts(11, 12))).toBe(true);
	});

	it('is false when it is not', () => {
		expect(loops(g, opts(11, 13))).toBe(false);
	});

	it('is true for one untagged figure, which really does run into itself', () => {
		expect(loops(g, opts(10))).toBe(true);
	});

	it('is false for a routine with nothing danceable', () => {
		expect(loops(g, { slots: [] })).toBe(false);
	});
});

describe('flatten carries the note', () => {
	it("keeps each slot's own note", () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11], note: 'hand change' },
				{ kind: 'options', figureIds: [12] }
			]
		};
		expect(flatten(g, shape).map((s) => s.note ?? null)).toEqual(['hand change', null]);
	});

	it("falls back to the embedding slot's note for a child's unnoted slots", () => {
		const shape: RoutineShape = {
			slots: [
				{
					kind: 'child',
					routineId: 7,
					note: 'the whole combo slows here',
					slots: [
						{ kind: 'options', figureIds: [11], note: 'its own note wins' },
						{ kind: 'options', figureIds: [12] }
					]
				}
			]
		};
		expect(flatten(g, shape).map((s) => s.note ?? null)).toEqual([
			'its own note wins',
			'the whole combo slows here'
		]);
	});
});

describe('slotAt', () => {
	it('is the first slot before anything has been called', () => {
		// The list must not read as dead for the first few seconds of a run: the
		// first slot is what is coming, which is what the dancer needs to see.
		expect(slotAt(null, 5)).toBe(0);
	});

	it('wraps as the routine loops', () => {
		expect(slotAt(0, 3)).toBe(0);
		expect(slotAt(2, 3)).toBe(2);
		expect(slotAt(3, 3)).toBe(0);
		expect(slotAt(7, 3)).toBe(1);
	});

	it('is null when there is nothing to dance', () => {
		expect(slotAt(null, 0)).toBeNull();
		expect(slotAt(4, 0)).toBeNull();
	});

	it('survives a negative index rather than highlighting nothing', () => {
		// `findIndex` answers -1 when it misses, and -1 % 5 is -1 in JS, which
		// indexes past the start of the list and silently highlights no row.
		expect(slotAt(-1, 5)).toBe(4);
	});
});

/**
 * Timing fixtures. Every figure is untagged (all positions neutral) so only the
 * count can break a seam.
 *   20: 1 → 1 (8 counts)    21: 1 → 5 (4 counts)    22: 5 → 1 (4 counts)
 *   23: 5 → 5 (8 counts)    24: 1 → 1 (16 counts)
 */
const t: Graph = {
	neutral: 1,
	figures: [
		{ id: 20, starts: [], end: null, start: 1, length: 8 },
		{ id: 21, starts: [], end: null, start: 1, length: 4 },
		{ id: 22, starts: [], end: null, start: 5, length: 4 },
		{ id: 23, starts: [], end: null, start: 5, length: 8 },
		{ id: 24, starts: [], end: null, start: 1, length: 16 }
	]
};

describe('slotStartCounts', () => {
	it('is the union of its options’ start counts, ascending', () => {
		expect(slotStartCounts(t, { kind: 'options', figureIds: [23, 20] })).toEqual([1, 5]);
	});

	it('ignores an option the graph does not know', () => {
		expect(slotStartCounts(t, { kind: 'options', figureIds: [22, 999] })).toEqual([5]);
	});
});

describe('sharedNextCount', () => {
	it('is the count every option leaves the next on', () => {
		expect(sharedNextCount(t, { kind: 'options', figureIds: [20, 24] })).toBe(1);
	});

	it('is null when the options disagree — a hand-edited slot, never a guess', () => {
		expect(sharedNextCount(t, { kind: 'options', figureIds: [20, 21] })).toBeNull();
		expect(sharedNextCount(t, { kind: 'options', figureIds: [21, 20] })).toBeNull();
	});
});

describe('timingBreaks', () => {
	it('is empty when each figure leaves the next on its start count', () => {
		expect(timingBreaks(t, opts(21, 22, 20))).toEqual([]);
	});

	it('reports the seam where the count does not line up, and does not refuse it', () => {
		// 20 leaves the next on 1; 22 starts on 5.
		expect(timingBreaks(t, opts(20, 22))).toEqual([0]);
	});

	it('finds nothing in a repertoire of whole 8-counts from 1 — every existing routine', () => {
		expect(timingBreaks(t, opts(20, 24, 20, 24))).toEqual([]);
	});

	it('reports no timing break out of a slot whose next count is unknown', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [20, 21] },
				{ kind: 'options', figureIds: [22] }
			]
		};
		expect(timingBreaks(t, shape)).toEqual([]);
	});

	it('sees a timing break at an embedded routine’s seam', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [20] },
				{ kind: 'child', routineId: 9, slots: [{ kind: 'options', figureIds: [22] }] }
			]
		};
		expect(timingBreaks(t, shape)).toEqual([0]);
	});
});

describe('slotTiming', () => {
	it('gives an option slot its start counts and next count', () => {
		expect(slotTiming(t, { kind: 'options', figureIds: [22] })).toEqual({ starts: [5], next: 1 });
	});

	it('lets an embedded routine borrow its first slot’s starts and its last slot’s next', () => {
		const child: Slot = {
			kind: 'child',
			routineId: 9,
			slots: [
				{ kind: 'options', figureIds: [21] },
				{ kind: 'options', figureIds: [23] }
			]
		};
		expect(slotTiming(t, child)).toEqual({ starts: [1], next: 5 });
	});

	it('is empty for an embedded routine with nothing danceable, rather than throwing', () => {
		expect(slotTiming(t, { kind: 'child', routineId: 9, slots: [] })).toEqual({
			starts: [],
			next: null
		});
	});
});

describe('loops, with timing', () => {
	it('is true when the count comes back round to the start', () => {
		expect(loops(t, opts(21, 22))).toBe(true);
	});

	it('is false when the positions loop but the count does not', () => {
		// Starts on 1, leaves the next on 5.
		expect(loops(t, opts(21))).toBe(false);
	});
});

describe('timingSeams', () => {
	it('names the editor rows on both sides of a timing break', () => {
		// 21 leaves the next on 5; 22 starts on 5; 20 starts on 1.
		expect(timingSeams(t, opts(21, 22, 23))).toEqual([{ after: 1, next: 2 }]);
	});

	it('skips a slot with nothing danceable, pointing at the next real one', () => {
		// Slot 1 holds only a figure the graph does not know — an archived one.
		expect(timingSeams(t, opts(21, 999, 20))).toEqual([{ after: 0, next: 2 }]);
	});

	it('reports a seam at an embedded routine by its own row, not a flat index', () => {
		const shape: RoutineShape = {
			slots: [
				{
					kind: 'child',
					routineId: 9,
					slots: [
						{ kind: 'options', figureIds: [21] },
						{ kind: 'options', figureIds: [22] }
					]
				},
				{ kind: 'options', figureIds: [23] }
			]
		};
		// The child is one row: it starts on 1 and leaves the next on 1; 23 starts on 5.
		expect(timingSeams(t, shape)).toEqual([{ after: 0, next: 1 }]);
	});

	it('is silent out of a row whose next count is unknown', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [20, 21] },
				{ kind: 'options', figureIds: [22] }
			]
		};
		expect(timingSeams(t, shape)).toEqual([]);
	});
});
