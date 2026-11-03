import { describe, expect, it } from 'vitest';
import { groupCookie, groupLabel, leavesGroupMode, returnPath } from './mode';

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
