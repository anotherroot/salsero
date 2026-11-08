import { describe, expect, it } from 'vitest';
import { moveFromQuery } from './move-field';

const moves = [
	{ id: 1, name: 'Tornillo' },
	{ id: 2, name: 'Enchufla' }
];

describe('moveFromQuery', () => {
	it('makes nothing from an empty search', () => {
		expect(moveFromQuery('   ', moves)).toBeNull();
		expect(moveFromQuery('', moves)).toBeNull();
	});
	it('picks a move whose name folds to the same', () => {
		expect(moveFromQuery('tornillo', moves)).toEqual({ groupId: 1 });
		expect(moveFromQuery(' Enchúfla ', moves)).toEqual({ groupId: 2 });
	});
	it('names a new move, trimmed', () => {
		expect(moveFromQuery('  Setenta  ', moves)).toEqual({ newName: 'Setenta' });
	});
	it('cuts a new name at 200 characters, the field limit', () => {
		const long = 'x'.repeat(250);
		expect(moveFromQuery(long, [])).toEqual({ newName: 'x'.repeat(200) });
	});
});
