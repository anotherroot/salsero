import { describe, expect, it } from 'vitest';
import {
	deadEnds,
	endOf,
	figuresFrom,
	figuresTo,
	follows,
	orphans,
	positionCounts,
	precedes,
	startsOf,
	type Graph
} from './graph';

/** OPEN is the neutral position; the ids are arbitrary and deliberately not 1-2-3. */
const OPEN = 10;
const CROSS = 11;
const HAMMER = 12;
const SHADOW = 13;

const g = (figures: Graph['figures']): Graph => ({ neutral: OPEN, figures });

const fig = (
	id: number,
	starts: number[] = [],
	end: number | null = null,
	eights = 1
): Graph['figures'][number] => ({ id, starts, end, eights });

describe('untagged figures read as neutral', () => {
	it('treats no start rows as the neutral position', () => {
		const graph = g([fig(1)]);
		expect(startsOf(graph, graph.figures[0])).toEqual([OPEN]);
	});

	it('treats a null end as the neutral position', () => {
		const graph = g([fig(1)]);
		expect(endOf(graph, graph.figures[0])).toBe(OPEN);
	});

	it('makes an untagged repertoire one hub: everything follows everything', () => {
		const graph = g([fig(1), fig(2), fig(3)]);
		expect(follows(graph, 1)).toEqual([1, 2, 3]);
	});
});

describe('figuresFrom / figuresTo', () => {
	const graph = g([
		fig(1, [OPEN], CROSS), // open  → cross
		fig(2, [CROSS], HAMMER), // cross → hammerlock
		fig(3, [HAMMER, CROSS], OPEN), // either → open
		fig(4) // untagged: open → open
	]);

	it('lists what can be danced from a position', () => {
		expect(figuresFrom(graph, OPEN)).toEqual([1, 4]);
		expect(figuresFrom(graph, CROSS)).toEqual([2, 3]);
	});

	it('lists what ends at a position', () => {
		expect(figuresTo(graph, OPEN)).toEqual([3, 4]);
		expect(figuresTo(graph, HAMMER)).toEqual([2]);
	});

	it('returns nothing for a position no figure touches', () => {
		expect(figuresFrom(graph, SHADOW)).toEqual([]);
		expect(figuresTo(graph, SHADOW)).toEqual([]);
	});
});

describe('follows / precedes', () => {
	const graph = g([fig(1, [OPEN], CROSS), fig(2, [CROSS], HAMMER), fig(3, [HAMMER, CROSS], OPEN)]);

	it('follows is what starts where this figure ended', () => {
		expect(follows(graph, 1)).toEqual([2, 3]);
		expect(follows(graph, 2)).toEqual([3]);
	});

	it('precedes is what ends where this figure can start', () => {
		expect(precedes(graph, 3)).toEqual([1, 2]);
	});

	it('is empty for an unknown figure rather than throwing', () => {
		expect(follows(graph, 99)).toEqual([]);
		expect(precedes(graph, 99)).toEqual([]);
	});
});

describe('positionCounts', () => {
	it('flags a dead end, an orphan and an unused position', () => {
		const graph = g([
			fig(1, [OPEN], HAMMER), // enters hammerlock
			fig(2, [SHADOW], OPEN) // leaves shadow, nothing enters it
		]);
		const counts = positionCounts(graph, [OPEN, HAMMER, SHADOW, CROSS]);
		const by = (id: number) => counts.find((c) => c.id === id)!;

		expect(by(HAMMER)).toMatchObject({ inCount: 1, outCount: 0, deadEnd: true, orphan: false });
		expect(by(SHADOW)).toMatchObject({ inCount: 0, outCount: 1, deadEnd: false, orphan: true });
		expect(by(CROSS)).toMatchObject({ inCount: 0, outCount: 0, unused: true });
		// Neutral has one in and one out, so it is none of the three.
		expect(by(OPEN)).toMatchObject({ deadEnd: false, orphan: false, unused: false });
	});

	it('names the dead ends and orphans on their own', () => {
		const graph = g([fig(1, [OPEN], HAMMER), fig(2, [SHADOW], OPEN)]);
		const ids = [OPEN, HAMMER, SHADOW, CROSS];
		expect(deadEnds(graph, ids)).toEqual([HAMMER]);
		expect(orphans(graph, ids)).toEqual([SHADOW]);
	});
});
