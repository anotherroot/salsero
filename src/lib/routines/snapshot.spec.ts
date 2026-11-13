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

describe('parseSnapshots and lengths', () => {
	const slot = { position: 0, childId: null, note: null, figureIds: [3, 4] };
	it('keeps the lengths of the slot’s own figures', () => {
		expect(parseSnapshots(JSON.stringify([{ ...slot, lengths: { 3: 12 } }]))).toEqual([
			{ ...slot, lengths: { 3: 12 } }
		]);
	});
	it('refuses a length for a figure the slot does not hold, or out of range', () => {
		expect(parseSnapshots(JSON.stringify([{ ...slot, lengths: { 9: 4 } }]))).toBeNull();
		expect(parseSnapshots(JSON.stringify([{ ...slot, lengths: { 3: 65 } }]))).toBeNull();
		expect(parseSnapshots(JSON.stringify([{ ...slot, lengths: [4] }]))).toBeNull();
	});
});

describe('parseSnapshots and a slot’s end (spec 2026-11-11, slot end)', () => {
	const slot = { position: 0, childId: null, note: null, figureIds: [3] };

	it('keeps an end', () => {
		expect(parseSnapshots(JSON.stringify([{ ...slot, end: 5 }]))).toEqual([{ ...slot, end: 5 }]);
	});

	it('refuses an end that is not an id, or on a slot holding a routine', () => {
		expect(parseSnapshots(JSON.stringify([{ ...slot, end: -1 }]))).toBeNull();
		expect(
			parseSnapshots(JSON.stringify([{ ...slot, childId: 4, figureIds: [], end: 5 }]))
		).toBeNull();
	});
});
