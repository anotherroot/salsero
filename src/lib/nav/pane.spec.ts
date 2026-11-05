import { describe, expect, it } from 'vitest';
import { inList, listOf, LIST_HOME, paneBack } from './pane';

describe('listOf', () => {
	it('names the list a route belongs to, and whether an item is open', () => {
		expect(listOf('/[dance]/songs')).toEqual({ list: 'songs', open: false });
		expect(listOf('/[dance]/songs/[id]')).toEqual({ list: 'songs', open: true });
	});

	it('has no list for a page of its own, or a list not yet in a pane', () => {
		expect(listOf('/[dance]/songs/[id]/grid')).toBeNull();
		expect(listOf('/[dance]/lessons')).toBeNull();
		expect(listOf(null)).toBeNull();
	});
});

describe('paneBack', () => {
	it('gives no back to an item opened from its own list', () => {
		expect(paneBack('/salsa/songs', 'songs', 'salsa')).toBe(false);
		// another song was open beside the list
		expect(paneBack('/salsa/songs/4', 'songs', 'salsa')).toBe(false);
	});

	it('gives a back to an item opened from anywhere else', () => {
		expect(paneBack('/salsa/groups/3', 'songs', 'salsa')).toBe(true);
		// a prefix is not "under": the segment must end
		expect(paneBack('/salsa/songsx', 'songs', 'salsa')).toBe(true);
		// the other dance's list is not this one
		expect(paneBack('/bachata/songs', 'songs', 'salsa')).toBe(true);
	});

	it('gives no back after a reload or a direct link: the list is beside it', () => {
		expect(paneBack(null, 'songs', 'salsa')).toBe(false);
	});
});

describe('the Moves lists', () => {
	it('names the list of each Moves route', () => {
		const m = (r: string) => listOf(`/[dance]/(moves)/${r}`);
		expect(m('figures')).toEqual({ list: 'figures', open: false });
		expect(m('routines')).toEqual({ list: 'routines', open: false });
		expect(m('positions')).toEqual({ list: 'positions', open: false });
		for (const r of ['figures/[id]', 'moves/[id]', 'coverage'])
			expect(m(r)).toEqual({ list: 'figures', open: true });
		expect(m('routines/[id]')).toEqual({ list: 'routines', open: true });
		for (const r of ['positions/[id]', 'positions/none', 'positions/map'])
			expect(m(r)).toEqual({ list: 'positions', open: true });
	});

	it('paneBack by list', () => {
		expect(paneBack('/salsa/figures', 'figures', 'salsa')).toBe(false);
		expect(paneBack('/salsa/routines/5', 'figures', 'salsa')).toBe(true);
		expect(paneBack('/salsa/positions', 'positions', 'salsa')).toBe(false);
		expect(paneBack('/salsa/positions/map', 'positions', 'salsa')).toBe(false);
		expect(paneBack('/salsa/figuresx', 'figures', 'salsa')).toBe(true);
	});

	it('under always gives a back, even with no opener', () => {
		expect(paneBack(null, 'figures', 'salsa', true)).toBe(true);
		expect(paneBack('/salsa/figures', 'figures', 'salsa', true)).toBe(true);
	});

	it('inList is by whole segment', () => {
		expect(inList('/salsa/figures', 'figures', 'salsa')).toBe(true);
		expect(inList('/salsa/figures/3', 'figures', 'salsa')).toBe(true);
		expect(inList('/salsa/figuresx', 'figures', 'salsa')).toBe(false);
	});

	// Plan 2: Today's root is the dance itself; a whole-dance prefix is not "under" it.
	it('a list whose root is the dance does not own the whole dance', () => {
		const home = LIST_HOME as Record<string, { root: string; items: string[] }>;
		home.today = { root: '', items: ['/exercises'] };
		try {
			expect(inList('/salsa', 'today' as never, 'salsa')).toBe(true);
			expect(inList('/salsa/exercises/4', 'today' as never, 'salsa')).toBe(true);
			expect(inList('/salsa/figures/4', 'today' as never, 'salsa')).toBe(false);
			expect(inList('/salsa/exercisesx', 'today' as never, 'salsa')).toBe(false);
		} finally {
			delete home.today;
		}
	});
});

describe('the figures list owns the move and Coverage pages', () => {
	it('gives no back from them', () => {
		expect(paneBack('/salsa/moves/3', 'figures', 'salsa')).toBe(false);
		expect(paneBack('/salsa/coverage', 'figures', 'salsa')).toBe(false);
		expect(paneBack('/salsa/routines/5', 'figures', 'salsa')).toBe(true);
		expect(paneBack('/salsa/movesx/3', 'figures', 'salsa')).toBe(true);
	});
});
