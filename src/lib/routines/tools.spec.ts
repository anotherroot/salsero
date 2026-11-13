import { describe, expect, it } from 'vitest';
import { openTools } from './tools';

describe('openTools: the open slot’s toolbar (spec 2026-11-12)', () => {
	it('a section or routine: Open, Unpack, Before, After', () => {
		expect(openTools({ isRoutine: true, length: null })).toEqual([
			'open',
			'unpack',
			'before',
			'after'
		]);
	});

	it('a figure starts with Open, then its length and end when it has them', () => {
		expect(
			openTools({ isRoutine: false, length: { figureId: 1, n: 4 }, end: { state: 'open' } })
		).toEqual(['open', 'length', 'end', 'before', 'after']);
		expect(openTools({ isRoutine: false, length: null })).toEqual(['open', 'before', 'after']);
	});
});

describe('openTools: the end cell (spec 2026-11-11, slot end)', () => {
	const row = { isRoutine: false, length: { figureId: 1, n: 4 } };
	it('is not there when nothing can be chosen', () => {
		expect(openTools({ ...row, end: { state: 'decided' } })).not.toContain('end');
		expect(openTools({ ...row, end: { state: 'single' } })).not.toContain('end');
		expect(openTools({ ...row, end: null })).not.toContain('end');
	});
});
