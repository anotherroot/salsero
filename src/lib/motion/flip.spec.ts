import { describe, expect, it } from 'vitest';
import { flipPlan, type Box } from './flip';

const at = (o: Record<string, number>, h = 66) =>
	new Map<string, Box>(Object.entries(o).map(([k, top]) => [k, { top, height: h }]));

describe('flipPlan', () => {
	it('one row leaves: it goes, and the rows under it move up', () => {
		expect(flipPlan(at({ a: 0, b: 66, c: 132 }), at({ a: 0, c: 66 }))).toEqual({
			moves: [{ key: 'c', dy: 66 }],
			entering: [],
			leaving: ['b']
		});
	});

	it('Undo brings it back: the rows under it move down, and it comes in', () => {
		expect(flipPlan(at({ a: 0, c: 66 }), at({ a: 0, b: 66, c: 132 }))).toEqual({
			moves: [{ key: 'c', dy: -66 }],
			entering: ['b'],
			leaving: []
		});
	});

	it('Done reorders: each row moves from where it was', () => {
		const plan = flipPlan(at({ x: 0, y: 66, z: 132 }), at({ z: 0, x: 66, y: 132 }));
		expect(plan.moves).toEqual([
			{ key: 'z', dy: 132 },
			{ key: 'x', dy: -66 },
			{ key: 'y', dy: -66 }
		]);
		expect(plan.entering).toEqual([]);
		expect(plan.leaving).toEqual([]);
	});

	it('nothing changed: nothing moves', () => {
		expect(flipPlan(at({ a: 0, b: 66 }), at({ a: 0, b: 66 })).moves).toEqual([]);
	});

	it('under half a pixel is no move (rounding, a hairline)', () => {
		expect(flipPlan(at({ a: 0, b: 66 }), at({ a: 0, b: 66.4 })).moves).toEqual([]);
	});

	it('a fast second change starts from where the rows are drawn now', () => {
		// Mid-fold, c is drawn 40 px down (its last move not finished): the next plan
		// moves it from there, not from its old slot.
		expect(flipPlan(at({ a: 0, c: 106 }), at({ c: 0 })).moves).toEqual([{ key: 'c', dy: 106 }]);
	});
});
