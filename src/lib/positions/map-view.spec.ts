import { describe, expect, it } from 'vitest';
import {
	edgeGeometry,
	edgeKey,
	TWINS_HEIGHT,
	TWINS_WIDTH,
	twinsSpot,
	legendTypes,
	litOf,
	styleTone,
	TONE_VAR,
	type MapTone
} from './map-view';

const SALSA = ['salsa', 'son', 'timba', 'other'];
const BACHATA = ['dominican', 'sensual', 'traditional'];

describe('styleTone', () => {
	it('gives each style index its own fixed token, and no type the muted one', () => {
		expect(SALSA.map((s) => styleTone(s, SALSA))).toEqual(['accent', 'done', 'warn', 'muted']);
		expect(BACHATA.map((s) => styleTone(s, BACHATA))).toEqual(['accent', 'done', 'warn']);
		expect(styleTone(null, SALSA)).toBe('muted');
		// A tag the dance no longer has reads as no type.
		expect(styleTone('bogus', SALSA)).toBe('muted');
	});

	it('names a colour token for every tone, never a raw colour', () => {
		for (const tone of ['accent', 'done', 'warn', 'muted'] as MapTone[]) {
			expect(TONE_VAR[tone]).toBe(`var(--color-${tone})`);
		}
	});
});

describe('legendTypes', () => {
	const labels = { salsa: 'Salsa', son: 'Son', timba: 'Timba', other: 'Other' };
	it("lists the dance's types in order, each with its tone", () => {
		expect(legendTypes(SALSA, labels, true)).toEqual([
			{ key: 'salsa', label: 'Salsa', tone: 'accent' },
			{ key: 'son', label: 'Son', tone: 'done' },
			{ key: 'timba', label: 'Timba', tone: 'warn' },
			{ key: 'other', label: 'Other', tone: 'muted' }
		]);
	});
	it('adds Other for untyped positions when the dance has no Other of its own', () => {
		const b = { dominican: 'Dominican', sensual: 'Sensual', traditional: 'Traditional' };
		expect(legendTypes(BACHATA, b, false).map((t) => t.label)).toEqual([
			'Dominican',
			'Sensual',
			'Traditional'
		]);
		expect(legendTypes(BACHATA, b, true).at(-1)).toEqual({
			key: 'none',
			label: 'Other',
			tone: 'muted'
		});
	});
});

describe('litOf', () => {
	const edges = [
		{ from: 1, to: 2 },
		{ from: 2, to: 3 },
		{ from: 3, to: 1 },
		{ from: 4, to: 4 },
		{ from: 5, to: 6 }
	];
	it('lights nothing with nothing selected', () => {
		const l = litOf(edges, null);
		expect([...l.nodes]).toEqual([]);
		expect([...l.edges]).toEqual([]);
	});
	it('lights the figures in and out of the selected position, and the positions at their ends', () => {
		const l = litOf(edges, 2);
		expect([...l.edges].sort()).toEqual(['1:2', '2:3']);
		expect([...l.nodes].sort()).toEqual([1, 2, 3]);
	});
	it('lights a loop once, and a position with no figures alone', () => {
		const l = litOf(edges, 4);
		expect([...l.edges]).toEqual(['4:4']);
		expect([...l.nodes]).toEqual([4]);
		expect([...litOf(edges, 9).nodes]).toEqual([9]);
	});
	it('keys an edge by its direction', () => {
		expect(edgeKey({ from: 5, to: 6 })).toBe('5:6');
		expect(edgeKey({ from: 6, to: 5 })).not.toBe(edgeKey({ from: 5, to: 6 }));
	});
});

describe('edgeGeometry', () => {
	const a = { x: 100, y: 100, r: 20 };
	const b = { x: 300, y: 100, r: 30 };
	/** The numbers of a path, in order. */
	const nums = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

	it('runs from just outside the start to just outside the end, bowed to one side', () => {
		const g = edgeGeometry(a, b);
		const [sx, sy, cx, cy, ex, ey] = nums(g.d);
		expect(g.d.startsWith('M')).toBe(true);
		expect(g.d).toContain('Q');
		// Leaves the start circle, lands outside the end circle (room for the arrow head).
		expect(Math.hypot(sx - a.x, sy - a.y)).toBeGreaterThan(a.r);
		expect(Math.hypot(ex - b.x, ey - b.y)).toBeGreaterThan(b.r);
		expect(Math.hypot(ex - b.x, ey - b.y)).toBeLessThan(b.r + 10);
		// Between the two, off the straight line.
		expect(cx).toBeGreaterThan(a.x);
		expect(cx).toBeLessThan(b.x);
		expect(cy).not.toBe(100);
		// The count sits on the curve, between the ends.
		expect(g.labelX).toBeGreaterThan(sx);
		expect(g.labelX).toBeLessThan(ex);
		expect(Math.sign(g.labelY - 100)).toBe(Math.sign(cy - 100));
	});

	it('bows the two directions of a pair to opposite sides, so both show', () => {
		const there = nums(edgeGeometry(a, b).d);
		const back = nums(edgeGeometry(b, a).d);
		expect(Math.sign(there[3] - 100)).toBe(-Math.sign(back[3] - 100));
	});

	it('draws a loop as a curl beside its own circle', () => {
		const g = edgeGeometry(a, a);
		expect(g.d).toContain('C');
		const [sx, sy, , , , , ex, ey] = nums(g.d);
		expect(Math.hypot(sx - a.x, sy - a.y)).toBeGreaterThanOrEqual(a.r);
		expect(Math.hypot(ex - a.x, ey - a.y)).toBeGreaterThanOrEqual(a.r);
		expect(g.labelY).toBeLessThan(a.y - a.r);
	});

	it('is the same for the same input', () => {
		expect(edgeGeometry(a, b)).toEqual(edgeGeometry(a, b));
	});

	it('survives two circles at one spot', () => {
		const g = edgeGeometry({ x: 50, y: 50, r: 10 }, { x: 50, y: 50, r: 10 }, false);
		expect(nums(g.d).every(Number.isFinite)).toBe(true);
	});
});

describe('twinsSpot', () => {
	it('sits left of the circle, level with its top', () => {
		expect(twinsSpot({ x: 200, y: 100, r: 20 })).toEqual({ x: 177, y: 80, anchor: 'end' });
	});
	it('moves to the right side when the left would leave the frame', () => {
		const s = twinsSpot({ x: 30, y: 100, r: 20 });
		expect(s).toEqual({ x: 53, y: 80, anchor: 'start' });
	});
	it('stays below the frame’s top', () => {
		expect(twinsSpot({ x: 200, y: 18, r: 14 }).y).toBeGreaterThanOrEqual(TWINS_HEIGHT / 2 + 1);
	});
	it('keeps the word inside the frame on the left', () => {
		for (const x of [18, 25, 40, 55, 60, 80]) {
			const s = twinsSpot({ x, y: 100, r: 14 });
			const left = s.anchor === 'end' ? s.x - TWINS_WIDTH : s.x;
			expect(left).toBeGreaterThanOrEqual(0);
		}
	});
});
