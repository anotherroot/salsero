import { describe, expect, it } from 'vitest';
import type { Placed } from '$lib/songs/sections';
import { expectedTaps, judgeTapAlong, matchTaps, windowS, type Grid } from './judge';

/** 120 BPM from 0: a beat every 0.5 s, counts 1–8 over and over. */
function grid(n = 64): Grid {
	return {
		beats: Array.from({ length: n }, (_, i) => i * 0.5),
		counts: Array.from({ length: n }, (_, i) => (i % 8) + 1)
	};
}

const section = (name: string, beat: number): Placed => ({
	name,
	at: beat * 0.5,
	countOff: false,
	index: 0,
	beat,
	t: beat * 0.5
});

describe('expectedTaps', () => {
	it('lists every target position in the stretch', () => {
		const e = expectedTaps(grid(), [1], 0, 8, []);
		expect(e.map((x) => x.at)).toEqual([0, 4]);
		expect(e.map((x) => x.eight)).toEqual([0, 1]);
	});

	it('expects nothing in a quiet part', () => {
		expect(expectedTaps(grid(), [1], 0, 8, [{ from: 0, to: 4 }]).map((x) => x.at)).toEqual([4]);
	});
});

describe('windowS', () => {
	it('is 150 ms, or under half a beat when beats are short', () => {
		expect(windowS(0.5)).toBeCloseTo(0.15, 9);
		expect(windowS(0.24)).toBeCloseTo(0.108, 9);
	});
});

describe('matchTaps', () => {
	it('marks spot on and close', () => {
		const g = grid();
		const { matches } = matchTaps(g, expectedTaps(g, [1], 0, 8, []), [0.03, 4.1]);
		expect(matches.map((m) => m.mark)).toEqual(['spot', 'close']);
		expect(matches[0].offset).toBeCloseTo(0.03, 9);
		expect(matches[1].offset).toBeCloseTo(0.1, 9);
	});

	it('never uses one tap twice, and keeps the other as an extra', () => {
		const g = grid();
		const { matches, extras } = matchTaps(g, expectedTaps(g, [1], 0, 4, []), [0.02, 0.05]);
		expect(matches).toHaveLength(1);
		expect(matches[0].tap).toBe(0.02);
		expect(extras.map((x) => x.at)).toEqual([0.05]);
	});

	it('names the count of a tap far from any target', () => {
		const g = grid();
		const { extras } = matchTaps(g, expectedTaps(g, [1], 0, 8, []), [3.0]);
		expect(extras).toHaveLength(1);
		expect(extras[0].count).toBe(7);
	});
});

describe('judgeTapAlong', () => {
	const base = { grid: grid(), positions: [1], from: 0, to: 8, quiet: [], sections: [] };

	it('says when every tap sat on another count', () => {
		const r = judgeTapAlong({ ...base, taps: [2, 6] });
		expect(r.rows.map((row) => row.otherCount)).toEqual([5, 5]);
		expect(r.sections[0].verdict).toBe('other');
		expect(r.sections[0].otherCount).toBe(5);
		expect(r.hit).toBe(0);
	});

	it('counts only what was played when the round stops early', () => {
		const r = judgeTapAlong({ ...base, to: 2, taps: [0.01] });
		expect(r.of).toBe(1);
		expect(r.hit).toBe(1);
	});

	it('reads +80 ms on average as late and +40 ms as on time', () => {
		expect(judgeTapAlong({ ...base, taps: [0.08, 4.08] }).sections[0].verdict).toBe('late');
		expect(judgeTapAlong({ ...base, taps: [0.04, 4.04] }).sections[0].verdict).toBe('on');
		expect(judgeTapAlong({ ...base, taps: [-0.08, 3.92] }).sections[0].verdict).toBe('early');
	});

	it('gives the score and the average in ms', () => {
		const r = judgeTapAlong({ ...base, taps: [0.04, 4.06] });
		expect(r).toMatchObject({ hit: 2, of: 2, meanMs: 50 });
	});

	it('says missed when nothing was tapped', () => {
		const r = judgeTapAlong({ ...base, taps: [] });
		expect(r.sections[0].verdict).toBe('missed');
		expect(r.meanMs).toBeNull();
	});

	it('gives each section of the song its own line', () => {
		const r = judgeTapAlong({
			...base,
			to: 16,
			sections: [section('Verse', 0), section('Coro', 16)],
			taps: [0.01, 4.01, 10, 14]
		});
		expect(r.sections.map((s) => [s.name, s.verdict])).toEqual([
			['Verse', 'on'],
			['Coro', 'other']
		]);
	});
});
