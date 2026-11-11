import { describe, expect, it } from 'vitest';
import { openTools } from './tools';

describe('openTools: the open slot’s toolbar', () => {
	it('a figure with a set length and room for an alternative', () => {
		expect(
			openTools({ isRoutine: false, length: { figureId: 1, n: 4 }, canAddAlternative: true })
		).toEqual(['length', 'alternative', 'before', 'after']);
	});
	it('a figure with its own length', () => {
		expect(openTools({ isRoutine: false, length: null, canAddAlternative: true })).toEqual([
			'alternative',
			'before',
			'after'
		]);
	});
	it('an embedded routine: Before and After only', () => {
		expect(openTools({ isRoutine: true, length: null, canAddAlternative: false })).toEqual([
			'before',
			'after'
		]);
	});
});
