import { describe, expect, it } from 'vitest';
import type { MapData, MapFig, MapTone } from './map-view';
import { figuresShort, pick, positionSheet, stepBack, steppedKey, typingIn } from './map-sheet';

const fig = (id: number, label: string, move = label): MapFig => ({ id, label, move });

function data(
	names: Record<number, string>,
	edges: { from: number; to: number; figs: MapFig[] }[],
	opts: { drawn?: number[]; anyFrom?: { from: number; figs: MapFig[] }[] } = {}
): MapData {
	const drawn = opts.drawn ?? Object.keys(names).map(Number);
	return {
		empty: false,
		layout: {
			width: 0,
			height: 0,
			nodes: drawn.map((id) => ({ id })),
			edges: [],
			tray: { islands: [], unused: [] }
		},
		positions: Object.entries(names).map(([id, name]) => ({
			id: Number(id),
			name,
			styleTag: null,
			tone: 'accent' as MapTone,
			ins: 1,
			outs: 2,
			twinsLine: null,
			ariaLabel: name
		})),
		edges: edges.map((e) => ({ ...e, width: 1, figures: e.figs.length })),
		anyFrom: opts.anyFrom ?? [],
		noStart: [],
		noPosition: 0,
		summary: '',
		types: [],
		mapLabel: '',
		inGroupMode: false
	} as unknown as MapData;
}

describe('figuresShort', () => {
	it('groups a move with several figures as Move xn', () => {
		const figs = [
			fig(1, 'Basic step · A', 'Basic step'),
			fig(2, 'Basic step · B', 'Basic step'),
			fig(3, 'Basic step · C', 'Basic step'),
			fig(4, 'Paso Madrid', 'Paso Madrid'),
			fig(5, 'To Cradle', 'To Cradle')
		];
		expect(figuresShort(figs)).toBe('Basic step ×3, Paso Madrid, To Cradle');
	});
	it('joins moves with ", " so the " · " inside a label stays one figure', () => {
		const figs = [
			fig(1, 'Basic step · A', 'Basic step'),
			fig(2, 'Basic step · B', 'Basic step'),
			fig(3, 'Paso Madrid · Madrid to closed', 'Paso Madrid')
		];
		expect(figuresShort(figs)).toBe('Basic step ×2, Paso Madrid · Madrid to closed');
	});
});

describe('typingIn: Escape from a field is the field’s', () => {
	it('is true in an input, a textarea, a select or an editable element', () => {
		for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT'])
			expect(typingIn({ tagName, isContentEditable: false })).toBe(true);
		expect(typingIn({ tagName: 'DIV', isContentEditable: true })).toBe(true);
	});
	it('is false anywhere else, and with no target', () => {
		expect(typingIn({ tagName: 'BUTTON', isContentEditable: false })).toBe(false);
		expect(typingIn({ tagName: 'a', isContentEditable: false })).toBe(false);
		expect(typingIn(null)).toBe(false);
		expect(typingIn({})).toBe(false);
	});
});

describe('positionSheet', () => {
	const names = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 9: 'Island' };
	const x = fig(10, 'X');
	const d = data(
		names,
		[
			{ from: 1, to: 1, figs: [fig(11, 'Loop')] },
			{ from: 1, to: 2, figs: [x, fig(12, 'Y')] },
			{ from: 1, to: 4, figs: [fig(13, 'Z')] },
			{ from: 1, to: 3, figs: [fig(14, 'W')] },
			{ from: 3, to: 2, figs: [x] },
			{ from: 3, to: 4, figs: [x] }
		],
		{ drawn: [1, 2, 3, 4], anyFrom: [{ from: 1, figs: [fig(15, 'Any')] }] }
	);

	it('orders stepTo by figure count then name and leaves the loop to stays', () => {
		const s = positionSheet(d, 1)!;
		expect(s.stepTo.map((r) => r.name)).toEqual(['B', 'C', 'D']);
		expect(s.stays.map((f) => f.label)).toEqual(['Loop']);
		expect(s.anywhere.map((f) => f.label)).toEqual(['Any']);
		expect(s.stepTo[0].short).toBe('X, Y');
	});

	it('lists the positions with an arrow in, most figures first', () => {
		expect(positionSheet(d, 2)!.from.map((p) => p.name)).toEqual(['A', 'C']);
	});

	it('shows a figure with starts [A,C] and ends [B,D] in each row', () => {
		expect(
			positionSheet(d, 1)!
				.stepTo.filter((r) => r.figs.includes(x))
				.map((r) => r.name)
		).toEqual(['B']);
		expect(positionSheet(d, 3)!.stepTo.map((r) => r.name)).toEqual(['B', 'D']);
		expect(positionSheet(d, 3)!.stepTo.every((r) => r.figs.includes(x))).toBe(true);
	});

	it('nothing leads in (a loop is not an in), nothing leaves (no row, no Anywhere)', () => {
		// A: only its own loop comes back to it.
		expect(positionSheet(d, 1)!.from).toEqual([]);
		// D: two arrows in, nothing out, no loop, no figure without an end.
		const s = positionSheet(d, 4)!;
		expect(s.from.map((p) => p.name)).toEqual(['A', 'C']);
		expect([s.stepTo, s.anywhere, s.stays]).toEqual([[], [], []]);
	});

	it('is null for a position that is not drawn', () => {
		const dd = data(names, [], { drawn: [1, 2, 3, 4] });
		expect(positionSheet(dd, 9)).toBeNull();
	});
});

describe('the step trail', () => {
	const d = data({ 1: 'A', 2: 'B', 3: 'C' }, [{ from: 1, to: 2, figs: [fig(1, 'X')] }]);
	it('steps to a neighbour, picks fresh otherwise, steps back', () => {
		const t = pick({ picked: 1, back: [] }, 2, d);
		expect(t).toEqual({ picked: 2, back: [1] });
		expect(steppedKey(t)).toBe('1:2');
		expect(pick({ picked: 1, back: [] }, 3, d)).toEqual({ picked: 3, back: [] });
		expect(pick({ picked: null, back: [] }, 2, d)).toEqual({ picked: 2, back: [] });
		expect(stepBack(t)).toEqual({ picked: 1, back: [] });
		expect(steppedKey({ picked: 1, back: [] })).toBeNull();
	});
});
