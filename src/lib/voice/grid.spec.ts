import { describe, expect, it } from 'vitest';
import type { CountPattern } from '$lib/labels';
import { ownVoiceSummary, tempoState } from './grid';

const k = (pattern: CountPattern, bpm: number, phrase: 'a' | 'b', id = 1) => ({
	id,
	pattern,
	bpm,
	phrase
});

describe('tempoState', () => {
	it('is none, half or done', () => {
		expect(tempoState([], 'salsa', 120)).toEqual({ state: 'none' });
		expect(tempoState([k('salsa', 164, 'a')], 'salsa', 164)).toEqual({ state: 'half', half: 'a' });
		expect(tempoState([k('salsa', 120, 'a'), k('salsa', 120, 'b')], 'salsa', 120)).toEqual({
			state: 'done'
		});
		expect(tempoState([k('son', 120, 'a'), k('son', 120, 'b')], 'salsa', 120)).toEqual({
			state: 'none'
		});
	});
});

describe('ownVoiceSummary', () => {
	it('counts whole tempos only', () => {
		expect(ownVoiceSummary([])).toBe('0 of 21 tempos in your own voice');
		expect(
			ownVoiceSummary([
				k('salsa', 120, 'a'),
				k('salsa', 120, 'b'),
				k('all', 191, 'a'),
				k('all', 191, 'b'),
				k('son', 140, 'a')
			])
		).toBe('2 of 21 tempos in your own voice');
	});
});
