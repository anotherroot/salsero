import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	arrowLook,
	edgeGeometry,
	edgeKey,
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

describe('legendTypes in Slovenian', () => {
	it('names each type in Slovenian, an untyped one Drugo', () => {
		const b = { dominican: 'Dominican', sensual: 'Sensual', traditional: 'Traditional' };
		expect(withLocale('sl', () => legendTypes(BACHATA, b, true).map((t) => t.label))).toEqual([
			'Dominikanska',
			'Senzualna',
			'Tradicionalna',
			'Drugo'
		]);
		const s = { salsa: 'Salsa', son: 'Son', timba: 'Timba', other: 'Other' };
		expect(withLocale('sl', () => legendTypes(SALSA, s, true).at(-1)?.label)).toBe('Drugo');
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
	// Pill boxes, x and y the centre.
	const a = { x: 100, y: 100, w: 100, h: 28 };
	const b = { x: 400, y: 100, w: 120, h: 28 };
	/** The numbers of a path, in order. */
	const nums = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

	it('leaves the right edge of the first box and stops a head-gap left of the second', () => {
		const g = edgeGeometry(a, b);
		const [sx, , cx, cy, ex, ey] = nums(g.d);
		expect(g.d.startsWith('M')).toBe(true);
		expect(g.d).toContain('Q');
		expect(Math.abs(sx - (a.x + a.w / 2))).toBeLessThan(1);
		expect(ex).toBeLessThan(b.x - b.w / 2);
		expect(b.x - b.w / 2 - ex).toBeLessThan(6);
		expect(b.x - b.w / 2 - ex).toBeGreaterThan(1);
		expect(Math.abs(ey - 100)).toBeLessThan(b.h / 2);
		expect(cx).toBeGreaterThan(a.x);
		expect(cx).toBeLessThan(b.x);
		expect(cy).not.toBe(100);
		expect(g.labelX).toBeGreaterThan(a.x + a.w / 2);
		expect(g.labelX).toBeLessThan(b.x - b.w / 2);
	});

	it('leaves a box below through its bottom edge', () => {
		const below = { x: 100, y: 300, w: 100, h: 28 };
		const [, sy] = nums(edgeGeometry(a, below).d);
		expect(Math.abs(sy - (a.y + a.h / 2))).toBeLessThan(1);
	});

	it('bows the two directions of a pair apart, so both show', () => {
		const there = edgeGeometry(a, b);
		const back = edgeGeometry(b, a);
		expect(there.labelY).not.toBe(back.labelY);
		expect(Math.sign(nums(there.d)[3] - 100)).toBe(-Math.sign(nums(back.d)[3] - 100));
	});

	it("curls a loop off the box's top right corner, starting and ending on the top edge", () => {
		const g = edgeGeometry(a, a);
		expect(g.d).toContain('C');
		const [sx, sy, , , , , ex, ey] = nums(g.d);
		const top = a.y - a.h / 2;
		expect(Math.abs(sy - top)).toBeLessThan(1);
		expect(Math.abs(ey - top)).toBeLessThan(6);
		for (const x of [sx, ex]) {
			expect(x).toBeGreaterThan(a.x);
			expect(x).toBeLessThanOrEqual(a.x + a.w / 2);
		}
		expect(g.labelY).toBeLessThan(top);
	});

	it('is the same for the same input', () => {
		expect(edgeGeometry(a, b)).toEqual(edgeGeometry(a, b));
	});

	it('survives two boxes at one spot', () => {
		const g = edgeGeometry({ x: 50, y: 50, w: 40, h: 20 }, { x: 50, y: 50, w: 40, h: 20 }, false);
		expect(nums(g.d).every(Number.isFinite)).toBe(true);
	});
});

describe('arrowLook', () => {
	const e = { from: 1, to: 2, figures: 3 };
	const none = { picked: null, stepped: null };
	it('is at rest when nothing is picked, with its count', () => {
		expect(arrowLook(e, none)).toEqual({ tone: 'rest', badge: null, count: 3 });
		expect(arrowLook({ ...e, figures: 1 }, none).count).toBeNull();
	});
	it('is out from the picked position and in into it', () => {
		expect(arrowLook(e, { picked: 1, stepped: null }).tone).toBe('out');
		expect(arrowLook(e, { picked: 2, stepped: null }).tone).toBe('in');
	});
	it('fades what does not touch the picked position, with no count', () => {
		expect(arrowLook(e, { picked: 9, stepped: null })).toEqual({
			tone: 'faded',
			badge: null,
			count: null
		});
	});
	it('treats a loop on the picked position as out, not in', () => {
		expect(arrowLook({ from: 4, to: 4, figures: 1 }, { picked: 4, stepped: null }).tone).toBe(
			'out'
		);
	});
	it('lets the stepped edge win over in', () => {
		expect(arrowLook(e, { picked: 2, stepped: '1:2' }).tone).toBe('stepped');
		expect(arrowLook(e, { picked: 2, stepped: '2:1' }).tone).toBe('in');
	});
});
