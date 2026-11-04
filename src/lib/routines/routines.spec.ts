import { describe, expect, it } from 'vitest';
import type { Graph } from '$lib/graph/graph';
import {
	breaks,
	flatten,
	loops,
	positionSeams,
	rowEdges,
	slotAt,
	routineEnds,
	routineStarts,
	slotEnds,
	sharedNextCount,
	slotStartCounts,
	slotStarts,
	slotTiming,
	timingBreaks,
	timingSeams,
	through,
	type RoutineShape,
	type Slot
} from './routines';

/**
 * Positions 1 open, 2 closed, 3 hammerlock. None of them is special.
 *
 * 10 no position on either side — fits anywhere, which is most of a repertoire
 * nobody has tagged.
 * 11 open → closed. 12 closed → open. 13 open|closed → hammerlock, 2 eights.
 * 14 hammerlock → open. 15 open → closed|hammerlock. 16 open → hammerlock|closed.
 */
const g: Graph = {
	positions: [],
	figures: [
		{ id: 10, starts: [], ends: [], start: 1, length: 8 },
		{ id: 11, starts: [1], ends: [2], start: 1, length: 8 },
		{ id: 12, starts: [2], ends: [1], start: 1, length: 8 },
		{ id: 13, starts: [1, 2], ends: [3], start: 1, length: 16 },
		{ id: 14, starts: [3], ends: [1], start: 1, length: 8 },
		{ id: 15, starts: [1], ends: [2, 3], start: 1, length: 8 },
		{ id: 16, starts: [1], ends: [3, 2], start: 1, length: 8 }
	]
};

const opts = (...figureIds: number[]): RoutineShape => ({
	slots: figureIds.map((id) => ({ kind: 'options', figureIds: [id] }))
});

describe('slotStarts', () => {
	it('is the union of its options, deduplicated', () => {
		expect(slotStarts(g, { kind: 'options', figureIds: [11, 13] })).toEqual([1, 2]);
	});

	it('is anywhere ([]) when any option has no start', () => {
		expect(slotStarts(g, { kind: 'options', figureIds: [11, 10] })).toEqual([]);
		expect(slotStarts(g, { kind: 'options', figureIds: [10, 11] })).toEqual([]);
	});

	it('ignores an option the graph does not know', () => {
		expect(slotStarts(g, { kind: 'options', figureIds: [11, 999] })).toEqual([1]);
	});
});

describe('slotEnds', () => {
	it('is the ends every option agrees on', () => {
		expect(slotEnds(g, { kind: 'options', figureIds: [12, 14] })).toEqual([1]);
	});

	it('compares the ends as a set, whatever their order', () => {
		expect(slotEnds(g, { kind: 'options', figureIds: [15, 16] })).toEqual([2, 3]);
		expect(slotEnds(g, { kind: 'options', figureIds: [16, 15] })).toEqual([2, 3]);
	});

	it('is null when one option has an end and another has none, whichever comes first', () => {
		// Both orders: a sentinel for "nothing seen yet" must not swallow the empty set.
		expect(slotEnds(g, { kind: 'options', figureIds: [12, 10] })).toBeNull();
		expect(slotEnds(g, { kind: 'options', figureIds: [10, 12] })).toBeNull();
	});

	it('is [] when no option has an end', () => {
		expect(slotEnds(g, { kind: 'options', figureIds: [10] })).toEqual([]);
	});

	it('is null when the options disagree', () => {
		expect(slotEnds(g, { kind: 'options', figureIds: [11, 12] })).toBeNull();
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

describe('routineStarts and routineEnds', () => {
	it('borrow the first and last slot', () => {
		const shape = opts(13, 14);
		expect(routineStarts(g, shape)).toEqual([1, 2]);
		expect(routineEnds(g, shape)).toEqual([1]);
	});

	it('see through an embedded routine at either end', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'child', routineId: 7, slots: [{ kind: 'options', figureIds: [11] }] },
				{ kind: 'child', routineId: 8, slots: [{ kind: 'options', figureIds: [12] }] }
			]
		};
		expect(routineStarts(g, shape)).toEqual([1]);
		expect(routineEnds(g, shape)).toEqual([1]);
	});

	it('are empty and null for a routine with nothing danceable', () => {
		expect(routineStarts(g, { slots: [] })).toEqual([]);
		expect(routineEnds(g, { slots: [] })).toBeNull();
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

	it('never breaks next to a figure with no position', () => {
		// 11 lands closed, 10 fits anywhere, 14 needs hammerlock — and 10 leaves the hands anywhere.
		expect(breaks(g, opts(11, 10, 14))).toEqual([]);
	});

	it('crosses from a figure with two ends into one starting in either', () => {
		expect(breaks(g, opts(15, 14))).toEqual([]);
		expect(breaks(g, opts(15, 12))).toEqual([]);
		expect(breaks(g, opts(15, 11))).toEqual([0]);
	});
});

describe('loops', () => {
	it('is true when the end is one of the starts', () => {
		expect(loops(g, opts(11, 12))).toBe(true);
	});

	it('is false when it is not', () => {
		expect(loops(g, opts(11, 13))).toBe(false);
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
 * Timing fixtures. No figure has a position, so only the count can break a
 * seam. It doubles as a repertoire nobody has tagged.
 *   20: 1 → 1 (8 counts)    21: 1 → 5 (4 counts)    22: 5 → 1 (4 counts)
 *   23: 5 → 5 (8 counts)    24: 1 → 1 (16 counts)
 */
const t: Graph = {
	positions: [],
	figures: [
		{ id: 20, starts: [], ends: [], start: 1, length: 8 },
		{ id: 21, starts: [], ends: [], start: 1, length: 4 },
		{ id: 22, starts: [], ends: [], start: 5, length: 4 },
		{ id: 23, starts: [], ends: [], start: 5, length: 8 },
		{ id: 24, starts: [], ends: [], start: 1, length: 16 }
	]
};

describe('a repertoire with no positions', () => {
	const shapes = [opts(20), opts(20, 24, 20), opts(21, 22), opts(21, 23, 22, 21), opts(20, 22)];

	it('has no break anywhere', () => {
		for (const s of shapes) expect(breaks(t, s)).toEqual([]);
	});

	it('has no position seam anywhere', () => {
		for (const s of shapes) expect(positionSeams(t, s)).toEqual([]);
	});

	it('loops whenever the counts loop', () => {
		expect(loops(t, opts(20))).toBe(true);
		expect(loops(t, opts(20, 24, 20))).toBe(true);
		expect(loops(t, opts(21, 22))).toBe(true);
		// Only the count can stop it: 21 starts on 1 and leaves the next on 5.
		expect(loops(t, opts(21))).toBe(false);
	});
});

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

describe('rowEdges', () => {
	it('is where an options row begins and lands', () => {
		expect(rowEdges(g, { kind: 'options', figureIds: [11] })).toEqual({
			starts: [1],
			startCounts: [1],
			ends: [2],
			next: 1
		});
	});

	it('is anywhere on both sides for a row with no position, yet danceable', () => {
		expect(rowEdges(g, { kind: 'options', figureIds: [10] })).toEqual({
			starts: [],
			startCounts: [1],
			ends: [],
			next: 1
		});
	});

	it("borrows a child routine's first starts and last end", () => {
		const child: Slot = {
			kind: 'child',
			routineId: 9,
			slots: [
				{ kind: 'options', figureIds: [11] },
				{ kind: 'options', figureIds: [13] }
			]
		};
		expect(rowEdges(g, child)).toMatchObject({ starts: [1], ends: [3] });
	});

	it('is empty for a row with nothing danceable', () => {
		expect(rowEdges(g, { kind: 'options', figureIds: [999] })).toEqual({
			starts: [],
			startCounts: [],
			ends: null,
			next: null
		});
	});
});

describe('positionSeams', () => {
	it('names the rows on both sides of a hold that does not connect', () => {
		// 11 lands in closed; 14 starts from hammerlock.
		expect(positionSeams(g, opts(11, 14))).toEqual([{ after: 0, next: 1 }]);
	});

	it('is silent where the hold connects', () => {
		expect(positionSeams(g, opts(11, 12, 11))).toEqual([]);
	});

	it('skips a slot with nothing danceable, pointing at the next real one', () => {
		expect(positionSeams(g, opts(11, 999, 12))).toEqual([]);
		expect(positionSeams(g, opts(11, 999, 14))).toEqual([{ after: 0, next: 2 }]);
	});

	it('reports a seam at an embedded routine by its own row', () => {
		const shape: RoutineShape = {
			slots: [
				{
					kind: 'child',
					routineId: 9,
					slots: [
						{ kind: 'options', figureIds: [11] },
						{ kind: 'options', figureIds: [12] }
					]
				},
				{ kind: 'options', figureIds: [14] }
			]
		};
		expect(positionSeams(g, shape)).toEqual([{ after: 0, next: 1 }]);
	});

	it('is silent out of a row whose end is unknown', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11, 12] },
				{ kind: 'options', figureIds: [14] }
			]
		};
		expect(positionSeams(g, shape)).toEqual([]);
	});

	it('is silent on both sides of a row with no position', () => {
		expect(positionSeams(g, opts(11, 10, 14))).toEqual([]);
	});

	it('names the rows when none of the ends is a start of the next', () => {
		// 15 ends closed or hammerlock; 11 starts only from open.
		expect(positionSeams(g, opts(15, 11))).toEqual([{ after: 0, next: 1 }]);
	});
});

describe('through', () => {
	it('finds the seam where the hands pass through a position', () => {
		// 13 ends in hammerlock (3); 14 starts there.
		expect(through(g, opts(11, 12, 13, 14), 3)).toEqual([[2, 3]]);
	});

	it('finds only seams where both sides name it', () => {
		// 12 → 13 passes through open (1); 14 ends in open but nothing follows it.
		expect(through(g, opts(11, 12, 13, 14), 1)).toEqual([[1, 2]]);
	});

	it('does not count a side with no position', () => {
		expect(through(g, opts(10, 10), 1)).toEqual([]);
		expect(through(g, opts(12, 10), 1)).toEqual([]);
	});

	it('skips a row with nothing danceable', () => {
		expect(through(g, opts(13, 999, 14), 3)).toEqual([[0, 2]]);
	});
});
