import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { fromClass, routineBadges } from './routines';

describe('routineBadges', () => {
	it('shows breaks as danger', () => {
		expect(routineBadges({ slots: 8, breaks: 2, loops: true })).toEqual([
			{ tone: 'danger', text: '2 breaks' }
		]);
	});

	it('shows only breaks: the loop reads from the start → end line (spec 2026-11-12, L4)', () => {
		expect(routineBadges({ slots: 5, breaks: 1, loops: false })).toEqual([
			{ tone: 'danger', text: '1 break' }
		]);
	});

	it('shows nothing for a routine that loops cleanly', () => {
		expect(routineBadges({ slots: 4, breaks: 0, loops: true })).toEqual([]);
	});

	it('does not call an empty routine "does not loop"', () => {
		expect(routineBadges({ slots: 0, breaks: 0, loops: false })).toEqual([]);
	});
});

describe('fromClass', () => {
	it('says which class a routine is from, for a screen reader', () => {
		expect(fromClass('Tue 3 Nov')).toBe('From class Tue 3 Nov');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('counts breaks in four forms', () => {
		expect(sl(() => routineBadges({ slots: 8, breaks: 2, loops: true }))).toEqual([
			{ tone: 'danger', text: '2 prekinitvi' }
		]);
		expect(sl(() => routineBadges({ slots: 5, breaks: 5, loops: false }))).toEqual([
			{ tone: 'danger', text: '5 prekinitev' }
		]);
	});

	it('says which lesson a routine is from', () => {
		expect(sl(() => fromClass('tor, 3. nov.'))).toBe('Z lekcije tor, 3. nov.');
	});
});
