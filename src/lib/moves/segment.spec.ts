import { describe, expect, it } from 'vitest';
import { MOVES_SEGMENTS, segmentOf } from './segment';

describe('segmentOf', () => {
	it('names the segment of the three Moves lists', () => {
		expect(segmentOf('/[dance]/figures')).toBe('figures');
		expect(segmentOf('/[dance]/routines')).toBe('routines');
		expect(segmentOf('/[dance]/positions')).toBe('positions');
	});

	it('keeps Positions lit under its own pages', () => {
		expect(segmentOf('/[dance]/positions/[id]')).toBe('positions');
		expect(segmentOf('/[dance]/positions/none')).toBe('positions');
		expect(segmentOf('/[dance]/positions/map')).toBe('positions');
	});

	it('is null for anything else, the pushed figure and routine screens included', () => {
		expect(segmentOf('/[dance]/figures/[id]')).toBeNull();
		expect(segmentOf('/[dance]/routines/[id]')).toBeNull();
		expect(segmentOf('/[dance]/coverage')).toBeNull();
		expect(segmentOf('/[dance]/positionsx')).toBeNull();
		expect(segmentOf(null)).toBeNull();
	});
});

describe('MOVES_SEGMENTS', () => {
	it('is Figures, Routines, then Positions', () => {
		expect(MOVES_SEGMENTS.map((s) => s.label)).toEqual(['Figures', 'Routines', 'Positions']);
		expect(MOVES_SEGMENTS.map((s) => s.value)).toEqual(['figures', 'routines', 'positions']);
	});
});
