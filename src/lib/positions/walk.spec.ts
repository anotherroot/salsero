import { describe, expect, it } from 'vitest';
import type { MapData, MapFig, MapTone } from './map-view';
import {
	addFigure,
	currentOf,
	figureCount,
	figureIds,
	jumpTo,
	nextFrom,
	undo,
	visited,
	walkedArrows,
	type Walk
} from './walk';

const fig = (id: number, label = `F${id}`): MapFig => ({ id, label, move: label });
const C = 1,
	Cr = 2,
	O2 = 3,
	E = 4;

function data(
	edges: { from: number; to: number; figs: MapFig[] }[],
	extra: Partial<Pick<MapData, 'anyFrom' | 'noStart'>> = {}
): MapData {
	return {
		positions: [C, Cr, O2, E].map((id) => ({ id, name: `P${id}`, tone: 'accent' as MapTone })),
		edges: edges.map((e) => ({ ...e, width: 1, figures: e.figs.length })),
		anyFrom: [],
		noStart: [],
		...extra
	} as unknown as MapData;
}

const start: Walk = { start: C, steps: [] };

describe('the walk', () => {
	it('numbers the figures on each walked arrow', () => {
		let w = addFigure(start, fig(5), Cr);
		w = addFigure(w, fig(6), O2);
		w = addFigure(w, fig(7), C);
		w = addFigure(w, fig(5), Cr);
		const a = walkedArrows(w);
		expect(a.get('1:2')).toEqual({ from: C, to: Cr, numbers: [1, 4] });
		expect(a.get('2:3')!.numbers).toEqual([2]);
		expect(figureIds(w)).toEqual([5, 6, 7, 5]);
		expect(figureCount(w)).toBe(4);
		expect([...visited(w)].sort()).toEqual([1, 2, 3]);
	});

	it('is nowhere after a no-end figure until a jump', () => {
		const w = addFigure(start, fig(5), null);
		expect(currentOf(w)).toBeNull();
		const j = jumpTo(w, O2);
		expect(currentOf(j)).toBe(O2);
		expect(j.steps.at(-1)).toEqual({ kind: 'jump', to: O2 });
		expect(jumpTo(j, Cr)).toBe(j);
		expect(jumpTo(start, Cr)).toBe(start);
	});

	it('undoes a jump on its own, then the figure', () => {
		const j = jumpTo(addFigure(start, fig(5), null), O2);
		const u = undo(j);
		expect(currentOf(u)).toBeNull();
		expect(u.steps).toHaveLength(1);
		expect(undo(u)).toEqual(start);
		expect(undo(start)).toEqual(start);
	});

	it('a jump continues walkedArrows from nothing and a figure after it starts at the jump', () => {
		let w = jumpTo(addFigure(start, fig(5), null), O2);
		w = addFigure(w, fig(6), E);
		expect(walkedArrows(w).get('3:4')).toEqual({ from: O2, to: E, numbers: [2] });
		expect(walkedArrows(w).size).toBe(1);
	});

	it('a fits-anywhere figure is walked under A:E without a data edge', () => {
		const w = addFigure(start, fig(9), E);
		expect(walkedArrows(w).get('1:4')!.numbers).toEqual([1]);
	});
});

describe('nextFrom', () => {
	it('puts the stay first among equals, Anywhere last, one fitsAnywhere per end', () => {
		const d = data(
			[
				{ from: C, to: Cr, figs: [fig(1)] },
				{ from: C, to: C, figs: [fig(2)] },
				{ from: C, to: O2, figs: [fig(3), fig(4)] },
				{ from: Cr, to: O2, figs: [fig(8)] },
				{ from: Cr, to: C, figs: [fig(18)] },
				{ from: Cr, to: Cr, figs: [fig(19)] }
			],
			{
				anyFrom: [{ from: C, figs: [fig(5)] }],
				noStart: [
					{ fig: fig(6), ends: [Cr, O2] },
					{ fig: fig(7), ends: [] }
				]
			}
		);
		const n = nextFrom(d, C);
		expect(n.groups.map((g) => [g.to, g.stays])).toEqual([
			[O2, false],
			[C, true],
			[Cr, false],
			[null, false]
		]);
		// the stay at Cr sorts before C even though C's name is first
		expect(nextFrom(d, Cr).groups.map((g) => [g.to, g.stays])).toEqual([
			[Cr, true],
			[C, false],
			[O2, false]
		]);
		expect(n.fitsAnywhere.map((f) => [f.fig.id, f.to])).toEqual([
			[6, Cr],
			[6, O2],
			[7, null]
		]);
	});

	it('has no Anywhere group without anyFrom', () => {
		expect(nextFrom(data([]), C).groups).toEqual([]);
	});
});
