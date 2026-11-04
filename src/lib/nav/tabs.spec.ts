import { describe, expect, it } from 'vitest';
import { rootsOf, showsTabs, tabFor, TABS } from './tabs';

describe('tabFor', () => {
	it('lights the tab a path belongs to', () => {
		expect(tabFor('/salsa', 'salsa')).toBe('today');
		expect(tabFor('/salsa/figures', 'salsa')).toBe('moves');
		expect(tabFor('/salsa/figures/12', 'salsa')).toBe('moves');
		expect(tabFor('/salsa/moves/12', 'salsa')).toBe('moves');
		expect(tabFor('/salsa/routines/3', 'salsa')).toBe('moves');
		expect(tabFor('/salsa/positions', 'salsa')).toBe('moves');
		expect(tabFor('/salsa/coverage', 'salsa')).toBe('moves');
		expect(tabFor('/salsa/lessons/4', 'salsa')).toBe('lessons');
		expect(tabFor('/salsa/groups/3', 'salsa')).toBe('groups');
		expect(tabFor('/salsa/groups/3/people', 'salsa')).toBe('groups');
		expect(tabFor('/salsa/songs/9', 'salsa')).toBe('music');
		expect(tabFor('/salsa/player', 'salsa')).toBe('music');
		expect(tabFor('/salsa/exercises/4', 'salsa')).toBe('today');
	});

	it('lights nothing outside the dance', () => {
		expect(tabFor('/settings', 'salsa')).toBeNull();
		expect(tabFor('/voice', 'salsa')).toBeNull(); // six characters, like /salsa
		expect(tabFor('/bachata/figures', 'salsa')).toBeNull();
	});
});

describe('showsTabs', () => {
	it('shows the bar on the top-level and the pushed screens inside a dance', () => {
		for (const id of [
			'/[dance]',
			'/[dance]/figures',
			'/[dance]/routines',
			'/[dance]/lessons',
			'/[dance]/songs',
			'/[dance]/figures/[id]',
			'/[dance]/routines/[id]',
			'/[dance]/lessons/[id]',
			'/[dance]/groups',
			'/[dance]/groups/[id]',
			'/[dance]/songs/[id]',
			'/[dance]/exercises/[id]',
			'/[dance]/positions',
			'/[dance]/coverage'
		])
			expect(showsTabs(id)).toBe(true);
	});

	it('hides it on Practice, share and outside a dance', () => {
		for (const id of ['/[dance]/player', '/[dance]/share', '/settings', '/voice', '/login', null])
			expect(showsTabs(id)).toBe(false);
	});
});

describe('TABS', () => {
	it('has four, in order', () => {
		expect(TABS.map((t) => t.label)).toEqual(['Today', 'Moves', 'Lessons', 'Groups', 'Music']);
	});
});

describe('rootsOf', () => {
	it('names the main lists of a tab', () => {
		expect(rootsOf('moves', 'bachata')).toEqual([
			'/bachata/figures',
			'/bachata/routines',
			'/bachata/positions'
		]);
		expect(rootsOf('today', 'salsa')).toEqual(['/salsa']);
		expect(rootsOf('lessons', 'salsa')).toEqual(['/salsa/lessons']);
		expect(rootsOf('groups', 'salsa')).toEqual(['/salsa/groups']);
		expect(rootsOf('music', 'salsa')).toEqual(['/salsa/songs']);
	});
});
