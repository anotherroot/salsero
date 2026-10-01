import { describe, expect, it } from 'vitest';
import { loopTarget, msOf, sortSpots, spotLabel, spotTime, step } from './spots';

describe('spotTime', () => {
	it.each([
		[0, '0:00.0'],
		[134_500, '2:14.5'],
		[59_999, '0:59.9'],
		[60_000, '1:00.0'],
		[3_725_300, '62:05.3']
	])('%i ms is %s', (ms, text) => {
		expect(spotTime(ms)).toBe(text);
	});
});

describe('spotLabel', () => {
	it('is the label when there is one', () => {
		expect(spotLabel({ startMs: 1000, endMs: null, label: 'Hand change' })).toBe('Hand change');
	});
	it('is the time of a point, and the range of a section', () => {
		expect(spotLabel({ startMs: 134_500, endMs: null, label: null })).toBe('2:14.5');
		expect(spotLabel({ startMs: 134_500, endMs: 142_000, label: null })).toBe('2:14.5–2:22.0');
	});
});

describe('msOf', () => {
	it('rounds seconds to whole milliseconds', () => {
		expect(msOf(2.0004)).toBe(2000);
		expect(msOf(2.0006)).toBe(2001);
	});
});

describe('step', () => {
	it('moves by the delta', () => {
		expect(step(10, -1, 60)).toBe(9);
		expect(step(10, 1, 60)).toBe(11);
	});
	it('clamps at the start and at the end', () => {
		expect(step(0.4, -1, 60)).toBe(0);
		expect(step(59.5, 1, 60)).toBe(60);
	});
	it('only clamps at the start while the duration is unknown', () => {
		expect(step(10, 1, NaN)).toBe(11);
		expect(step(10, 1, Infinity)).toBe(11);
	});
});

describe('sortSpots', () => {
	it('orders by start, then by id, without touching the input', () => {
		const input = [
			{ id: 3, startMs: 500 },
			{ id: 1, startMs: 900 },
			{ id: 2, startMs: 500 }
		];
		expect(sortSpots(input).map((s) => s.id)).toEqual([2, 3, 1]);
		expect(input.map((s) => s.id)).toEqual([3, 1, 2]);
	});
});

describe('loopTarget', () => {
	const loop = { startMs: 2000, endMs: 4000 };
	it('keeps playing inside the section and before it', () => {
		expect(loopTarget(3.9, loop)).toBeNull();
		expect(loopTarget(1, loop)).toBeNull();
	});
	it('goes back to the start at and past the end', () => {
		expect(loopTarget(4, loop)).toBe(2);
		expect(loopTarget(30, loop)).toBe(2);
	});
	it('does nothing without a loop, or for a point', () => {
		expect(loopTarget(30, null)).toBeNull();
		expect(loopTarget(30, { startMs: 2000, endMs: null })).toBeNull();
	});
});
