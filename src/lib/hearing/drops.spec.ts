import { describe, expect, it } from 'vitest';
import {
	ROOM_BEATS,
	countKeep,
	dropStarts,
	mixStarts,
	dropWindow,
	judgeDropPattern,
	judgeDrops,
	shiftOf
} from './drops';
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

const EVERY = [1, 2, 3, 4, 5, 6, 7, 8];
const CLAVE_23 = [2, 3, 5, 6.5, 8];
/** Taps right on beats `from`…`to - 1` of the 120 BPM grid (a beat every 0.5 s). */
const onBeats = (from: number, to: number) =>
	Array.from({ length: to - from }, (_, i) => (from + i) * 0.5);

describe('ROOM_BEATS', () => {
	it('is seven eights: four to listen, two to tap, one spare', () => {
		expect(ROOM_BEATS).toBe(56);
	});
});

describe('shiftOf', () => {
	it('is how many counts the first tap sits from where the pattern starts', () => {
		expect(shiftOf(5, 1)).toBe(4);
		expect(shiftOf(1, 1)).toBe(0);
		expect(shiftOf(3, 1)).toBe(2);
		expect(shiftOf(2, 1)).toBe(1);
		expect(shiftOf(6, 2)).toBe(4);
	});
});

describe('countKeep', () => {
	it('keeps less the further the count was off', () => {
		expect(countKeep(0)).toBe(1);
		expect(countKeep(4)).toBe(0.5);
		expect(countKeep(2)).toBe(0.25);
		expect(countKeep(6)).toBe(0.25);
		for (const s of [1, 3, 5, 7]) expect(countKeep(s)).toBe(0.1);
	});
});

describe('dropWindow', () => {
	it('starts at the first tap and ends at the last beat two eights on', () => {
		// The first tap on the music's 5 (beat 4, 2 s): every beat runs to beat 19 (9.5 s).
		expect(dropWindow(grid(400), 2.02, EVERY)).toEqual({
			eight: 0,
			from: 2,
			end: 9.5,
			startIndex: 4,
			shift: 4
		});
	});

	it('takes a tap just before a 1 as that 1', () => {
		expect(dropWindow(grid(400), 15.9, EVERY)).toMatchObject({ startIndex: 32, shift: 0 });
	});
});

describe('judgeDropPattern in the person count', () => {
	it('judges two full eights from the first tap, counted from where the person started', () => {
		const d = judgeDropPattern(grid(400), EVERY, 0, onBeats(4, 20));
		expect(d).toMatchObject({ shift: 4, of: 16, hits: 16, spot: 16 });
		expect(d.beats[0]).toMatchObject({ pos: 5, yours: 1, row: 0 });
		expect(new Set(d.beats.map((b) => b.row))).toEqual(new Set([0, 1, 2]));
	});

	it('sees the clave 2-3 tapped as 3-2 as four counts off, every hit in time', () => {
		// 3-2 hits in the music: 1, 2.5, 4, 6, 7 of each eight; the person meant them as 2-3.
		const taps = [6, 7, 9, 10.5, 12]
			.flatMap((c) => [(c - 1) * 0.5 + 0, (c - 1 + 8) * 0.5])
			.sort((a, b) => a - b);
		const d = judgeDropPattern(grid(400), CLAVE_23, 0, taps);
		expect(d.shift).toBe(4);
		expect(d).toMatchObject({ of: 10, hits: 10 });
	});

	it('misses only the forgotten tap, the rest stay right', () => {
		const taps = onBeats(0, 16).filter((_, i) => i !== 5);
		const d = judgeDropPattern(grid(400), EVERY, 0, taps);
		expect(d).toMatchObject({ shift: 0, of: 16, hits: 15 });
		expect(d.beats.filter((b) => b.state === 'miss').map((b) => b.yours)).toEqual([6]);
	});

	it('takes the shift from the beat nearest a first tap far from every beat', () => {
		const d = judgeDropPattern(grid(400), EVERY, 0, [2.2, ...onBeats(5, 20)]);
		expect(d.shift).toBe(4);
		expect(d.beats[0].state).toBe('miss');
	});

	it('leaves out the beats past the end of the song', () => {
		const d = judgeDropPattern(grid(22), EVERY, 0, onBeats(10, 22));
		expect(d.of).toBeLessThan(16);
		expect(d.of).toBe(12);
	});

	it('has no beats and no shift without a tap', () => {
		expect(judgeDropPattern(grid(400), CLAVE_23, 10, [])).toMatchObject({
			shift: 0,
			beats: [],
			of: 10,
			hits: 0
		});
	});
});

describe('judgeDrops', () => {
	it('adds up the beats of every drop', () => {
		const g = grid(400);
		const r = judgeDrops([
			judgeDropPattern(g, [1, 3, 5, 7], 10, onBeats(24, 28)),
			judgeDropPattern(g, [1, 3, 5, 7], 40, [])
		]);
		expect(r).toMatchObject({ of: 16 });
	});
});

describe('a re-anchored count', () => {
	// A short bar: 1–8, then 1–5, then 1–8 again (the count re-anchored on a new 1).
	const counts = [...EVERY, 1, 2, 3, 4, 5, ...EVERY, ...EVERY, ...EVERY];
	const g = { beats: counts.map((_, i) => i * 0.5), counts };

	it('follows the music’s new 1, every beat drawn where it is counted', () => {
		const d = judgeDropPattern(g, EVERY, 0, onBeats(0, 16));
		expect(d).toMatchObject({ shift: 0, of: 16, hits: 16 });
		expect(d.beats.every((b) => b.pos === b.yours)).toBe(true);
		expect(new Set(d.beats.map((b) => b.row))).toEqual(new Set([0, 1, 2]));
	});

	it('judges the 1 where the music has it', () => {
		const d = judgeDropPattern(g, [1], 0, [0, 4, 6.5]);
		expect(d).toMatchObject({ shift: 0, hits: 3, of: 3 });
	});
});

describe('the clave from wherever the first tap fits', () => {
	it('reads 3-2 tapped from the music’s 1 as 2-3 four counts off', () => {
		// 3-2 in the music: 1, 2.5, 4, 6, 7 — the person meant 2-3.
		const taps = [1, 2.5, 4, 6, 7]
			.flatMap((c) => [(c - 1) * 0.5, (c - 1 + 8) * 0.5])
			.sort((a, b) => a - b);
		const d = judgeDropPattern(grid(400), CLAVE_23, 0, taps);
		expect(d).toMatchObject({ shift: 4, hits: 10, of: 10 });
	});

	it('keeps the first circle as the first tap when several fit as well (every beat from the 5)', () => {
		expect(judgeDropPattern(grid(400), EVERY, 0, onBeats(4, 20)).shift).toBe(4);
	});
});

describe('mixStarts: a round over several songs (phase 2)', () => {
	it('gives each spot a song, its start inside that song, never the same spot twice in one song', () => {
		const songs = [grid(400), grid(300)].map((g) => ({ grid: g, quiet: [], from: 0 }));
		const spots = mixStarts(songs, { count: 10, rand: seeded(3) });
		expect(spots).toHaveLength(10);
		for (const s of spots) expect(songs[s.song].grid.beats).toContain(s.at);
		for (const i of [0, 1]) {
			const mine = spots.filter((s) => s.song === i).map((s) => s.at);
			expect(new Set(mine).size).toBe(mine.length);
		}
		expect(new Set(spots.map((s) => s.song)).size).toBe(2);
	});

	it('a song with no room gives none: every spot from the other', () => {
		const songs = [grid(40), grid(400)].map((g) => ({ grid: g, quiet: [], from: 0 }));
		const spots = mixStarts(songs, { count: 5, rand: seeded() });
		expect(spots).toHaveLength(5);
		expect(spots.every((s) => s.song === 1)).toBe(true);
	});

	it('no song with room: no spots', () => {
		expect(
			mixStarts([{ grid: grid(40), quiet: [], from: 0 }], { count: 5, rand: seeded() })
		).toEqual([]);
		expect(mixStarts([], { count: 5, rand: seeded() })).toEqual([]);
	});
});
