import { describe, expect, it } from 'vitest';
import { inHome, inList, listOf, openIdOf, paneBack } from './pane';

describe('listOf', () => {
	it('names the list a route belongs to, and whether an item is open', () => {
		expect(listOf('/[dance]/songs')).toEqual({ list: 'songs', open: false });
		expect(listOf('/[dance]/songs/[id]')).toEqual({ list: 'songs', open: true });
	});

	it('has no list for a page of its own, or a list not yet in a pane', () => {
		expect(listOf('/[dance]/songs/[id]/grid')).toBeNull();
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

	// Today's root is the dance itself; a whole-dance prefix is not "under" it.
	it('a home whose root is the dance does not own the whole dance', () => {
		const today = { root: '', items: ['/exercises'] };
		expect(inHome('/salsa', today, 'salsa')).toBe(true);
		expect(inHome('/salsa/exercises/4', today, 'salsa')).toBe(true);
		expect(inHome('/salsa/figures/4', today, 'salsa')).toBe(false);
		expect(inHome('/salsa/exercisesx', today, 'salsa')).toBe(false);
		// The real entry: Today's list.
		expect(inList('/salsa', 'today', 'salsa')).toBe(true);
		expect(inList('/salsa/exercises/4', 'today', 'salsa')).toBe(true);
		expect(inList('/salsa/figures/4', 'today', 'salsa')).toBe(false);
		expect(inList('/salsa/exercisesx', 'today', 'salsa')).toBe(false);
		expect(inList('/bachata', 'today', 'salsa')).toBe(false);
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

describe('Today', () => {
	it('is a list with the open exercise beside it', () => {
		expect(listOf('/[dance]/(today)')).toEqual({ list: 'today', open: false });
		expect(listOf('/[dance]/(today)/exercises/[id]')).toEqual({ list: 'today', open: true });
		// No longer a route id: Today's page is in the (today) group.
		expect(listOf('/[dance]')).toBeNull();
	});

	it('gives no back to an exercise opened from Today', () => {
		expect(paneBack('/salsa', 'today', 'salsa')).toBe(false);
		// another exercise was open beside the list
		expect(paneBack('/salsa/exercises/4', 'today', 'salsa')).toBe(false);
		expect(paneBack(null, 'today', 'salsa')).toBe(false);
	});

	it('gives a back to an exercise opened from a figure or a lesson', () => {
		expect(paneBack('/salsa/figures/3', 'today', 'salsa')).toBe(true);
		expect(paneBack('/salsa/lessons/2', 'today', 'salsa')).toBe(true);
	});
});

describe('Lessons and Groups', () => {
	it('listOf names their routes; sub-pages of a group are under', () => {
		expect(listOf('/[dance]/lessons')).toEqual({ list: 'lessons', open: false });
		expect(listOf('/[dance]/lessons/[id]')).toEqual({ list: 'lessons', open: true });
		expect(listOf('/[dance]/groups')).toEqual({ list: 'groups', open: false });
		expect(listOf('/[dance]/groups/[id]')).toEqual({ list: 'groups', open: true });
		for (const r of ['people', 'storage', 'deleted', 'history/[kind]/[rootId]']) {
			expect(listOf(`/[dance]/groups/[id]/${r}`)).toEqual({
				list: 'groups',
				open: true,
				under: true
			});
		}
	});

	it('paneBack follows the list the opener is in', () => {
		expect(paneBack('/salsa/lessons', 'lessons', 'salsa')).toBe(false);
		expect(paneBack('/salsa/lessons/4', 'lessons', 'salsa')).toBe(false);
		expect(paneBack('/salsa/groups/3', 'lessons', 'salsa')).toBe(true);
		expect(paneBack('/salsa/groups/3', 'groups', 'salsa', true)).toBe(true);
		expect(paneBack(null, 'groups', 'salsa', true)).toBe(true);
		expect(paneBack('/salsa/groups/3/people', 'groups', 'salsa')).toBe(false);
		expect(paneBack('/salsa/lessonsx', 'lessons', 'salsa')).toBe(true);
	});

	it('openIdOf is the row a path keeps lit', () => {
		expect(openIdOf('/salsa/lessons/5', 'lessons', 'salsa')).toBe(5);
		expect(openIdOf('/salsa/groups/3/people', 'groups', 'salsa')).toBe(3);
		expect(openIdOf('/salsa/groups/3/history/lesson/9', 'groups', 'salsa')).toBe(3);
		expect(openIdOf('/salsa/lessons', 'lessons', 'salsa')).toBeNull();
		expect(openIdOf('/salsa/lessons/x', 'lessons', 'salsa')).toBeNull();
		expect(openIdOf('/salsa/groups/3', 'lessons', 'salsa')).toBeNull();
		expect(openIdOf('/salsa/lessons/5x', 'lessons', 'salsa')).toBeNull();
		expect(openIdOf('/salsa/lessonsx/5', 'lessons', 'salsa')).toBeNull();
		expect(openIdOf('/bachata/lessons/5', 'lessons', 'salsa')).toBeNull();
	});
});
