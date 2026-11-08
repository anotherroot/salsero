import { describe, expect, it } from 'vitest';
import { doneHref, parseSkip, playerFrom, runHref, runOf, runPlace, runStep } from './run';

type Kind = 'done' | 'todo' | 'picked';
const w = (id: number, kind: Kind = 'todo') => ({
	exercise: { id },
	kind,
	list: 'warmup' as const
});
const p = (id: number, kind: Kind = 'todo') => ({
	exercise: { id },
	kind,
	list: 'practice' as const
});

describe('parseSkip', () => {
	it.each([
		[null, []],
		['', []],
		['3,5', [3, 5]],
		['abc,-1,3,3,0,2.5', [3]]
	])('parseSkip(%s)', (raw, want) => expect(parseSkip(raw)).toEqual(want));
	it('keeps 50 skips at most', () =>
		expect(parseSkip(Array.from({ length: 60 }, (_, i) => i + 1).join(','))).toHaveLength(50));
});

describe('runOf', () => {
	it('reads ?run=1 and its skip', () => {
		expect(runOf(new URLSearchParams('run=1&skip=3'))).toEqual({ skip: [3] });
		expect(runOf(new URLSearchParams('run=0'))).toBeNull();
		expect(runOf(new URLSearchParams(''))).toBeNull();
	});
});

describe('hrefs', () => {
	it('builds them', () => {
		expect(runHref('salsa', 12, { skip: [] })).toBe('/salsa/exercises/12?run=1');
		expect(runHref('salsa', 12, { skip: [3, 5] })).toBe('/salsa/exercises/12?run=1&skip=3,5');
		expect(doneHref('salsa')).toBe('/salsa/done');
		expect(playerFrom({ skip: [3] })).toBe('from=run&skip=3');
		expect(playerFrom({ skip: [] })).toBe('from=run');
		expect(playerFrom(null)).toBe('from=exercise');
	});
});

// a day: P1 done; warm-ups 10, 11; practice 2, 3 — total 5
const named = <R extends { exercise: { id: number } }>(r: R) => ({
	...r,
	exercise: { ...r.exercise, name: `E${r.exercise.id}` }
});
const day = { rows: [p(1, 'done'), w(10), w(11), p(2), p(3)].map(named), total: 5 };

describe('runPlace', () => {
	it('counts done rows and the walked ones not skipped', () => {
		expect(runPlace(day, [], 10)).toEqual({ at: 2, of: 5 });
		expect(runPlace(day, [10], 11)).toEqual({ at: 3, of: 5 });
		expect(runPlace(day, [10], 10)).toBeNull(); // skipped
		expect(runPlace(day, [], 1)).toBeNull(); // done today
		expect(runPlace(day, [], 99)).toBeNull(); // not on Today
		expect(runPlace(day, [99], 10)).toEqual({ at: 2, of: 5 }); // a stale skip counts nothing
	});
});

describe('runStep', () => {
	it('goes on to the next; Skip adds the current to skip', () => {
		const s = runStep('salsa', day, { skip: [] }, 10);
		expect(s.next).toEqual({ id: 11, name: 'E11' });
		expect(s.skipHref).toBe('/salsa/exercises/11?run=1&skip=10');
		expect(s.afterHref).toBe('/salsa/exercises/11?run=1');
	});
	it('the last one ends on Done for today', () => {
		const s = runStep('salsa', day, { skip: [10, 11, 2] }, 3);
		expect(s.next).toBeNull();
		expect(s.skipHref).toBe('/salsa/done');
		expect(s.afterHref).toBe('/salsa/done');
	});
	it('after an Undo the exercise is a to-do again and comes up next', () => {
		const s = runStep('salsa', day, { skip: [] }, 11);
		expect(s.next?.id).toBe(10);
		expect(s.place).toEqual({ at: 2, of: 5 });
	});
	it('an open exercise already done goes on to the first of the walk', () => {
		expect(runStep('salsa', day, { skip: [] }, 1).next?.id).toBe(10);
	});
});
