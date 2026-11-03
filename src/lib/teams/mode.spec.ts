import { describe, expect, it } from 'vitest';
import { groupCookie, groupLabel, leavesGroupMode, returnPath, workInRows } from './mode';

describe('group mode, pure', () => {
	it('names the cookie per dance', () => expect(groupCookie('salsa')).toBe('group_salsa'));
	it('leaves group mode on Today and its pages', () => {
		expect(leavesGroupMode('/salsa', 'salsa')).toBe(true);
		expect(leavesGroupMode('/salsa/exercises/3', 'salsa')).toBe(true);
		expect(leavesGroupMode('/salsa/figures', 'salsa')).toBe(false);
		expect(leavesGroupMode('/salsa/groups/1', 'salsa')).toBe(false);
	});
	it('returns only to a path in the same dance', () => {
		expect(returnPath('/salsa/routines', 'salsa')).toBe('/salsa/routines');
		expect(returnPath('//evil.example', 'salsa')).toBe('/salsa/figures');
		expect(returnPath('/bachata/figures', 'salsa')).toBe('/salsa/figures');
		expect(returnPath(null, 'salsa')).toBe('/salsa/figures');
	});
	it('labels a group', () => expect(groupLabel('Salsa Tuesdays')).toBe('Salsa Tuesdays · group'));
});

describe('workInRows', () => {
	const choices = [
		{ teamId: 4, name: 'Tuesday class', role: 'owner' as const, people: 14 },
		{ teamId: 7, name: 'Open floor', role: 'editor' as const, people: 1 }
	];
	it('lists Mine first and marks Mine when no group is current', () => {
		const rows = workInRows(choices, null);
		expect(rows.map((r) => r.teamId)).toEqual(['mine', 4, 7]);
		expect(rows.map((r) => r.on)).toEqual([true, false, false]);
	});
	it('marks the current group and words the meta', () => {
		const rows = workInRows(choices, 7);
		expect(rows.map((r) => r.on)).toEqual([false, false, true]);
		expect(rows[1].meta).toBe('Owner · 14 people');
		expect(rows[2].meta).toBe('Editor · 1 person');
		expect(rows[0].name).toBe('Mine');
	});
});
