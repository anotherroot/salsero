import { describe, expect, it } from 'vitest';
import type { Graph } from '$lib/graph/graph';
import { coverage, coverageGroups, routinesUsing } from './coverage';
import type { OptionsSlot, RoutineShape } from './routines';

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

describe('routinesUsing', () => {
	const g: Graph = {
		positions: [],
		figures: [
			{ id: 7, starts: [], ends: [], start: 1, length: 8 },
			{ id: 8, starts: [1], ends: [2], start: 1, length: 8 },
			{ id: 9, starts: [], ends: [], start: 1, length: 8 }
		]
	};
	const A = opts([9], [7, 9], [9], [9], [7]);
	const B = opts([7], [9], [9], [9], [9], [9]);
	const C: RoutineShape = {
		slots: [
			{ kind: 'options', figureIds: [9] },
			{ kind: 'child', routineId: 2, slots: B.slots as OptionsSlot[] }
		]
	};
	const shapes = new Map<number, RoutineShape>([
		[1, A],
		[2, B],
		[3, C],
		[4, opts([9])],
		[5, opts([7])],
		[6, opts([8])]
	]);

	it('numbers the slots that call it, once per routine', () => {
		expect(
			routinesUsing(g, 7, shapes, [
				{ id: 1, name: 'Social set A' },
				{ id: 2, name: 'Cubana combo' }
			])
		).toEqual([
			{ id: 2, name: 'Cubana combo', slots: [1], slotCount: 6, loops: expect.any(Boolean) },
			{ id: 1, name: 'Social set A', slots: [2, 5], slotCount: 5, loops: expect.any(Boolean) }
		]);
	});
	it('counts an embedded routine at the embedding slot', () => {
		expect(routinesUsing(g, 7, shapes, [{ id: 3, name: 'C' }])[0].slots).toEqual([2]);
	});
	it('ignores routines not passed in and routines that never call it', () => {
		expect(routinesUsing(g, 7, shapes, [{ id: 4, name: 'Other' }])).toEqual([]);
		expect(routinesUsing(g, 7, shapes, [])).toEqual([]);
	});
	it('says whether the routine loops', () => {
		expect(routinesUsing(g, 7, shapes, [{ id: 5, name: 'L' }])[0].loops).toBe(true);
		expect(routinesUsing(g, 8, shapes, [{ id: 6, name: 'N' }])[0].loops).toBe(false);
	});
});
