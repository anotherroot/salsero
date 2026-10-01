import { describe, expect, it } from 'vitest';
import { coverage, coverageGroups } from './coverage';
import type { RoutineShape } from './routines';

const opts = (...ids: number[][]): RoutineShape => ({
	slots: ids.map((figureIds) => ({ kind: 'options', figureIds }))
});

const versions = [
	{ id: 1, label: 'Enchufla' },
	{ id: 2, label: 'Enchufla · Doble' },
	{ id: 3, label: 'Dile que no' },
	{ id: 4, label: 'Setenta' }
];

describe('coverage', () => {
	it('counts a base figure and its variation apart', () => {
		const shapes = new Map([[10, opts([1])]]);
		const rows = coverage(versions, shapes, [{ id: 10, name: 'A' }]);
		expect(rows.find((r) => r.id === 1)?.routines).toEqual([{ id: 10, name: 'A' }]);
		expect(rows.find((r) => r.id === 2)?.routines).toEqual([]);
	});

	it('counts every option of a slot', () => {
		const rows = coverage(versions, new Map([[10, opts([1, 2])]]), [{ id: 10, name: 'A' }]);
		expect(rows.filter((r) => r.routines.length === 1).map((r) => r.id)).toEqual([1, 2]);
	});

	it('lists a routine once even when the version fills several of its slots', () => {
		const rows = coverage(versions, new Map([[10, opts([3], [3], [3])]]), [{ id: 10, name: 'A' }]);
		expect(rows.find((r) => r.id === 3)?.routines).toEqual([{ id: 10, name: 'A' }]);
	});

	it('counts a figure inside an embedded routine for both routines', () => {
		const childSlots = [{ kind: 'options' as const, figureIds: [4] }];
		const child: RoutineShape = { slots: childSlots };
		const parent: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [3] },
				{ kind: 'child', routineId: 11, slots: childSlots }
			]
		};
		const rows = coverage(
			versions,
			new Map([
				[10, parent],
				[11, child]
			]),
			[
				{ id: 10, name: 'Friday' },
				{ id: 11, name: 'Combo A' }
			]
		);
		expect(rows.find((r) => r.id === 4)?.routines).toEqual([
			{ id: 11, name: 'Combo A' },
			{ id: 10, name: 'Friday' }
		]);
	});

	it('ignores a shape whose routine is not in the list (archived)', () => {
		const rows = coverage(versions, new Map([[10, opts([1])]]), []);
		expect(rows.every((r) => r.routines.length === 0)).toBe(true);
	});

	it('sorts fewest routines first, then by label', () => {
		const shapes = new Map([
			[10, opts([1], [4])],
			[11, opts([4])]
		]);
		const rows = coverage(versions, shapes, [
			{ id: 10, name: 'A' },
			{ id: 11, name: 'B' }
		]);
		expect(rows.map((r) => r.label)).toEqual([
			'Dile que no',
			'Enchufla · Doble',
			'Enchufla',
			'Setenta'
		]);
	});
});

describe('coverageGroups', () => {
	it('groups none, one, many and leaves empty groups out', () => {
		const row = (id: number, n: number) => ({
			id,
			label: String(id),
			routines: Array.from({ length: n }, (_, i) => ({ id: i, name: String(i) }))
		});
		const groups = coverageGroups([row(1, 0), row(2, 2), row(3, 5)]);
		expect(groups.map((g) => [g.key, g.title, g.rows.map((r) => r.id)])).toEqual([
			['none', 'In no routine', [1]],
			['many', 'In 2+ routines', [2, 3]]
		]);
	});
});
