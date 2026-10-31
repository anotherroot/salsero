import { describe, expect, it } from 'vitest';
import type { CoverageGroup } from '$lib/routines/coverage';
import { groupHeading, pickNumber, pickedRows, togglePick } from './picks';

const groups: CoverageGroup[] = [
	{
		key: 'none',
		title: 'In no routine',
		rows: [
			{ id: 1, label: 'Exhíbela', routines: [] },
			{ id: 2, label: 'Kentucky · Doble', routines: [] }
		]
	},
	{
		key: 'one',
		title: 'In 1 routine',
		rows: [{ id: 3, label: 'Setenta', routines: [{ id: 7, name: 'Setenta combo' }] }]
	}
];

describe('picks', () => {
	it('toggles keeping order', () => {
		expect(togglePick([5, 2], 9)).toEqual([5, 2, 9]);
		expect(togglePick([5, 2, 9], 2)).toEqual([5, 9]);
	});
	it('numbers by tap order', () => {
		expect(pickNumber([5, 9], 9)).toBe(2);
		expect(pickNumber([5, 9], 3)).toBeNull();
	});
	it('lists picked rows in tap order, skipping unknown ids', () => {
		expect(pickedRows(groups, [3, 1, 99])).toEqual([
			{ id: 3, label: 'Setenta' },
			{ id: 1, label: 'Exhíbela' }
		]);
	});
	it('headings carry the count', () => {
		expect(groupHeading(groups[0])).toBe('In no routine · 2');
	});
});
