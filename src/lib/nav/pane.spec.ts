import { describe, expect, it } from 'vitest';
import { listOf, paneBack } from './pane';

describe('listOf', () => {
	it('names the list a route belongs to, and whether an item is open', () => {
		expect(listOf('/[dance]/songs')).toEqual({ list: 'songs', open: false });
		expect(listOf('/[dance]/songs/[id]')).toEqual({ list: 'songs', open: true });
	});

	it('has no list for a page of its own, or a list not yet in a pane', () => {
		expect(listOf('/[dance]/songs/[id]/grid')).toBeNull();
		expect(listOf('/[dance]/figures')).toBeNull();
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
