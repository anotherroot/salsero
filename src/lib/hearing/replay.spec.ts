import { describe, expect, it } from 'vitest';
import type { DropBeat } from './drops';
import { cueHorizon, cueStart, cuesBetween, replayPlan, stepBeat } from './replay';

const g = {
	beats: Array.from({ length: 200 }, (_, i) => i * 0.5),
	counts: Array.from({ length: 200 }, (_, i) => (i % 8) + 1)
};
const b = (row: 0 | 1, pos: number, at: number, state: DropBeat['state']): DropBeat => ({
	row,
	pos,
	at,
	state,
	offset: null
});
const drop = {
	eight: 3,
	beats: [b(0, 1, 12, 'skip'), b(0, 5, 14, 'spot'), b(1, 1, 16, 'miss'), b(1, 5, 18, 'close')],
	taps: [14.01, 18.1]
};

describe('replayPlan', () => {
	it('plays from two beats before the drop to just after its two eights', () => {
		const plan = replayPlan(g, drop, 100)!;
		expect(plan.from).toBe(11);
		expect(plan.to).toBe(20.5);
		expect(plan.cues.filter((c) => c.kind === 'beat').map((c) => c.at)).toEqual([14, 16, 18]);
		expect(plan.cues.filter((c) => c.kind === 'tap').map((c) => c.at)).toEqual([14.01, 18.1]);
	});

	it('stops at the end of the song', () => {
		const plan = replayPlan(g, drop, 18)!;
		expect(plan.to).toBe(18);
		expect(plan.cues.every((c) => c.at < 18)).toBe(true);
	});

	it('has nothing to replay without a tap', () => {
		expect(replayPlan(g, { eight: null, beats: [], taps: [] }, 100)).toBeNull();
	});
});

describe('cuesBetween', () => {
	it('is half open', () => {
		const plan = replayPlan(g, drop, 100)!;
		expect(cuesBetween(plan, 14, 16).map((c) => c.at)).toEqual([14, 14.01]);
	});
});

describe('stepBeat', () => {
	it('steps to the next or the previous beat', () => {
		expect(stepBeat(g, 12.2, 1)).toBe(12.5);
		expect(stepBeat(g, 12.2, -1)).toBe(12);
		expect(stepBeat(g, 12, -1)).toBe(11.5);
		expect(stepBeat(g, 12, 1)).toBe(12.5);
	});
});

describe('scheduling the ticks', () => {
	it('looks ahead by the sound delay too, so a tick is never queued late', () => {
		expect(cueHorizon(10, 0.15, 0.25, 1)).toBeCloseTo(10.4, 9);
		expect(cueHorizon(10, 0.15, 0.25, 0.75)).toBeCloseTo(10.3, 9);
	});

	it('starts a tick early by the sound delay, so it is heard on its beat', () => {
		expect(cueStart(100, 10.3, 10, 1, 0.25)).toBeCloseTo(100.05, 9);
		expect(cueStart(100, 10.3, 10, 0.75, 0)).toBeCloseTo(100.4, 9);
	});
});
