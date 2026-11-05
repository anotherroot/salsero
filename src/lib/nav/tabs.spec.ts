import { describe, expect, it } from 'vitest';
import { rootsOf, showsTabs, tabFor, tapKind, TABS } from './tabs';

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
			'/[dance]/(today)',
			'/[dance]/(moves)/figures',
			'/[dance]/(moves)/routines',
			'/[dance]/lessons',
			'/[dance]/songs',
			'/[dance]/(moves)/figures/[id]',
			'/[dance]/(moves)/routines/[id]',
			'/[dance]/lessons/[id]',
			'/[dance]/groups',
			'/[dance]/groups/[id]',
			'/[dance]/songs/[id]',
			'/[dance]/(today)/exercises/[id]',
			'/[dance]/(moves)/positions',
			'/[dance]/(moves)/coverage'
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

	it('opens Moves on Figures, by its route id in the (moves) group', () => {
		expect(TABS.find((t) => t.id === 'moves')!.path).toBe('/[dance]/(moves)/figures');
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

describe('tapKind', () => {
	const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

	it('lets a modified or non-primary click be the browser’s', () => {
		expect(tapKind({ ...click, metaKey: true }, false)).toBe('pass');
		expect(tapKind({ ...click, ctrlKey: true }, true)).toBe('pass');
		expect(tapKind({ ...click, shiftKey: true }, false)).toBe('pass');
		expect(tapKind({ ...click, altKey: true }, true)).toBe('pass');
		expect(tapKind({ ...click, button: 1 }, true)).toBe('pass');
	});

	it('goes to the tab, or scrolls the lit list to the top', () => {
		expect(tapKind(click, false)).toBe('tab');
		expect(tapKind(click, true)).toBe('top');
	});
});
