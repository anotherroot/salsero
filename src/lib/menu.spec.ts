import { withLocale } from '$lib/i18n/current';
import { describe, expect, it } from 'vitest';
import { menuLabel, offlineMenu, orderMenu, type MenuItem } from './menu';

const item = (key: string, danger = false): MenuItem => ({
	key,
	icon: 'clock',
	label: key,
	danger
});

describe('orderMenu', () => {
	it('puts the page’s own first, the copy actions next, and every danger last', () => {
		const own = [item('history'), item('delete', true), item('select')];
		const copies = [item('copy'), item('drop', true)];
		expect(orderMenu(own, copies).map((i) => i.key)).toEqual([
			'history',
			'select',
			'copy',
			'drop',
			'delete'
		]);
	});

	it('is empty with nothing to offer', () => {
		expect(orderMenu([], [])).toEqual([]);
	});
});

describe('menuLabel', () => {
	it('names each kind’s menu', () => {
		expect(menuLabel('figure')).toBe('Figure menu');
		expect(menuLabel('position')).toBe('Position menu');
		expect(menuLabel('routine')).toBe('Routine menu');
		expect(menuLabel('drill')).toBe('Drill menu');
		expect(menuLabel('song')).toBe('Song menu');
		expect(menuLabel('lesson')).toBe('Lesson menu');
	});
});

describe('menuLabel in Slovenian', () => {
	it('names the kind in the genitive', () => {
		const kinds = ['figure', 'position', 'routine', 'drill', 'song', 'lesson'] as const;
		expect(withLocale('sl', () => kinds.map(menuLabel))).toEqual([
			'Meni različice',
			'Meni položaja',
			'Meni kombinacije',
			'Meni vaje',
			'Meni skladbe',
			'Meni lekcije'
		]);
	});
});

describe('offlineMenu', () => {
	const items: MenuItem[] = [
		{ key: 'edit', icon: 'edit', label: 'Edit' },
		{ key: 'copy', icon: 'copy', label: 'Copy to…', network: true }
	];
	it('greys the items that need a connection, offline only, with one note', () => {
		expect(offlineMenu(items, true)).toEqual({
			note: false,
			items: items.map((i) => ({ ...i, disabled: false }))
		});
		const off = offlineMenu(items, false);
		expect(off.note).toBe(true);
		expect(off.items.map((i) => [i.key, i.disabled])).toEqual([
			['edit', false],
			['copy', true]
		]);
		expect(offlineMenu([items[0]], false).note).toBe(false);
	});
});
