import { describe, expect, it } from 'vitest';
import type { MapData, MapFig, MapTone } from './map-view';
import {
	addFigure,
	currentOf,
	figureCount,
	figureIds,
	jumpTo,
	nextFrom,
	saveOutcome,
	walkName,
	stripOf,
	undo,
	walkLook,
	walkPill,
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

describe('walkLook: the map while walking', () => {
	const edges = [
		{ from: C, to: Cr, figures: 2 },
		{ from: Cr, to: O2, figures: 1 },
		{ from: Cr, to: Cr, figures: 1 },
		{ from: O2, to: E, figures: 3 },
		{ from: E, to: C, figures: 1 }
	];

	it('draws walked arrows with their step numbers, the next ones dashed, the rest faded', () => {
		let w = addFigure(start, fig(5), Cr);
		w = addFigure(w, fig(6), O2);
		w = addFigure(w, fig(8), E);
		w = addFigure(w, fig(9), C);
		w = addFigure(w, fig(5), Cr);
		const l = walkLook(w, edges);
		expect(l.current).toBe(Cr);
		expect(l.arrows.get('1:2')).toEqual({ tone: 'walked', badge: '1,5', count: null });
		expect(l.arrows.get('3:4')).toEqual({ tone: 'walked', badge: '3', count: null });
		// Walked wins over next: Cr → O2 was walked as step 2.
		expect(l.arrows.get('2:3')).toEqual({ tone: 'walked', badge: '2', count: null });
		expect(l.arrows.get('2:2')).toEqual({ tone: 'next', badge: null, count: null });
		expect(l.loose).toEqual([]);
		expect([...l.next].sort()).toEqual([Cr, O2]);
		expect(l.fit.sort()).toEqual([C, Cr, O2, E]);
	});

	it('fades what does not leave the current position', () => {
		const l = walkLook(start, edges);
		expect(l.arrows.get('1:2')!.tone).toBe('next');
		expect(l.arrows.get('2:3')).toEqual({ tone: 'faded', badge: null, count: null });
		expect(l.arrows.get('4:1')!.tone).toBe('faded');
		expect(l.fit.sort()).toEqual([C, Cr]);
	});

	it('draws a walked figure with no data edge as a loose arrow of its own', () => {
		// A fits-anywhere figure walked at C, ending at O2: no figure runs C → O2.
		const w = addFigure(start, fig(7), O2);
		const l = walkLook(w, edges);
		expect(l.loose).toEqual([
			{ from: C, to: O2, look: { tone: 'loose', badge: '1', count: null } }
		]);
		expect(l.arrows.has('1:3')).toBe(false);
	});

	it('draws nothing for a no-end figure or the jump after it, and fits the path so far while nowhere', () => {
		const w = addFigure(start, fig(5), null);
		const l = walkLook(w, edges);
		expect(l.current).toBeNull();
		expect(l.loose).toEqual([]);
		expect([...l.arrows.values()].every((a) => a.tone === 'faded')).toBe(true);
		expect(l.next.size).toBe(0);
		expect(l.fit).toEqual([C]);
		const j = walkLook(jumpTo(w, O2), edges);
		expect(j.loose).toEqual([]);
		expect(j.arrows.get('3:4')!.tone).toBe('next');
	});

	it('marks the pills: current filled, visited bordered, next strong, the rest at 0.2', () => {
		const w = addFigure(start, fig(5), Cr);
		const l = walkLook(w, edges);
		expect(walkPill(l, Cr)).toEqual({ tone: 'current', opacity: 1 });
		expect(walkPill(l, C)).toEqual({ tone: 'visited', opacity: 1 });
		expect(walkPill(l, O2)).toEqual({ tone: 'plain', opacity: 1 });
		expect(walkPill(l, E)).toEqual({ tone: 'plain', opacity: 0.2 });
		// Nowhere: every pill is a place to carry on from.
		const n = walkLook(addFigure(w, fig(6), null), edges);
		expect(walkPill(n, E)).toEqual({ tone: 'plain', opacity: 1 });
		expect(walkPill(n, Cr)).toEqual({ tone: 'visited', opacity: 1 });
	});
});

describe('stripOf', () => {
	it('is the start, then numbered figures, and a jump as a plain place', () => {
		let w = addFigure(start, fig(5, 'Cradle · From closed'), null);
		w = jumpTo(w, O2);
		w = addFigure(w, fig(6, 'Enchufla'), E);
		expect(stripOf(w)).toEqual([
			{ kind: 'place', at: C },
			{ kind: 'figure', n: 1, label: 'Cradle · From closed' },
			{ kind: 'place', at: O2 },
			{ kind: 'figure', n: 2, label: 'Enchufla' }
		]);
		expect(stripOf(start)).toEqual([]);
	});
});

describe('saveOutcome', () => {
	it('takes the redirect as the routine made', () => {
		expect(
			saveOutcome({ type: 'redirect', status: 303, location: '/salsa/routines/4' }, 'x')
		).toEqual({ ok: true });
	});
	it("gives a refusal's or an error's message, else the fallback", () => {
		expect(
			saveOutcome({ type: 'failure', status: 400, data: { message: 'No name' } }, 'Did not save')
		).toEqual({ ok: false, message: 'No name' });
		expect(saveOutcome({ type: 'failure', status: 400 }, 'Did not save')).toEqual({
			ok: false,
			message: 'Did not save'
		});
		expect(
			saveOutcome({ type: 'error', status: 404, error: { message: 'Figure not found' } }, 'x')
		).toEqual({ ok: false, message: 'Figure not found' });
	});
});

describe('walkName', () => {
	it('keeps a name that fits', () => {
		expect(walkName('Walk from Cerrada')).toBe('Walk from Cerrada');
	});
	it('cuts a long one to the 200 characters a routine name may hold', () => {
		const long = `Walk from ${'x'.repeat(300)}`;
		expect(walkName(long)).toHaveLength(200);
		expect(walkName(long)).toBe(long.slice(0, 200));
	});
	it('never leaves trailing space where it cut', () => {
		const name = `${'a'.repeat(199)} b`;
		expect(walkName(name)).toBe('a'.repeat(199));
	});
});
