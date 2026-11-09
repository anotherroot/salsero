import { describe, expect, it } from 'vitest';
import { mixGroups, newestFirst } from './mix';

const tue = { id: 5, name: 'Tue' };
const wed = { id: 6, name: 'Wed' };
const r = (id: number, createdAt: number) => ({ id, createdAt });

describe('mixGroups', () => {
	it('mixes the groups’ rows in by the order, each marked with its group', () => {
		const out = mixGroups(
			[r(1, 30), r(2, 10)],
			[
				{ team: tue, rows: [r(7, 20)] },
				{ team: wed, rows: [r(8, 40)] }
			],
			newestFirst
		);
		expect(out.map((x) => [x.id, x.team?.name ?? null])).toEqual([
			[8, 'Wed'],
			[1, null],
			[7, 'Tue'],
			[2, null]
		]);
	});
	it('keeps the person’s first among equals', () => {
		const out = mixGroups([{ n: 'a', k: 1 }], [{ team: tue, rows: [{ n: 'a', k: 2 }] }], (x, y) =>
			x.n.localeCompare(y.n)
		);
		expect(out.map((x) => x.k)).toEqual([1, 2]);
	});
	it('nothing of a group: the person’s own, unmarked', () => {
		expect(mixGroups([r(1, 1)], [], newestFirst)).toEqual([{ id: 1, createdAt: 1, team: null }]);
	});
});
