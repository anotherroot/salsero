import { describe, expect, it } from 'vitest';
import { dropStarts, judgeDrop, judgeDropPattern, judgeDrops } from './drops';
import type { Grid } from './judge';

function grid(n: number): Grid {
	return {
		beats: Array.from({ length: n }, (_, i) => i * 0.5),
		counts: Array.from({ length: n }, (_, i) => (i % 8) + 1)
	};
}

/** The same "random" numbers every run. */
function seeded(seed = 7): () => number {
	let s = seed;
	return () => {
		s = (s * 1103515245 + 12345) % 2147483648;
		return s / 2147483648;
	};
}

describe('dropStarts', () => {
	it('picks ten beats far apart, each with the song still going after it', () => {
		const g = grid(400);
		const starts = dropStarts(g, [], { count: 10, from: 0, rand: seeded() });
		expect(starts).toHaveLength(10);
		expect(new Set(starts).size).toBe(10);
		for (const s of starts) {
			expect(g.beats).toContain(s);
			expect(s).toBeLessThanOrEqual(g.beats[400 - 64]);
		}
		const sorted = [...starts].sort((a, b) => a - b);
		for (let i = 1; i < sorted.length; i++) {
			expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(8);
		}
	});

	it('picks fewer on a short song, never the same spot twice', () => {
		const starts = dropStarts(grid(100), [], { count: 10, from: 0, rand: seeded() });
		expect(starts.length).toBeGreaterThan(0);
		expect(starts.length).toBeLessThan(10);
		expect(new Set(starts).size).toBe(starts.length);
	});

	it('never drops into a quiet part or before the music starts', () => {
		const quiet = dropStarts(grid(400), [{ from: 0, to: 50 }], {
			count: 10,
			from: 0,
			rand: seeded(3)
		});
		expect(Math.min(...quiet)).toBeGreaterThanOrEqual(50);
		const late = dropStarts(grid(400), [], { count: 10, from: 30, rand: seeded(5) });
		expect(Math.min(...late)).toBeGreaterThanOrEqual(30);
	});
});

describe('judgeDrop', () => {
	it('takes a tap near the next 1 as found', () => {
		const d = judgeDrop(grid(400), [1], 10, 12.05);
		expect(d.hit).toBe(true);
		expect(d.offset).toBeCloseTo(0.05, 9);
		expect(d.count).toBe(1);
		expect(d.listened).toBeCloseTo(2.05, 9);
	});

	it('says which count a wrong tap was on', () => {
		const d = judgeDrop(grid(400), [1], 10, 14.0);
		expect(d.hit).toBe(false);
		expect(d.count).toBe(5);
	});

	it('records a drop with no tap as not found', () => {
		expect(judgeDrop(grid(400), [1], 10, null)).toEqual({
			start: 10,
			tap: null,
			hit: false,
			offset: null,
			count: null,
			listened: null,
			hits: 0,
			of: 1
		});
	});
});

describe('judgeDrops', () => {
	it('scores the round and averages the found ones', () => {
		const g = grid(400);
		const r = judgeDrops([
			judgeDrop(g, [1], 10, 12.04),
			judgeDrop(g, [1], 20, 24.06),
			judgeDrop(g, [1], 30, null)
		]);
		expect(r).toMatchObject({ hit: 2, of: 3, meanMs: 50 });
		expect(r.meanListened).toBeCloseTo(3.05, 9);
	});
});

describe('judgeDropPattern', () => {
	it('judges two eights of taps from the first one', () => {
		// 1 3 5 7 from 12 s: the 1s of the next two eights are at 12 and 16.
		const d = judgeDropPattern(grid(400), [1, 3, 5, 7], 10, [12.02, 13.0, 14.04, 15.0]);
		expect(d).toMatchObject({ start: 10, tap: 12.02, hits: 4, of: 8, hit: false });
		expect(d.listened).toBeCloseTo(2.02, 9);
		expect(d.offset).toBeCloseTo(0.015, 9);
	});

	it('counts every target beat of the two eights as missed without a tap', () => {
		expect(judgeDropPattern(grid(400), [2, 3, 5, 6.5, 8], 10, [])).toMatchObject({
			tap: null,
			hits: 0,
			of: 10,
			hit: false
		});
	});

	it('calls a drop found when every beat was hit', () => {
		const taps = [12, 13, 14, 15, 16, 17, 18, 19];
		expect(judgeDropPattern(grid(400), [1, 3, 5, 7], 10, taps)).toMatchObject({
			hits: 8,
			of: 8,
			hit: true
		});
	});
});

describe('judgeDrops with patterns', () => {
	it('adds up the beats of every drop', () => {
		const g = grid(400);
		const r = judgeDrops([
			judgeDropPattern(g, [1, 3, 5, 7], 10, [12, 13, 14, 15]),
			judgeDropPattern(g, [1, 3, 5, 7], 40, [])
		]);
		expect(r).toMatchObject({ hit: 4, of: 16 });
	});
});
