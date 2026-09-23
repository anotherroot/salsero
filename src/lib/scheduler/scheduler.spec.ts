import { describe, expect, it } from 'vitest';
import {
	CLAVE_POSITIONS,
	COUNT_CLIP,
	COUNT_POSITIONS,
	LEAD_IN_8S,
	cuesIn,
	extendPlan,
	pickFigure,
	syntheticGrid,
	timeAt,
	timeline
} from './scheduler';

/** A clean grid: `bars` 8-counts at 120 BPM, so a beat every 0.5 s. */
const grid = (bars: number) => syntheticGrid(120, bars);
const t = (bars: number) => timeline(grid(bars));

const ALL = { count: 'salsa', clave: null, callEvery: null } as const;
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

describe('cuesIn — the clave', () => {
	it('places 3-2 on 1, the and of 2, 4, 6 and 7', () => {
		const r = cuesIn(t(1), [], { count: 'off', clave: '3-2', callEvery: null }, 0, 4);
		expect(times(r)).toEqual([0, 0.75, 1.5, 2.5, 3]);
		expect(new Set(clips(r))).toEqual(new Set(['clave']));
	});

	it('places 2-3 on 2, 3, 5, the and of 6, and 8', () => {
		const r = cuesIn(t(1), [], { count: 'off', clave: '2-3', callEvery: null }, 0, 4);
		expect(times(r)).toEqual([0.5, 1, 2, 2.75, 3.5]);
	});

	it('is the 3-2 pattern with its halves swapped', () => {
		const shifted = CLAVE_POSITIONS['3-2'].map((p) => ((p + 3) % 8) + 1).sort((a, b) => a - b);
		expect(shifted).toEqual(CLAVE_POSITIONS['2-3']);
	});
});

describe('cuesIn — calls', () => {
	const pool = [7];
	const plan = [{ eight: 2, figureId: 7 }];

	it('sounds a call on the 5 of the 8-count before the figure', () => {
		// 8-count 1 starts at beat 8 (4 s); its count 5 is beat 12 = 6 s.
		const r = cuesIn(t(4), plan, { ...ALL, callEvery: 2 }, 0, 12);
		expect(r.calls).toEqual([{ at: 6, eight: 2, figureId: 7 }]);
	});

	it('suppresses the spoken count on 5-6-7 under a call', () => {
		const r = cuesIn(t(4), plan, { ...ALL, callEvery: 2 }, 6, 8);
		expect(clips(r)).toEqual([]); // 5, 6, 7 of 8-count 1 are the call's window
	});

	it('still counts 1 2 3 in the bar carrying a call', () => {
		expect(clips(cuesIn(t(4), plan, { ...ALL, callEvery: 2 }, 4, 6))).toEqual([
			'uno',
			'dos',
			'tres'
		]);
	});

	it('leaves other 8-counts fully counted', () => {
		expect(clips(cuesIn(t(4), plan, { ...ALL, callEvery: 2 }, 2, 4))).toEqual([
			'cinco',
			'seis',
			'siete'
		]);
	});

	it('drops a call whose lead-in bar is off the end of the grid', () => {
		expect(
			cuesIn(t(1), [{ eight: 9, figureId: 7 }], { ...ALL, callEvery: 2 }, 0, 99).calls
		).toEqual([]);
	});

	it('ignores the pool when calls are switched off', () => {
		expect(cuesIn(t(4), plan, ALL, 0, 12).calls).toEqual([]);
		expect(pool).toHaveLength(1);
	});
});

describe('pickFigure', () => {
	it('never returns the figure just called', () => {
		for (let i = 0; i < 10; i++) expect(pickFigure([1, 2, 3], 2, i / 10)).not.toBe(2);
	});

	it('repeats when the pool holds only that figure', () => {
		expect(pickFigure([1], 1, 0.9)).toBe(1);
	});

	it('returns null for an empty pool', () => {
		expect(pickFigure([], null, 0)).toBeNull();
	});

	it('spreads across the pool', () => {
		expect([0, 0.4, 0.9].map((r) => pickFigure([1, 2, 3], null, r))).toEqual([1, 2, 3]);
	});
});

describe('extendPlan', () => {
	const rand = (seq: number[]) => {
		let i = 0;
		return () => seq[i++ % seq.length];
	};

	it('starts after the lead-in and steps by the interval', () => {
		expect(extendPlan([], [1, 2], 2, 6, rand([0, 0.9, 0])).map((s) => s.eight)).toEqual([2, 4, 6]);
		expect(LEAD_IN_8S).toBe(2);
	});

	it('continues an existing plan without redeciding it', () => {
		const first = extendPlan([], [1, 2], 2, 2, rand([0]));
		const more = extendPlan(first, [1, 2], 2, 4, rand([0.9]));
		expect(more[0]).toEqual(first[0]);
		expect(more).toHaveLength(2);
	});

	it('never places the same figure twice running', () => {
		const steps = extendPlan([], [1, 2, 3], 1, 20, rand([0, 0, 0, 0.99, 0.5]));
		for (let i = 1; i < steps.length; i++) {
			expect(steps[i].figureId).not.toBe(steps[i - 1].figureId);
		}
	});

	it('returns the plan unchanged for an empty pool', () => {
		expect(extendPlan([], [], 2, 10, rand([0]))).toEqual([]);
	});
});
