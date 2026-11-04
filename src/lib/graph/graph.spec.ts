import { describe, expect, it } from 'vitest';
import {
	deadEnds,
	figuresFrom,
	figuresTo,
	fitsAfter,
	follows,
	meet,
	nextCountOf,
	noPosition,
	orphans,
	positionCounts,
	precedes,
	sameSet,
	taggedCount,
	type Graph
} from './graph';

/** The ids are arbitrary and deliberately not 1-2-3. None of them is special. */
const OPEN = 10;
const CROSS = 11;
const HAMMER = 12;
const SHADOW = 13;

const g = (figures: Graph['figures']): Graph => ({ figures, positions: [] });

const fig = (
	id: number,
	starts: number[] = [],
	ends: number[] = [],
	length = 8
): Graph['figures'][number] => ({ id, starts, ends, start: 1, length });

describe('meet', () => {
	it('is true when the first side has no position', () => {
		expect(meet([], [3])).toBe(true);
	});

	it('is true when the second side has no position', () => {
		expect(meet([3], [])).toBe(true);
	});

	it('is true when the two share a position', () => {
		expect(meet([1, 2], [2])).toBe(true);
	});

	it('is false when both have positions and share none', () => {
		expect(meet([1], [2])).toBe(false);
	});
});

describe('sameSet', () => {
	it('ignores order', () => {
		expect(sameSet([1, 2], [2, 1])).toBe(true);
	});

	it('takes two empty sides as the same', () => {
		expect(sameSet([], [])).toBe(true);
	});

	it('tells a subset from the whole', () => {
		expect(sameSet([1], [1, 2])).toBe(false);
		expect(sameSet([], [1])).toBe(false);
	});
});

describe('fitsAfter', () => {
	it('is meet(a.ends, b.starts)', () => {
		expect(fitsAfter(fig(1, [], [OPEN]), fig(2, [OPEN]))).toBe(true);
		expect(fitsAfter(fig(1, [], [OPEN]), fig(2, [CROSS]))).toBe(false);
		expect(fitsAfter(fig(1, [], []), fig(2, [CROSS]))).toBe(true);
	});
});

describe('a repertoire with no positions', () => {
	it('lets every figure follow every figure', () => {
		const graph = g([fig(1), fig(2), fig(3)]);
		expect(follows(graph, 1)).toEqual([1, 2, 3]);
		expect(precedes(graph, 2)).toEqual([1, 2, 3]);
	});
});

describe('a figure ending in two positions', () => {
	const graph = g([
		fig(1, [OPEN], [CROSS, HAMMER]),
		fig(2, [HAMMER]), // starts in one of its ends
		fig(3, [SHADOW]), // starts in neither
		fig(4) // no starts: follows anything
	]);

	it('is followed by a figure starting in one of its ends', () => {
		expect(follows(graph, 1)).toContain(2);
	});

	it('is not followed by a figure starting in neither', () => {
		expect(follows(graph, 1)).not.toContain(3);
	});

	it('is followed by a figure with no starts', () => {
		expect(follows(graph, 1)).toContain(4);
	});
});

describe('figuresFrom / figuresTo', () => {
	const graph = g([
		fig(1, [OPEN], [CROSS]), // open  → cross
		fig(2, [CROSS], [HAMMER]), // cross → hammerlock
		fig(3, [HAMMER, CROSS], [OPEN]), // either → open
		fig(4) // no position: tagged nowhere, so listed nowhere
	]);

	it('lists what is tagged to start from a position', () => {
		expect(figuresFrom(graph, OPEN)).toEqual([1]);
		expect(figuresFrom(graph, CROSS)).toEqual([2, 3]);
	});

	it('lists what is tagged to end at a position', () => {
		expect(figuresTo(graph, OPEN)).toEqual([3]);
		expect(figuresTo(graph, HAMMER)).toEqual([2]);
	});

	it('returns nothing for a position no figure touches', () => {
		expect(figuresFrom(graph, SHADOW)).toEqual([]);
		expect(figuresTo(graph, SHADOW)).toEqual([]);
	});
});

describe('follows / precedes', () => {
	const graph = g([
		fig(1, [OPEN], [CROSS]),
		fig(2, [CROSS], [HAMMER]),
		fig(3, [HAMMER, CROSS], [OPEN])
	]);

	it('follows is what starts where this figure ended', () => {
		expect(follows(graph, 1)).toEqual([2, 3]);
		expect(follows(graph, 2)).toEqual([3]);
	});

	it('precedes is what ends where this figure can start', () => {
		expect(precedes(graph, 3)).toEqual([1, 2]);
	});

	it('reaches an untagged figure from both sides', () => {
		const withFree = g([...graph.figures, fig(4)]);
		expect(follows(withFree, 2)).toEqual([3, 4]);
		expect(precedes(withFree, 1)).toEqual([3, 4]);
		expect(follows(withFree, 4)).toEqual([1, 2, 3, 4]);
	});

	it('is empty for an unknown figure rather than throwing', () => {
		expect(follows(graph, 99)).toEqual([]);
		expect(precedes(graph, 99)).toEqual([]);
	});
});

describe('positionCounts', () => {
	it('flags a dead end, an orphan and an unused position', () => {
		const graph = g([
			fig(1, [OPEN], [HAMMER]), // enters hammerlock
			fig(2, [SHADOW], [OPEN]) // leaves shadow, nothing enters it
		]);
		const counts = positionCounts(graph, [OPEN, HAMMER, SHADOW, CROSS]);
		const by = (id: number) => counts.find((c) => c.id === id)!;

		expect(by(HAMMER)).toMatchObject({ inCount: 1, outCount: 0, deadEnd: true, orphan: false });
		expect(by(SHADOW)).toMatchObject({ inCount: 0, outCount: 1, deadEnd: false, orphan: true });
		expect(by(CROSS)).toMatchObject({ inCount: 0, outCount: 0, unused: true });
		expect(by(OPEN)).toMatchObject({ deadEnd: false, orphan: false, unused: false });
	});

	it('does not count an untagged figure for any position', () => {
		const graph = g([fig(1, [OPEN], [HAMMER]), fig(2)]);
		const counts = positionCounts(graph, [OPEN, HAMMER]);
		expect(counts.map((c) => [c.id, c.inCount, c.outCount])).toEqual([
			[OPEN, 0, 1],
			[HAMMER, 1, 0]
		]);
	});

	it('names the dead ends and orphans on their own', () => {
		const graph = g([fig(1, [OPEN], [HAMMER]), fig(2, [SHADOW], [OPEN])]);
		const ids = [OPEN, HAMMER, SHADOW, CROSS];
		expect(deadEnds(graph, ids)).toEqual([HAMMER]);
		expect(orphans(graph, ids)).toEqual([SHADOW]);
	});

	it('marks the positions of the smaller of two linked parts as islands', () => {
		const A = 1;
		const B = 2;
		const C = 3;
		const D = 4;
		const E = 5;
		const graph = g([
			fig(1, [A], [B]),
			fig(2, [B], [A]),
			fig(3, [A], [C]), // the main part: A, B, C, three figures
			fig(4, [D], [E]) // cut off: D, E, one figure
		]);
		const counts = positionCounts(graph, [A, B, C, D, E]);
		expect(counts.map((c) => [c.id, c.island])).toEqual([
			[A, false],
			[B, false],
			[C, false],
			[D, true],
			[E, true]
		]);
	});

	it('has no islands when the figures make one part', () => {
		const graph = g([fig(1, [OPEN], [HAMMER]), fig(2, [SHADOW], [OPEN])]);
		const counts = positionCounts(graph, [OPEN, HAMMER, SHADOW, CROSS]);
		expect(counts.some((c) => c.island)).toBe(false);
	});

	it('never calls an unused position an island', () => {
		const graph = g([fig(1, [OPEN], [HAMMER])]);
		expect(positionCounts(graph, [CROSS])[0]).toMatchObject({ unused: true, island: false });
	});

	it('never calls a lone position an island: a start-only figure’s start is an orphan', () => {
		const graph = g([fig(1, [OPEN], [CROSS]), fig(2, [CROSS], [OPEN]), fig(3, [SHADOW])]);
		expect(positionCounts(graph, [SHADOW])[0]).toMatchObject({ orphan: true, island: false });
	});

	it('calls two linked positions cut off from a bigger part islands', () => {
		const graph = g([fig(1, [OPEN], [CROSS]), fig(2, [CROSS], [OPEN]), fig(3, [HAMMER], [SHADOW])]);
		expect(positionCounts(graph, [OPEN, CROSS, HAMMER, SHADOW]).map((c) => c.island)).toEqual([
			false,
			false,
			true,
			true
		]);
	});

	it('breaks a tie in figures by more positions, then by the lowest id', () => {
		// One figure each: {1, 2} has two positions, {3, 4, 5} three.
		const byPositions = g([fig(1, [1], [2]), fig(2, [3, 4], [5])]);
		expect(positionCounts(byPositions, [1, 2, 3, 4, 5]).map((c) => c.island)).toEqual([
			true,
			true,
			false,
			false,
			false
		]);
		// One figure and two positions each: the part holding the lowest id wins.
		const byId = g([fig(1, [7], [8]), fig(2, [5], [6])]);
		expect(positionCounts(byId, [5, 6, 7, 8]).map((c) => c.island)).toEqual([
			false,
			false,
			true,
			true
		]);
	});
});

describe('noPosition', () => {
	it('splits the figures missing a side into none, only a start and only an end', () => {
		const graph = g([fig(1), fig(2, [OPEN]), fig(3, [], [OPEN]), fig(4, [OPEN], [CROSS]), fig(5)]);
		expect(noPosition(graph)).toEqual({ none: [1, 5], onlyStart: [2], onlyEnd: [3] });
	});
});

describe('taggedCount', () => {
	it('counts a figure with either side as done', () => {
		const graph = g([fig(1), fig(2, [OPEN]), fig(3, [], [OPEN]), fig(4, [OPEN], [CROSS])]);
		expect(taggedCount(graph)).toEqual({ done: 3, total: 4 });
	});
});

describe('nextCountOf', () => {
	it('reads the figure’s own start and length', () => {
		expect(nextCountOf({ id: 1, starts: [], ends: [], start: 5, length: 4 })).toBe(1);
		expect(nextCountOf({ id: 2, starts: [], ends: [], start: 1, length: 4 })).toBe(5);
	});
});
