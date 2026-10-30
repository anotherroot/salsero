import { describe, expect, it } from 'vitest';
import { fold, shown, type PickGroup } from './model';

const groups: PickGroup[] = [
	{
		title: 'Figures',
		entries: [
			{
				heading: 'Enchufla',
				collapse: true,
				rows: [
					{ key: 'figure:1', value: 1, label: 'Enchufla · Basic', short: 'Basic' },
					{ key: 'figure:2', value: 2, label: 'Enchufla · Doble', short: 'Doble' }
				]
			},
			{
				heading: 'Dile que no',
				collapse: true,
				rows: [{ key: 'figure:3', value: 3, label: 'Dile que no · Basic', short: 'Basic' }]
			},
			{
				heading: 'Exhíbela',
				collapse: true,
				rows: [{ key: 'figure:4', value: 4, label: 'Exhíbela · Basic', short: 'Basic' }]
			}
		]
	},
	{
		title: 'Drills',
		entries: [{ key: 'exercise:1', value: 1, label: 'Spot turns', meta: 'Every 3 days' }]
	},
	{
		title: 'Other videos',
		entries: [
			{
				heading: 'Tuesday class · 27 Oct',
				collapse: false,
				rows: [
					{
						key: 'spot:1',
						value: 1,
						label: '1:01.0–1:20.0',
						keywords: '1:01.0–1:20.0',
						preview: true
					}
				]
			}
		]
	}
];

describe('shown', () => {
	it('shows a one-row figure as its full label, unindented', () => {
		const lines = shown(groups, '');
		expect(lines).toContainEqual({
			kind: 'row',
			row: expect.objectContaining({ key: 'figure:3' }),
			text: 'Dile que no · Basic',
			indent: false
		});
		expect(lines).not.toContainEqual({ kind: 'heading', text: 'Dile que no' });
	});
	it('shows a several-row figure as a heading over its short names', () => {
		expect(shown(groups, '')).toEqual(
			expect.arrayContaining([
				{ kind: 'heading', text: 'Enchufla' },
				{
					kind: 'row',
					row: expect.objectContaining({ key: 'figure:2' }),
					text: 'Doble',
					indent: true
				}
			])
		);
	});
	it('keeps a video heading over a single section', () => {
		expect(shown(groups, '')).toContainEqual({ kind: 'heading', text: 'Tuesday class · 27 Oct' });
	});
	it('a figure name brings all its variations', () => {
		const rows = shown(groups, 'enchufla').filter((l) => l.kind === 'row');
		expect(rows.map((l) => l.row.key)).toEqual(['figure:1', 'figure:2']);
	});
	it('a variation name brings only itself, still under its heading', () => {
		expect(shown(groups, 'doble')).toEqual([
			{ kind: 'group', title: 'Figures' },
			{ kind: 'heading', text: 'Enchufla' },
			{
				kind: 'row',
				row: expect.objectContaining({ key: 'figure:2' }),
				text: 'Doble',
				indent: true
			}
		]);
	});
	it('matches every word anywhere in the heading and label', () => {
		for (const q of ['enchufla doble', 'doble enchufla', 'ENCH  dob']) {
			expect(
				shown(groups, q)
					.filter((l) => l.kind === 'row')
					.map((l) => l.row.key)
			).toEqual(['figure:2']);
		}
	});
	it('ignores accents both ways', () => {
		expect(
			shown(groups, 'exhibela').some((l) => l.kind === 'row' && l.row.label === 'Exhíbela · Basic')
		).toBe(true);
		expect(shown(groups, 'exhíbela').length).toBeGreaterThan(0);
	});
	it('searches keywords but not meta', () => {
		expect(shown(groups, '1:01').some((l) => l.kind === 'row')).toBe(true);
		expect(shown(groups, 'every')).toEqual([]);
	});
	it('drops a group with nothing left and keeps group order', () => {
		expect(shown(groups, 'spot')).toEqual([
			{ kind: 'group', title: 'Drills' },
			expect.objectContaining({ kind: 'row' })
		]);
		expect(
			shown(groups, '')
				.filter((l) => l.kind === 'group')
				.map((l) => l.title)
		).toEqual(['Figures', 'Drills', 'Other videos']);
	});
	it('is empty for no groups or no match', () => {
		expect(shown([], '')).toEqual([]);
		expect(shown(groups, 'zzz')).toEqual([]);
	});
});

describe('fold', () => {
	it('lowercases and strips accents', () => {
		expect(fold('Dile Qué Nó')).toBe('dile que no');
	});
});
