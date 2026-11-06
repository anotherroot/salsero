import { describe, expect, it } from 'vitest';
import { menuLabel, orderMenu, type MenuItem } from './menu';

const item = (key: string, danger = false): MenuItem => ({ key, icon: 'clock', label: key, danger });

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
