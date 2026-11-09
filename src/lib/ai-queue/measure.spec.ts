import { describe, expect, it } from 'vitest';
import { compareSections } from './measure';

const s = (startMs: number, endMs: number) => ({ startMs, endMs });

describe('compareSections', () => {
	it('an exact match is one close pair', () => {
		const r = compareSections([s(10_000, 20_000)], [s(10_000, 20_000)]);
		expect(r.pairs).toHaveLength(1);
		expect(r.pairs[0]).toMatchObject({ startDeltaMs: 0, endDeltaMs: 0, close: true });
		expect(r.missed).toEqual([]);
		expect(r.extra).toEqual([]);
	});

	it('1.5 s early at both ends is close; deltas are ai minus mine', () => {
		const r = compareSections([s(10_000, 20_000)], [s(8_500, 18_500)]);
		expect(r.pairs[0]).toMatchObject({ startDeltaMs: -1500, endDeltaMs: -1500, close: true });
	});

	it('3 s late is paired but not close', () => {
		const r = compareSections([s(10_000, 20_000)], [s(13_000, 23_000)]);
		expect(r.pairs[0]).toMatchObject({ startDeltaMs: 3000, close: false });
	});

	it('an ai section overlapping nothing is extra; an unmatched one of mine is missed', () => {
		const r = compareSections(
			[s(0, 5000), s(30_000, 40_000)],
			[s(30_000, 40_000), s(60_000, 70_000)]
		);
		expect(r.pairs).toHaveLength(1);
		expect(r.missed).toEqual([s(0, 5000)]);
		expect(r.extra).toEqual([s(60_000, 70_000)]);
	});

	it('two ai sections over one of mine: the larger overlap pairs, the other is extra', () => {
		const r = compareSections([s(10_000, 20_000)], [s(10_000, 13_000), s(11_000, 20_000)]);
		expect(r.pairs).toHaveLength(1);
		expect(r.pairs[0].ai).toEqual(s(11_000, 20_000));
		expect(r.extra).toEqual([s(10_000, 13_000)]);
	});

	it('too little overlap does not pair', () => {
		const r = compareSections([s(0, 10_000)], [s(9000, 20_000)]);
		expect(r.pairs).toEqual([]);
		expect(r.missed).toHaveLength(1);
		expect(r.extra).toHaveLength(1);
	});

	it('a wider tolerance', () => {
		const r = compareSections([s(10_000, 20_000)], [s(13_000, 23_000)], 3000);
		expect(r.pairs[0].close).toBe(true);
	});
});
