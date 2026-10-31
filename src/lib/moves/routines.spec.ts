import { describe, expect, it } from 'vitest';
import { plural } from './plural';
import { routineBadges } from './routines';

describe('plural', () => {
	it('picks the word by the count', () => {
		expect(plural(1, 'slot', 'slots')).toBe('1 slot');
		expect(plural(4, 'slot', 'slots')).toBe('4 slots');
		expect(plural(0, 'routine', 'routines')).toBe('0 routines');
	});
});

describe('routineBadges', () => {
	it('shows breaks as danger', () => {
		expect(routineBadges({ slots: 8, breaks: 2, loops: true })).toEqual([
			{ tone: 'danger', text: '2 breaks' }
		]);
	});

	it('adds "does not loop" as warn after the breaks', () => {
		expect(routineBadges({ slots: 5, breaks: 1, loops: false })).toEqual([
			{ tone: 'danger', text: '1 break' },
			{ tone: 'warn', text: 'does not loop' }
		]);
	});

	it('shows nothing for a routine that loops cleanly', () => {
		expect(routineBadges({ slots: 4, breaks: 0, loops: true })).toEqual([]);
	});

	it('does not call an empty routine "does not loop"', () => {
		expect(routineBadges({ slots: 0, breaks: 0, loops: false })).toEqual([]);
	});
});
