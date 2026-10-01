import { describe, expect, it } from 'vitest';
import { parseSnapshots } from './snapshot';

const ok = { position: 2, childId: null, note: 'hand change', figureIds: [7, 3] };

describe('parseSnapshots', () => {
	it('reads what deleteSlots wrote', () => {
		expect(parseSnapshots(JSON.stringify([ok]))).toEqual([ok]);
		const child = { position: 0, childId: 4, note: null, figureIds: [] };
		expect(parseSnapshots(JSON.stringify([child]))).toEqual([child]);
	});

	it.each([
		['not JSON', '{'],
		['not an array', JSON.stringify(ok)],
		['empty', '[]'],
		['a negative position', JSON.stringify([{ ...ok, position: -1 }])],
		['a fractional id', JSON.stringify([{ ...ok, figureIds: [1.5] }])],
		['a repeated figure', JSON.stringify([{ ...ok, figureIds: [3, 3] }])],
		['neither a figure nor a child', JSON.stringify([{ ...ok, figureIds: [] }])],
		['both a figure and a child', JSON.stringify([{ ...ok, childId: 4 }])],
		['an overlong note', JSON.stringify([{ ...ok, note: 'x'.repeat(201) }])],
		['two slots at one position', JSON.stringify([ok, ok])]
	])('refuses %s', (_, raw) => {
		expect(parseSnapshots(raw)).toBeNull();
	});
});
