import { describe, expect, it } from 'vitest';
import { shadow, swapToMine } from './shadow';

const rows = [
	{ id: 1, gene: 'a' },
	{ id: 2, gene: 'b' },
	{ id: 3, gene: null }
];

describe('shadow', () => {
	it('drops every row whose gene has a member of yours', () => {
		expect(shadow(rows, new Map([['b', 20]]))).toEqual([rows[0], rows[2]]);
	});
	it('keeps everything when you have none', () => {
		expect(shadow(rows, new Map())).toEqual(rows);
	});
});

describe('swapToMine', () => {
	it('marks each row with your member, or null', () => {
		expect(swapToMine(rows, new Map([['b', 20]]))).toEqual([
			{ id: 1, gene: 'a', mineId: null },
			{ id: 2, gene: 'b', mineId: 20 },
			{ id: 3, gene: null, mineId: null }
		]);
	});
});
