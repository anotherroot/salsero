import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { minePath, outsideGroupMode, returnPath, workInRows } from './mode';

describe('group mode, pure', () => {
	it('leaves group mode on Today and its pages', () => {
		expect(outsideGroupMode('/salsa', 'salsa')).toBe(true);
		expect(outsideGroupMode('/salsa/exercises/3', 'salsa')).toBe(true);
		expect(outsideGroupMode('/salsa/figures', 'salsa')).toBe(false);
		expect(outsideGroupMode('/salsa/groups/1', 'salsa')).toBe(false);
	});
	it('returns only to a path in the same dance', () => {
		expect(returnPath('/salsa/routines', 'salsa')).toBe('/salsa/routines');
		expect(returnPath('//evil.example', 'salsa')).toBe('/salsa/figures');
		expect(returnPath('/bachata/figures', 'salsa')).toBe('/salsa/figures');
		expect(returnPath(null, 'salsa')).toBe('/salsa/figures');
	});
});

describe('workInRows', () => {
	const choices = [
		{ teamId: 4, name: 'Tuesday class', role: 'owner' as const, people: 14 },
		{ teamId: 7, name: 'Open floor', role: 'editor' as const, people: 1 }
	];
	it('lists Mine first and marks Mine when no group is current', () => {
		const rows = workInRows(choices, null, '/salsa/lessons');
		expect(rows.map((r) => r.teamId)).toEqual(['mine', 4, 7]);
		expect(rows.map((r) => r.on)).toEqual([true, false, false]);
	});
	it('marks the current group and words the meta', () => {
		const rows = workInRows(choices, 7, '/salsa/lessons');
		expect(rows.map((r) => r.on)).toEqual([false, false, true]);
		expect(rows[1].meta).toBe('Owner · 14 people');
		expect(rows[2].meta).toBe('Editor · 1 person');
		expect(rows[0].name).toBe('Mine');
	});
	it('links each row to the list it was opened on, in that view', () => {
		const rows = workInRows(choices, 4, '/salsa/lessons?in=4&q=x');
		expect(rows.map((r) => r.href)).toEqual([
			'/salsa/lessons?q=x',
			'/salsa/lessons?q=x&in=4',
			'/salsa/lessons?q=x&in=7'
		]);
	});
	it('Mine stays on the tab: its list, or the tab’s first list from a page in it', () => {
		expect(minePath('/salsa/lessons', 'salsa')).toBe('/salsa/lessons');
		expect(minePath('/salsa/lessons/12', 'salsa')).toBe('/salsa/lessons');
		expect(minePath('/salsa/routines', 'salsa')).toBe('/salsa/routines');
		expect(minePath('/salsa/figures/4', 'salsa')).toBe('/salsa/figures');
		expect(minePath('/bachata/songs/3', 'bachata')).toBe('/bachata/songs');
		expect(minePath('/salsa/groups/2', 'salsa')).toBe('/salsa/groups');
		expect(minePath('/settings', 'salsa')).toBe('/salsa');
	});
});

// Catches: the band's group line and the Work in sheet in English for a Slovenian
// editor, or a role or count not in its Slovenian word.
describe('group mode in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	const choices = [
		{ teamId: 4, name: 'Torek', role: 'owner' as const, people: 14 },
		{ teamId: 7, name: 'Sreda', role: 'editor' as const, people: 2 }
	];

	it('labels the group after a "·" and words the rows', () => {
		const rows = sl(() => workInRows(choices, null, '/salsa/lessons'));
		expect(rows.map((r) => [r.name, r.meta])).toEqual([
			['Moje', 'Vaše lastne stvari'],
			['Torek', 'Vodja · 14 oseb'],
			['Sreda', 'Lahko ureja · 2 osebi']
		]);
	});
});
