import { describe, expect, it } from 'vitest';
import type { Graph } from '$lib/graph/graph';
import {
	breaks,
	flatten,
	loops,
	positionSeams,
	rowEdges,
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
	rowEdgesIn,
	rowEndsIn,
	walk,
	stepIncoming,
	optionLength,
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
	it('keeps a slot’s end', () => {
		const slot = { kind: 'options' as const, figureIds: [15], end: 7 };
		expect(flatten(g, { slots: [slot] })[0].end).toBe(7);
	});

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
			endState: 'single',
			next: 1,
			start: 1
		});
	});

	it('is anywhere on both sides for a row with no position, yet danceable', () => {
		expect(rowEdges(g, { kind: 'options', figureIds: [10] })).toEqual({
			starts: [],
			startCounts: [1],
			ends: [],
			endState: 'none',
			next: 1,
			start: 1
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
			next: null,
			start: null
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

/**
 * Flexible figures (spec 2026-11-11). 30 starts on 1, 4 counts. 31 starts on 1
 * or 5, 4 counts. 32 has its length set in the routine (8 alone). 33 starts on
 * any count, 4 counts. 34 starts on 5, 4 counts.
 */
const fx: Graph = {
	positions: [],
	figures: [
		{ id: 30, starts: [], ends: [], start: 1, length: 4 },
		{ id: 31, starts: [], ends: [], start: 1, length: 4, startCounts: [1, 5] },
		{ id: 32, starts: [], ends: [], start: 1, length: 8, free: true },
		{ id: 33, starts: [], ends: [], start: 1, length: 4, startCounts: [1, 2, 3, 4, 5, 6, 7, 8] },
		{ id: 34, starts: [], ends: [], start: 5, length: 4 }
	]
};

const slot = (figureIds: number[], lengths?: Record<number, number>, stepId?: number): Slot => ({
	kind: 'options',
	figureIds,
	...(lengths ? { lengths } : {}),
	...(stepId !== undefined ? { stepId } : {})
});

describe('the walk', () => {
	it('starts a figure where the one before leaves off, when its set holds that count', () => {
		const flat = flatten(fx, opts(30, 31));
		expect(walk(fx, flat)[1]).toEqual({ incoming: 5, start: 5, next: 1 });
		expect(timingBreaks(fx, opts(30, 31))).toEqual([]);
	});

	it('falls back to the usual start and reports the break when it does not', () => {
		expect(walk(fx, flatten(fx, opts(30, 30)))[1]).toEqual({ incoming: 5, start: 1, next: 5 });
		expect(timingBreaks(fx, opts(30, 30))).toEqual([0]);
	});

	it('takes a free figure’s length from the slot', () => {
		const shape: RoutineShape = { slots: [slot([32], { 32: 4 }), slot([33])] };
		const w = walk(fx, flatten(fx, shape));
		expect(w[0].next).toBe(5);
		expect(w[1]).toEqual({ incoming: 5, start: 5, next: 1 });
	});

	it('runs every figure untouched exactly as before', () => {
		expect(rowEdgesIn(t, opts(21, 22, 23)).map((e) => [e.start, e.next])).toEqual([
			[1, 5],
			[5, 1],
			[5, 5]
		]);
		expect(timingSeams(t, opts(21, 22, 23))).toEqual([{ after: 1, next: 2 }]);
		expect(timingBreaks(t, opts(20, 22))).toEqual([0]);
		expect(loops(t, opts(21, 22))).toBe(true);
	});

	it('after a slot whose options disagree, starts on the usual start and reports nothing', () => {
		// 30 leaves the next on 5, 32 at 8 counts on 1: the slot's next is unknown.
		const shape: RoutineShape = { slots: [slot([30, 32], { 32: 8 }), slot([31])] };
		const w = walk(fx, flatten(fx, shape));
		expect(w[0].next).toBeNull();
		expect(w[1]).toEqual({ incoming: null, start: 1, next: 5 });
		expect(timingBreaks(fx, shape)).toEqual([]);
	});

	it('resolves an embedded routine from where the parent enters it', () => {
		const shape: RoutineShape = {
			slots: [
				slot([30]),
				{
					kind: 'child',
					routineId: 9,
					slots: [
						{ kind: 'options', figureIds: [33] },
						{ kind: 'options', figureIds: [31] }
					]
				}
			]
		};
		const rows = rowEdgesIn(fx, shape);
		expect(rows[1].start).toBe(5);
		// 33 from 5 leaves 1; 31 from 1 leaves 5.
		expect(rows[1].next).toBe(5);
	});

	it('loops only when the walked count comes back round', () => {
		expect(loops(fx, opts(30, 31))).toBe(true);
		expect(loops(fx, { slots: [slot([32], { 32: 4 })] })).toBe(false);
	});

	it('names the count a step is entered on', () => {
		const shape: RoutineShape = { slots: [slot([30], undefined, 7), slot([31], undefined, 8)] };
		expect(stepIncoming(fx, shape, 7)).toBeNull();
		expect(stepIncoming(fx, shape, 8)).toBe(5);
		expect(stepIncoming(fx, shape, 99)).toBeUndefined();
	});
});

describe('optionLength', () => {
	it('is the slot’s length for a free figure, else the figure’s own', () => {
		expect(optionLength(fx, { kind: 'options', figureIds: [32], lengths: { 32: 12 } }, 32)).toBe(
			12
		);
		expect(optionLength(fx, { kind: 'options', figureIds: [32] }, 32)).toBe(8);
		// A length kept from when the figure was free is not used once it is fixed.
		expect(optionLength(fx, { kind: 'options', figureIds: [30], lengths: { 30: 12 } }, 30)).toBe(4);
	});
});

describe('slotStartCounts with start sets', () => {
	it('unions every count of every option', () => {
		expect(slotStartCounts(fx, { kind: 'options', figureIds: [31] })).toEqual([1, 5]);
		expect(slotStartCounts(fx, { kind: 'options', figureIds: [33, 34] })).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8
		]);
	});
});

describe('a slot whose alternatives cannot all start on the incoming count (spec 2026-11-11)', () => {
	// 30 leaves the next on 5. 31 can start on 1 or 5; 36 only on 1, 8 counts, so
	// both still land on 1 — but 36 would be danced from the wrong count.
	const g2: Graph = {
		positions: [],
		figures: [...fx.figures, { id: 36, starts: [], ends: [], start: 1, length: 8 }]
	};
	const shape: RoutineShape = { slots: [slot([30]), slot([31, 36])] };

	it('shows a timing break there', () => {
		expect(walk(g2, flatten(g2, shape))[1].next).toBe(1);
		expect(timingBreaks(g2, shape)).toEqual([0]);
		expect(timingSeams(g2, shape)).toEqual([{ after: 0, next: 1 }]);
	});

	it('shows none when every alternative can', () => {
		const ok: RoutineShape = { slots: [slot([30]), slot([31, 34])] };
		expect(timingBreaks(g2, ok)).toEqual([]);
		expect(timingSeams(g2, ok)).toEqual([]);
	});
});

describe('a slot’s end along the routine (spec 2026-11-11, slot end)', () => {
	// 15 ends closed|hammerlock. 12 starts closed only. 13 starts open|closed.
	const o = (id: number, end?: number) => ({
		kind: 'options' as const,
		figureIds: [id],
		...(end !== undefined ? { end } : {})
	});

	it('narrows to the chosen end', () => {
		const rows = rowEdgesIn(g, { slots: [o(15, 2), o(13)] });
		expect(rows[0]).toMatchObject({ ends: [2], endState: 'chosen' });
	});

	it('is decided by the slot below, over a stored end', () => {
		expect(rowEdgesIn(g, { slots: [o(15), o(12)] })[0]).toMatchObject({
			ends: [2],
			endState: 'decided'
		});
		expect(rowEdgesIn(g, { slots: [o(15, 3), o(12)] })[0]).toMatchObject({
			ends: [2],
			endState: 'decided'
		});
	});

	it('makes a seam of a chosen end the slot below cannot take', () => {
		const shape = { slots: [o(15, 3), o(13)] };
		expect(positionSeams(g, shape)).toEqual([{ after: 0, next: 1 }]);
		expect(breaks(g, shape)).toEqual([0]);
		expect(positionSeams(g, { slots: [o(15), o(13)] })).toEqual([]);
	});

	it('reads as today with nothing chosen', () => {
		expect(rowEdgesIn(g, { slots: [o(15), o(13)] })[0]).toMatchObject({
			ends: [2, 3],
			endState: 'open'
		});
	});

	it('is decided by an embedded routine below', () => {
		const shape: RoutineShape = {
			slots: [o(15), { kind: 'child', routineId: 7, slots: [o(12)] }]
		};
		expect(rowEdgesIn(g, shape)[0]).toMatchObject({ ends: [2], endState: 'decided' });
		expect(rowEdgesIn(g, shape)[1].endState).toBeUndefined();
	});

	it('skips an archived-only slot to find the slot below', () => {
		const shape = { slots: [o(15), o(999), o(12)] };
		expect(rowEdgesIn(g, shape)[0]).toMatchObject({ ends: [2], endState: 'decided' });
	});

	it('is where the routine leaves the hands', () => {
		expect(routineEnds(g, { slots: [o(11), o(15, 2)] })).toEqual([2]);
	});
});

describe('rowEndsIn (spec 2026-11-11, slot end)', () => {
	it('gives each options row its end’s state and the sheet’s choices; an embedded row none', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [15], end: 2 },
				{ kind: 'options', figureIds: [13] },
				{ kind: 'child', routineId: 7, slots: [{ kind: 'options', figureIds: [14] }] }
			]
		};
		expect(rowEndsIn(g, shape)).toEqual([
			{
				state: 'chosen',
				choices: [
					{ id: 2, blockedBy: null, belowMisses: false },
					{ id: 3, blockedBy: null, belowMisses: true }
				]
			},
			{ state: 'single', choices: [{ id: 3, blockedBy: null, belowMisses: false }] },
			null
		]);
	});

	it('is null for a row with nothing danceable', () => {
		expect(rowEndsIn(g, { slots: [{ kind: 'options', figureIds: [999] }] })).toEqual([null]);
	});
});
