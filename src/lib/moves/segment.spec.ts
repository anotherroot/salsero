import { describe, expect, it } from 'vitest';
import { MOVES_SEGMENTS, segmentOf } from './segment';

describe('segmentOf', () => {
	it('names the segment of the three Moves lists', () => {
		expect(segmentOf('/[dance]/(moves)/figures')).toBe('figures');
		expect(segmentOf('/[dance]/(moves)/routines')).toBe('routines');
		expect(segmentOf('/[dance]/(moves)/positions')).toBe('positions');
	});

	it('keeps Positions lit under its own pages', () => {
		expect(segmentOf('/[dance]/(moves)/positions/[id]')).toBe('positions');
		expect(segmentOf('/[dance]/(moves)/positions/none')).toBe('positions');
		expect(segmentOf('/[dance]/(moves)/positions/map')).toBe('positions');
	});

	it('is null for anything else, the pushed figure and routine screens included', () => {
		expect(segmentOf('/[dance]/(moves)/figures/[id]')).toBeNull();
		expect(segmentOf('/[dance]/(moves)/routines/[id]')).toBeNull();
		expect(segmentOf('/[dance]/(moves)/coverage')).toBeNull();
		expect(segmentOf('/[dance]/(moves)/positionsx')).toBeNull();
		expect(segmentOf(null)).toBeNull();
	});
});

describe('MOVES_SEGMENTS', () => {
	it('is Figures, Routines, then Positions', () => {
		expect(MOVES_SEGMENTS.map((s) => s.label)).toEqual(['Figures', 'Routines', 'Positions']);
		expect(MOVES_SEGMENTS.map((s) => s.value)).toEqual(['figures', 'routines', 'positions']);
	});
});
