import { describe, expect, it } from 'vitest';
import { rowKindOf, tabHrefIn, viewedList, viewParam, withView } from './group-view';

// Catches: a list in a group's view losing `in` on a filter or a tab (back to your own
// list unasked), an action URL whose `?/create` is pushed behind `in` (SvelteKit then
// finds no action), and a bad `in` taken as a team id.
describe('the view parameter', () => {
	it('reads a valid in only', () => {
		expect(viewParam(new URLSearchParams('in=4'))).toBe(4);
		for (const bad of ['in=0', 'in=abc', 'in=-1', 'in=4.5', 'in=12345678901', 'in=', ''])
			expect(viewParam(new URLSearchParams(bad))).toBeNull();
	});

	it('sets and drops in, keeping the rest', () => {
		expect(withView('/salsa/figures?q=adi&style=salsa', 4)).toBe(
			'/salsa/figures?q=adi&style=salsa&in=4'
		);
		expect(withView('/salsa/figures?in=4&q=adi', null)).toBe('/salsa/figures?q=adi');
		expect(withView('/salsa/figures?in=4', 7)).toBe('/salsa/figures?in=7');
		expect(withView('/salsa/figures', null)).toBe('/salsa/figures');
		expect(withView('/salsa/songs#top', 4)).toBe('/salsa/songs?in=4#top');
	});

	it('keeps an action key first', () => {
		expect(withView('/salsa/lessons?/create', 4)).toBe('/salsa/lessons?/create&in=4');
		expect(withView('/salsa/lessons?/create&in=4', null)).toBe('/salsa/lessons?/create');
	});
});

describe('which pages decide by their row', () => {
	it('knows the row routes', () => {
		expect(rowKindOf('/[dance]/lessons/[id]')).toBe('lesson');
		expect(rowKindOf('/[dance]/(moves)/figures/[id]')).toBe('figure');
		expect(rowKindOf('/[dance]/(moves)/routines/[id]')).toBe('routine');
		expect(rowKindOf('/[dance]/(moves)/positions/[id]')).toBe('position');
		expect(rowKindOf('/[dance]/(moves)/moves/[id]')).toBe('move');
		expect(rowKindOf('/[dance]/songs/[id]')).toBe('song');
		expect(rowKindOf('/[dance]/(today)/exercises/[id]')).toBe('drill');
		expect(rowKindOf('/[dance]/groups/[id]')).toBe('group');
		expect(rowKindOf('/[dance]/groups/[id]/history/[kind]/[rootId]')).toBe('group');
		expect(rowKindOf('/[dance]/groups/[id]/people')).toBe('group');
	});

	it('lists and other pages have no row', () => {
		expect(rowKindOf('/[dance]/(moves)/figures')).toBeNull();
		expect(rowKindOf('/[dance]/groups')).toBeNull();
		expect(rowKindOf('/[dance]/songs/imports/[id]')).toBeNull();
		expect(rowKindOf(null)).toBeNull();
	});
});

describe('which lists follow the view', () => {
	it('the content lists do', () => {
		for (const p of [
			'/salsa/figures',
			'/salsa/routines',
			'/salsa/positions',
			'/salsa/positions/map',
			'/salsa/positions/none',
			'/salsa/coverage',
			'/salsa/lessons',
			'/salsa/songs',
			'/salsa/songs/imports/3'
		])
			expect(viewedList(p, 'salsa'), p).toBe(true);
	});

	it('the rest do not', () => {
		for (const p of [
			'/salsa',
			'/salsa/groups',
			'/salsa/you',
			'/salsa/figures/3',
			'/salsa/lessons/3',
			'/settings',
			'/bachata/figures'
		])
			expect(viewedList(p, 'salsa'), p).toBe(false);
	});
});

// Catches: the trail reopening a tab at the address it was left at, `in` and all, so
// your own view lands in a group's list (or a group's view on your own list).
describe('a tab’s target in the current view', () => {
	it('puts the current view on a viewed list, whatever the trail remembered', () => {
		expect(tabHrefIn('/salsa/figures?in=4&q=x', 'salsa', null)).toBe('/salsa/figures?q=x');
		expect(tabHrefIn('/salsa/figures?q=x', 'salsa', 7)).toBe('/salsa/figures?q=x&in=7');
		expect(tabHrefIn('/salsa/figures?in=4', 'salsa', 7)).toBe('/salsa/figures?in=7');
	});
	it('a page of one thing keeps its address: it decides by its row', () => {
		expect(tabHrefIn('/salsa/lessons/12', 'salsa', 7)).toBe('/salsa/lessons/12');
	});
	it('Groups, You and Today never carry in', () => {
		expect(tabHrefIn('/salsa/groups?in=4', 'salsa', 7)).toBe('/salsa/groups');
		expect(tabHrefIn('/salsa', 'salsa', 7)).toBe('/salsa');
	});
	it('no target stays none (the lit tab on its own list)', () => {
		expect(tabHrefIn(null, 'salsa', 7)).toBeNull();
	});
});
