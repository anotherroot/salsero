import { describe, expect, it } from 'vitest';
import { PUSH, beatLife, callMoves, leadMotion, pushScale, stepMotion } from './beat-motion';

describe('stepMotion: a count moves only on a plain step forward', () => {
	it('every count pushes the same, the 1 and the 5 too', () => {
		expect(stepMotion(3, 4, 5, false, false)).toBe('push');
		expect(stepMotion(7, 8, 1, false, false)).toBe('push');
		expect(stepMotion(3, 4, 2, false, false)).toBe('push');
	});

	it('a seek, a jump back or a loop restart moves nothing', () => {
		expect(stepMotion(3, 9, 2, false, false)).toBe('none');
		expect(stepMotion(9, 3, 4, false, false)).toBe('none');
		expect(stepMotion(40, 0, 1, false, false)).toBe('none');
	});

	it('paused, a count-off, or no count yet: still', () => {
		expect(stepMotion(3, 4, 2, true, false)).toBe('none');
		expect(stepMotion(3, 4, 2, false, true)).toBe('none');
		expect(stepMotion(3, 4, null, false, false)).toBe('none');
		expect(stepMotion(-1, 0, 1, false, false)).toBe('push');
	});

	it('pushes by the spec’s amount', () => {
		expect(PUSH).toBe(1.045);
	});
});

describe('beatLife: a push is gone before the next count', () => {
	it('is 85 % of the step, within 150 ms to a second', () => {
		expect(beatLife(333)).toBeCloseTo(283.05);
		expect(beatLife(50)).toBeCloseTo(127.5);
		expect(beatLife(5000)).toBeCloseTo(850);
		expect(beatLife(null)).toBeCloseTo(283.05);
	});
});

describe('callMoves: Next rises into the call only when the next figure comes', () => {
	it('moves when the call becomes what Next said', () => {
		expect(callMoves({ now: 'A', next: 'B' }, 'B')).toBe(true);
	});

	it('does not move on a jump back, the same call, or nothing', () => {
		expect(callMoves({ now: 'B', next: 'C' }, 'A')).toBe(false);
		expect(callMoves({ now: 'A', next: 'B' }, 'A')).toBe(false);
		expect(callMoves({ now: 'A', next: null }, null)).toBe(false);
	});
});

describe('a lead’s beat (the dash and 5 6 7 8)', () => {
	it('moves on a plain step forward when it has any strength', () => {
		expect(leadMotion(3, 4, false, 0.5)).toBe('push');
		expect(leadMotion(3, 4, false, 0)).toBe('none');
		expect(leadMotion(3, 5, false, 1)).toBe('none');
		expect(leadMotion(3, 4, true, 1)).toBe('none');
	});
	it('pushes as hard as its strength says', () => {
		expect(pushScale()).toBe(PUSH);
		expect(pushScale(0)).toBe(1);
		expect(pushScale(2)).toBeCloseTo(1 + 2 * (PUSH - 1));
	});
});
