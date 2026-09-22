import { describe, expect, it } from 'vitest';
import {
	addAnchor,
	beatIndexAt,
	bpmOf,
	buildGrid,
	cleanBeats,
	countsFor,
	nearestBeat,
	removeAnchor,
	scaleBeats,
	suggestOne
} from './beatgrid';

/** n beats every `p` seconds starting at `t0`. */
const steady = (n: number, p = 0.5, t0 = 1) => Array.from({ length: n }, (_, i) => t0 + i * p);

describe('cleanBeats', () => {
	it('keeps a steady grid as it is', () => {
		expect(cleanBeats(steady(10))).toEqual(steady(10));
	});

	it('fills a gap at the median interval', () => {
		// A 2 s break where four beats are missing.
		const beats = [...steady(5), ...steady(5, 0.5, 5)];
		const out = cleanBeats(beats);
		expect(out).toHaveLength(13);
		expect(out[5]).toBeCloseTo(3.5);
		expect(out[7]).toBeCloseTo(4.5);
	});

	it('drops near-duplicates and sorts', () => {
		expect(cleanBeats([2, 1, 1.5, 1.52, 2.5])).toEqual([1, 1.5, 2, 2.5]);
	});
});

describe('scaleBeats', () => {
	it('inserts midpoints at ×2 and keeps every other beat at ×½', () => {
		expect(scaleBeats([0, 1, 2], 2)).toEqual([0, 0.5, 1, 1.5, 2]);
		expect(scaleBeats([0, 1, 2, 3, 4], 0.5)).toEqual([0, 2, 4]);
		expect(scaleBeats([0, 1], 1)).toEqual([0, 1]);
	});
});

describe('bpmOf', () => {
	it('is 60 over the median interval', () => {
		expect(bpmOf(steady(20, 0.5))).toBeCloseTo(120);
		expect(bpmOf([1])).toBeNull();
	});
});

describe('suggestOne', () => {
	it('picks the beat phase most downbeats land on', () => {
		const beats = steady(32);
		// Downbeats on beat indices 2, 6, 10, … plus one stray on index 3.
		const downbeats = [2, 6, 10, 14, 18, 3].map((i) => beats[i] + 0.02);
		expect(suggestOne(beats, downbeats)).toBe(2);
	});

	it('ignores downbeats far from any beat, and is null with nothing to go on', () => {
		const beats = steady(8);
		expect(suggestOne(beats, [beats[1] + 0.25])).toBeNull();
		expect(suggestOne(beats, [])).toBeNull();
		expect(suggestOne([], [1])).toBeNull();
	});
});

describe('countsFor', () => {
	it('counts 1–8 from the fallback when there are no anchors', () => {
		expect(countsFor(10, [], 2)).toEqual([7, 8, 1, 2, 3, 4, 5, 6, 7, 8]);
	});

	it('counts forward from each anchor and backwards before the first', () => {
		const c = countsFor(20, [3, 13], 0);
		expect(c.slice(0, 5)).toEqual([6, 7, 8, 1, 2]);
		expect(c[11]).toBe(1); // 3 + 8, still following the first anchor
		expect(c[12]).toBe(2);
		expect(c[13]).toBe(1); // re-anchored
		expect(c[19]).toBe(7);
	});

	it('ignores anchors outside the beats', () => {
		expect(countsFor(3, [-1, 99], 0)).toEqual([1, 2, 3]);
	});
});

describe('beatIndexAt / nearestBeat', () => {
	const beats = [1, 2, 3, 4];
	it('finds the last beat at or before t', () => {
		expect(beatIndexAt(beats, 0.5)).toBe(-1);
		expect(beatIndexAt(beats, 1)).toBe(0);
		expect(beatIndexAt(beats, 2.9)).toBe(1);
		expect(beatIndexAt(beats, 10)).toBe(3);
	});
	it('finds the nearest beat', () => {
		expect(nearestBeat(beats, 2.4)).toBe(1);
		expect(nearestBeat(beats, 2.6)).toBe(2);
		expect(nearestBeat(beats, -5)).toBe(0);
		expect(nearestBeat(beats, 99)).toBe(3);
		expect(nearestBeat([], 1)).toBe(-1);
	});
});

describe('anchors', () => {
	it('adds sorted and drops anchors that agree with the one before', () => {
		expect(addAnchor([], 5)).toEqual([5]);
		expect(addAnchor([5], 21)).toEqual([5]); // 21 − 5 = 16, same count
		expect(addAnchor([5], 22)).toEqual([5, 22]);
		expect(addAnchor([5, 22], 0)).toEqual([0, 5, 22]); // 5 − 0 = 5: a different count, kept
		expect(addAnchor([5, 22], 13)).toEqual([5, 22]); // 13 − 5 = 8: agrees with 5, dropped
	});

	it('removes', () => {
		expect(removeAnchor([1, 9, 12], 9)).toEqual([1, 12]);
	});
});

describe('buildGrid', () => {
	it('uses the suggestion without anchors, and the anchors once tapped', () => {
		const beats = steady(16);
		const downbeats = [1, 5, 9, 13].map((i) => beats[i]);
		const suggested = buildGrid({ beats, downbeats, anchors: [], tempoFactor: 1 });
		expect(suggested.suggested).toBe(true);
		expect(suggested.counts[1]).toBe(1);
		const tapped = buildGrid({ beats, downbeats, anchors: [0], tempoFactor: 1 });
		expect(tapped.suggested).toBe(false);
		expect(tapped.counts[0]).toBe(1);
	});

	it('applies the tempo factor before counting', () => {
		const g = buildGrid({ beats: steady(8), downbeats: [], anchors: [], tempoFactor: 2 });
		expect(g.beats).toHaveLength(15);
		expect(g.bpm).toBeCloseTo(240);
	});
});
