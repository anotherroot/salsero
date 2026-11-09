import { describe, expect, it } from 'vitest';
import { refsOf, resolveRefs } from './refs';

describe('refs', () => {
	it('finds every {ref} in a payload, at any depth', () => {
		expect(refsOf({ section_id: { ref: 4 }, figure_id: 9, slots: [{ ref: 2 }, 7] }).sort()).toEqual(
			[2, 4]
		);
		expect(refsOf({ name: 'x' })).toEqual([]);
	});
	it('ignores objects that are not exactly a ref', () => {
		expect(refsOf({ a: { ref: 4, other: 1 }, b: { ref: '4' } })).toEqual([]);
	});
	it('replaces each ref with the id its action made', () => {
		expect(
			resolveRefs(
				{ section_id: { ref: 4 }, slots: [{ ref: 2 }, 7] },
				new Map([
					[4, { id: 40 }],
					[2, { id: 20 }]
				])
			)
		).toEqual({
			section_id: 40,
			slots: [20, 7]
		});
	});
	it('names the first ref it cannot resolve', () => {
		expect(resolveRefs({ section_id: { ref: 4 } }, new Map())).toEqual({ missing: 4 });
	});
});

describe('a ref under move', () => {
	it('is the move a new figure was made in', () => {
		expect(
			resolveRefs({ move: { ref: 1 }, name: 'x' }, new Map([[1, { id: 10, moveId: 7 }]]))
		).toEqual({
			move: 7,
			name: 'x'
		});
	});
});
