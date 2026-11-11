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

describe('openTools: the end cell (spec 2026-11-11, slot end)', () => {
	const row = { isRoutine: false, length: { figureId: 1, n: 4 }, canAddAlternative: true };
	it('comes after the length when there is an end to choose', () => {
		expect(openTools({ ...row, end: { state: 'chosen' } })).toEqual([
			'length',
			'end',
			'alternative',
			'before',
			'after'
		]);
		expect(openTools({ ...row, end: { state: 'open' } })).toContain('end');
	});
	it('is not there when nothing can be chosen', () => {
		expect(openTools({ ...row, end: { state: 'decided' } })).not.toContain('end');
		expect(openTools({ ...row, end: { state: 'single' } })).not.toContain('end');
		expect(openTools({ ...row, end: null })).not.toContain('end');
	});
});
