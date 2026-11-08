import { describe, expect, it } from 'vitest';
import {
	CLAVE_POSITIONS,
	COUNT_CLIP,
	COUNT_POSITIONS,
	cuesIn,
	syntheticGrid,
	timeAt,
	timeline
} from './scheduler';

/** A clean grid: `bars` 8-counts at 120 BPM, so a beat every 0.5 s. */
const grid = (bars: number) => syntheticGrid(120, bars);
const t = (bars: number) => timeline(grid(bars));

const ALL = { count: 'salsa', clave: null } as const;
const clips = (r: { cues: { at: number; clip: string }[] }) => r.cues.map((c) => c.clip);
const times = (r: { cues: { at: number }[] }) => r.cues.map((c) => c.at);

describe('syntheticGrid', () => {
	it('spaces beats by the BPM and counts them 1-8', () => {
		const g = syntheticGrid(120, 2);
		expect(g.beats).toHaveLength(16);
		expect(g.beats[1] - g.beats[0]).toBeCloseTo(0.5);
		expect(g.counts.slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 1]);
	});
});

describe('timeline', () => {
	it('numbers the 8-counts from the first "1"', () => {
		const tl = t(3);
		expect(tl.eights.slice(0, 9)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1]);
		expect(tl.starts).toEqual([0, 8, 16]);
	});

	it('gives beats before the first "1" the 8-count -1', () => {
		// counts starting mid-bar: 5 6 7 8 1 2 ...
		const tl = timeline({ beats: [0, 0.5, 1, 1.5, 2, 2.5], counts: [5, 6, 7, 8, 1, 2] });
		expect(tl.eights).toEqual([-1, -1, -1, -1, 0, 0]);
		expect(tl.starts).toEqual([4]);
	});
});

describe('timeAt', () => {
	it('returns the beat time for a whole count', () => {
		expect(timeAt(t(2), 1, 3)).toBeCloseTo(0.5 * 10); // 8-count 1, count 3 = beat 10
	});

	it('interpolates a fractional count between its beats', () => {
		expect(timeAt(t(1), 0, 2.5)).toBeCloseTo(0.75); // halfway between beats 1 and 2
	});

	it('returns null past the end of the grid', () => {
		expect(timeAt(t(1), 5, 1)).toBeNull();
	});
});

describe('cuesIn — the count', () => {
	it('speaks 1 2 3 5 6 7 and stays silent on 4 and 8', () => {
		const r = cuesIn(t(1), [], ALL, 0, 4);
		expect(clips(r)).toEqual(['uno', 'dos', 'tres', 'cinco', 'seis', 'siete']);
		expect(times(r)).toEqual([0, 0.5, 1, 2, 2.5, 3]);
	});

	it('returns only what falls inside the window', () => {
		expect(clips(cuesIn(t(2), [], ALL, 2, 3))).toEqual(['cinco', 'seis']);
	});

	it('says nothing when the count is switched off', () => {
		expect(cuesIn(t(1), [], { ...ALL, count: 'off' }, 0, 4).cues).toEqual([]);
	});

	it('speaks son on 2 3 4 and 6 7 8, resting on 1 and 5', () => {
		const r = cuesIn(t(1), [], { ...ALL, count: 'son' }, 0, 4);
		expect(clips(r)).toEqual(['dos', 'tres', 'cuatro', 'seis', 'siete', 'ocho']);
		expect(times(r)).toEqual([0.5, 1, 1.5, 2.5, 3, 3.5]);
	});

	it('is the salsa pattern one beat later', () => {
		expect(COUNT_POSITIONS.son).toEqual(COUNT_POSITIONS.salsa.map((c) => c + 1));
	});

	it('speaks every count, 4 and 8 included', () => {
		const r = cuesIn(t(1), [], { ...ALL, count: 'all' }, 0, 4);
		expect(clips(r)).toEqual(['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho']);
	});

	/**
	 * The point of the sparse patterns: a word needs ~0.30 s and a beat at
	 * 250 BPM is 0.24 s, so the count only fits if it thins out. At 120 BPM
	 * these land every 1 s, 2 s and 4 s respectively.
	 */
	it('thins the count out for a fast song', () => {
		expect(clips(cuesIn(t(1), [], { ...ALL, count: 'odd' }, 0, 4))).toEqual([
			'uno',
			'tres',
			'cinco',
			'siete'
		]);
		expect(times(cuesIn(t(1), [], { ...ALL, count: 'odd' }, 0, 4))).toEqual([0, 1, 2, 3]);
		expect(clips(cuesIn(t(2), [], { ...ALL, count: 'ones' }, 0, 8))).toEqual([
			'uno',
			'cinco',
			'uno',
			'cinco'
		]);
		expect(clips(cuesIn(t(2), [], { ...ALL, count: 'one' }, 0, 8))).toEqual(['uno', 'uno']);
	});

	it('gives every count a clip, so only the pattern decides what is silent', () => {
		for (let c = 1; c <= 8; c++) expect(COUNT_CLIP[c]).toBeTruthy();
	});
});

describe('cuesIn — recorded phrases', () => {
	const rec = { ...ALL, phrases: true } as const;

	it('replaces the per-beat count with two half-bars', () => {
		const r = cuesIn(t(1), [], rec, 0, 4);
		expect(r.cues).toEqual([]);
		expect(r.phrases).toEqual([
			{ at: 0, endsAt: 1.5, half: 'a' }, // counts 1-3, ending on the 4
			{ at: 2, endsAt: 3.5, half: 'b' } // counts 5-7, ending on the 8
		]);
	});

	/** 6-7-8 ends on the NEXT bar's 1, which this bar has no count for. */
	it('ends son’s second half on the following bar’s "1"', () => {
		const r = cuesIn(t(2), [], { ...rec, count: 'son' }, 0, 4);
		expect(r.phrases).toEqual([
			{ at: 0.5, endsAt: 2, half: 'a' },
			{ at: 2.5, endsAt: 4, half: 'b' }
		]);
	});

	it('spans four beats a half when every count is spoken', () => {
		const r = cuesIn(t(2), [], { ...rec, count: 'all' }, 0, 4);
		expect(r.phrases).toEqual([
			{ at: 0, endsAt: 2, half: 'a' },
			{ at: 2, endsAt: 4, half: 'b' }
		]);
	});

	it('keeps both halves in a bar where a figure starts: nothing is called over them', () => {
		const plan = [{ eight: 0, figureId: 7, slot: 0 }];
		const r = cuesIn(t(2), plan, rec, 0, 4);
		expect(r.phrases.map((p) => p.half)).toEqual(['a', 'b']);
	});

	it('still emits the clave, which recordings do not replace', () => {
		const r = cuesIn(t(1), [], { ...rec, clave: '3-2' }, 0, 4);
		expect(new Set(clips(r))).toEqual(new Set(['clave']));
		expect(r.phrases).toHaveLength(2);
	});

	it('says nothing at all when the pattern is off', () => {
		const r = cuesIn(t(1), [], { ...rec, count: 'off' }, 0, 4);
		expect(r.phrases).toEqual([]);
		expect(r.cues).toEqual([]);
	});
});

describe('cuesIn — the clave', () => {
	it('places 3-2 on 1, the and of 2, 4, 6 and 7', () => {
		const r = cuesIn(t(1), [], { count: 'off', clave: '3-2' }, 0, 4);
		expect(times(r)).toEqual([0, 0.75, 1.5, 2.5, 3]);
		expect(new Set(clips(r))).toEqual(new Set(['clave']));
	});

	it('places 2-3 on 2, 3, 5, the and of 6, and 8', () => {
		const r = cuesIn(t(1), [], { count: 'off', clave: '2-3' }, 0, 4);
		expect(times(r)).toEqual([0.5, 1, 2, 2.75, 3.5]);
	});

	it('is the 3-2 pattern with its halves swapped', () => {
		const shifted = CLAVE_POSITIONS['3-2'].map((p) => ((p + 3) % 8) + 1).sort((a, b) => a - b);
		expect(shifted).toEqual(CLAVE_POSITIONS['2-3']);
	});
});

describe('cuesIn — where figures start', () => {
	const plan = [
		{ eight: 1, figureId: 7, slot: 0 },
		{ eight: 3, figureId: 8, slot: 1 }
	];

	it('gives each step at the "1" of its 8-count', () => {
		// 8-count 1 starts at beat 8 (4 s), 8-count 3 at beat 24 (12 s).
		const r = cuesIn(t(4), plan, ALL, 0, 16);
		expect(r.steps).toEqual([
			{ at: 4, step: plan[0] },
			{ at: 12, step: plan[1] }
		]);
	});

	it('returns only the steps whose "1" falls inside the window', () => {
		expect(cuesIn(t(4), plan, ALL, 4.5, 12).steps).toEqual([]);
		expect(cuesIn(t(4), plan, ALL, 4, 4.5).steps).toEqual([{ at: 4, step: plan[0] }]);
	});

	it('counts every beat of a bar where a figure starts', () => {
		expect(clips(cuesIn(t(4), plan, ALL, 4, 8))).toEqual([
			'uno',
			'dos',
			'tres',
			'cinco',
			'seis',
			'siete'
		]);
	});

	it('drops a step off the end of the grid', () => {
		expect(cuesIn(t(1), [{ eight: 9, figureId: 7, slot: 0 }], ALL, 0, 99).steps).toEqual([]);
	});
});
