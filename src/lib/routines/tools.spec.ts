import { describe, expect, it } from 'vitest';
import { openTools } from './tools';

describe('openTools: the open slot’s toolbar', () => {
	it('an embedded routine: Before and After only', () => {
		expect(openTools({ isRoutine: true, length: null })).toEqual(['before', 'after']);
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
