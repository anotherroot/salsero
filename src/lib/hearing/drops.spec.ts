import { describe, expect, it } from 'vitest';
import { ROOM_BEATS, dropStarts, dropWindow, judgeDropPattern, judgeDrops } from './drops';
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
			expect(s).toBeLessThanOrEqual(g.beats[400 - ROOM_BEATS]);
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

describe('ROOM_BEATS', () => {
	it('is seven eights: four to listen, two to tap, one spare', () => {
		expect(ROOM_BEATS).toBe(56);
	});
});

describe('dropWindow', () => {
	it("is the first tap's eight and the next one", () => {
		expect(dropWindow(grid(400), 12.02)).toEqual({ eight: 3, from: 12, end: 20 });
	});

	it('takes a tap just before a 1 as that 1', () => {
		expect(dropWindow(grid(400), 15.9).eight).toBe(4);
	});

	it('keeps a tap a little late on the 8 in the eight of that 8', () => {
		expect(dropWindow(grid(400), 15.62).eight).toBe(3);
	});
});

describe('judgeDropPattern in its window', () => {
	it('leaves out the beats of the first eight before the first tap', () => {
		const d = judgeDropPattern(grid(400), [1, 3, 5, 7], 10, [14.02, 15, 16.03, 17]);
		expect(d).toMatchObject({ eight: 3, of: 6, hits: 4, spot: 4, close: 0 });
		expect(d.beats.filter((b) => b.state === 'skip').map((b) => b.pos)).toEqual([1, 3]);
		expect(d.beats.filter((b) => b.state === 'miss').map((b) => [b.row, b.pos])).toEqual([
			[1, 5],
			[1, 7]
		]);
		expect(d.taps).toEqual([14.02, 15, 16.03, 17]);
	});

	it('marks a hit within 150 ms as close', () => {
		const d = judgeDropPattern(grid(400), [1], 10, [12.1, 16.02]);
		expect(d).toMatchObject({ of: 2, hits: 2, spot: 1, close: 1 });
	});

	it('has no beats and no eight without a tap', () => {
		expect(judgeDropPattern(grid(400), [2, 3, 5, 6.5, 8], 10, [])).toMatchObject({
			eight: null,
			beats: [],
			of: 10,
			hits: 0
		});
	});
});
