import { describe, expect, it } from 'vitest';
import { MOVES_SEGMENTS, segmentOf } from './segment';

describe('segmentOf', () => {
	it('names the segment of the two Moves lists', () => {
		expect(segmentOf('/[dance]/figures')).toBe('figures');
		expect(segmentOf('/[dance]/routines')).toBe('routines');
	});

	it('is null for anything else, the pushed Moves screens included', () => {
		expect(segmentOf('/[dance]/figures/[id]')).toBeNull();
		expect(segmentOf('/[dance]/coverage')).toBeNull();
		expect(segmentOf('/[dance]/positions')).toBeNull();
		expect(segmentOf(null)).toBeNull();
	});
});

describe('MOVES_SEGMENTS', () => {
	it('is Figures, then Routines', () => {
		expect(MOVES_SEGMENTS.map((s) => s.label)).toEqual(['Figures', 'Routines']);
		expect(MOVES_SEGMENTS.map((s) => s.value)).toEqual(['figures', 'routines']);
	});
});
