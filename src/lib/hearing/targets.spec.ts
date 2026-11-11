import { describe, expect, it } from 'vitest';
import { isTargetId, parseOwnCounts, targetPositions, targetsFor } from './targets';

describe('targetPositions', () => {
	it('gives the counts in the eight each target listens for', () => {
		expect(targetPositions('every', null)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
		expect(targetPositions('one', null)).toEqual([1]);
		expect(targetPositions('ones', null)).toEqual([1, 5]);
		expect(targetPositions('odd', null)).toEqual([1, 3, 5, 7]);
		expect(targetPositions('fourEight', null)).toEqual([4, 8]);
	});

	it('gives the clave its hits, 2-3 when none is picked', () => {
		expect(targetPositions('clave', '3-2')).toEqual([1, 2.5, 4, 6, 7]);
		expect(targetPositions('clave', null)).toEqual([2, 3, 5, 6.5, 8]);
	});
});

describe('targetsFor', () => {
	it('offers the clave only to a dance that has one', () => {
		expect(targetsFor({ clave: true })).toEqual([
			'one',
			'every',
			'ones',
			'odd',
			'fourEight',
			'clave',
			'own'
		]);
		expect(targetsFor({ clave: false })).toEqual([
			'one',
			'every',
			'ones',
			'odd',
			'fourEight',
			'own'
		]);
	});
});

describe('isTargetId', () => {
	it('knows the targets and nothing else', () => {
		expect(isTargetId('one')).toBe(true);
		expect(isTargetId('two')).toBe(false);
		expect(isTargetId(null)).toBe(false);
	});
});

describe('your own counts', () => {
	it('listens for the counts picked, in order, each once', () => {
		expect(targetPositions('own', null, [7, 3, 6, 3])).toEqual([3, 6, 7]);
		expect(targetPositions('own', null, [0, 9, 4])).toEqual([4]);
	});

	it('is offered in every dance, last', () => {
		expect(targetsFor({ clave: true }).at(-1)).toBe('own');
		expect(targetsFor({ clave: false }).at(-1)).toBe('own');
	});
});

describe('parseOwnCounts', () => {
	it('reads stored counts, and falls back to the 3', () => {
		expect(parseOwnCounts('3,6,7')).toEqual([3, 6, 7]);
		expect(parseOwnCounts('nonsense')).toEqual([3]);
		expect(parseOwnCounts(null)).toEqual([3]);
		expect(parseOwnCounts('')).toEqual([3]);
	});
});
