import { describe, expect, it } from 'vitest';
import {
	anchorAfter,
	anchorAlternative,
	anchorBefore,
	anchorText,
	fold,
	pickList,
	type Anchor,
	type Candidate
} from './fit';

/** Positions: 1 open (neutral), 2 closed, 3 hammerlock. */
const fig = (
	id: number,
	label: string,
	o: Partial<Candidate> = {},
	parentId: number | null = null
): Candidate => ({
	kind: 'figure',
	id,
	parentId,
	label,
	starts: [1],
	startCounts: [1],
	end: 1,
	next: 1,
	...o
});

const candidates: Candidate[] = [
	fig(1, 'Cross body lead', { end: 2 }),
	fig(2, 'Dile que no', { end: 2 }),
	fig(3, 'Enchufla', { starts: [2] }),
	fig(4, 'Enchufla · Doble', {}, 3),
	fig(5, 'Sombrero', { starts: [3] }),
	fig(6, 'Son basic', { startCounts: [5], next: 5 }),
	{ ...fig(7, 'Shine combo'), kind: 'routine' }
];

const all = { count: true, hold: true, query: '' };
const after: Anchor = { kind: 'after', end: 1, next: 1 }; // starts on 1 from open
const ids = (l: ReturnType<typeof pickList>) => ({
	figures: l.figures.map((g) => [g.head.id, g.headFits, g.variations.map((v) => v.id)]),
	routines: l.routines.map((r) => r.id)
});

describe('pickList', () => {
	it('offers everything without an anchor', () => {
		const l = pickList(candidates, { kind: 'none' }, all);
		expect(l.figures).toHaveLength(5);
		expect(l.routines.map((r) => r.id)).toEqual([7]);
		expect(l.toggles).toEqual({ count: false, hold: false });
	});

	it('after a slot: starts on its next count, from where it lands', () => {
		expect(ids(pickList(candidates, after, all))).toEqual({
			figures: [
				[1, true, []],
				[2, true, []],
				[3, false, [4]] // Enchufla starts from closed; its Doble from open
			],
			routines: [7]
		});
	});

	it('before a slot: lands where it starts, ready for its count', () => {
		const before: Anchor = { kind: 'before', starts: [2], startCounts: [1] };
		expect(ids(pickList(candidates, before, all)).figures).toEqual([
			[1, true, []],
			[2, true, []]
		]);
	});

	it('turns each filter off on its own', () => {
		const countOff = ids(pickList(candidates, after, { ...all, count: false })).figures;
		expect(countOff.map((g) => g[0])).toContain(6); // Son basic starts on 5
		expect(countOff.map((g) => g[0])).not.toContain(5); // Sombrero still fails Hold
		const holdOff = ids(pickList(candidates, after, { ...all, hold: false })).figures;
		expect(holdOff.map((g) => g[0])).toEqual([1, 2, 3, 5]);
	});

	it('ignores case and accents', () => {
		const l = pickList(candidates, { kind: 'none' }, { ...all, query: 'DILE quÉ' });
		expect(ids(l).figures).toEqual([[2, true, []]]);
	});

	it('finds a variation by its own name, under a greyed figure', () => {
		const l = pickList(candidates, { kind: 'none' }, { ...all, query: 'doble' });
		expect(ids(l).figures).toEqual([[3, false, [4]]]);
	});

	it('says which filter emptied the list', () => {
		const shadow: Anchor = { kind: 'after', end: 9, next: 1 };
		const l = pickList(candidates, shadow, all);
		expect(l.figures).toEqual([]);
		expect(l.emptiedBy).toEqual(['hold']);
	});

	it('hides a chip the anchor cannot use', () => {
		expect(pickList(candidates, { kind: 'after', end: null, next: 1 }, all).toggles).toEqual({
			count: true,
			hold: false
		});
	});

	it('in alternative mode: same starts, count and landing; no routines; filters ignored', () => {
		const alt: Anchor = {
			kind: 'alternative',
			starts: [1],
			startCount: 1,
			end: 2,
			next: 1,
			exclude: [1]
		};
		const l = pickList(candidates, alt, { count: false, hold: false, query: '' });
		expect(ids(l)).toEqual({ figures: [[2, true, []]], routines: [] });
	});
});

describe('anchors', () => {
	it('builds from a row’s edges', () => {
		const e = { starts: [2], startCounts: [1], end: 3, next: 5 };
		expect(anchorAfter(e)).toEqual({ kind: 'after', end: 3, next: 5 });
		expect(anchorBefore(e)).toEqual({ kind: 'before', starts: [2], startCounts: [1] });
	});

	it('falls back to no anchor for a row with nothing danceable', () => {
		const empty = { starts: [], startCounts: [], end: null, next: null };
		expect(anchorAfter(empty)).toEqual({ kind: 'none' });
		expect(anchorBefore(empty)).toEqual({ kind: 'none' });
	});

	it('has no alternative anchor when the main figure is gone', () => {
		expect(anchorAlternative(undefined, [1])).toBeNull();
		expect(anchorAlternative(fig(1, 'A', { end: 2 }), [1])).toEqual({
			kind: 'alternative',
			starts: [1],
			startCount: 1,
			end: 2,
			next: 1,
			exclude: [1]
		});
	});
});

describe('anchorText', () => {
	const name = (id: number) => ['', 'Open', 'Closed', 'Hammerlock'][id];
	it('says it the way a dancer does', () => {
		expect(anchorText({ kind: 'after', end: 2, next: 1 }, name)).toBe('Starts on 1 from Closed');
		expect(anchorText({ kind: 'before', starts: [3], startCounts: [1] }, name)).toBe(
			'Ends on 8 at Hammerlock'
		);
		expect(anchorText({ kind: 'before', starts: [1, 2], startCounts: [5] }, name)).toBe(
			'Ends on 4 at Open or Closed'
		);
		expect(
			anchorText(
				{ kind: 'alternative', starts: [2], startCount: 1, end: 1, next: 1, exclude: [] },
				name
			)
		).toBe('Closed → Open, 1→1');
		expect(anchorText({ kind: 'none' }, name)).toBeNull();
	});
});

describe('fold', () => {
	it('lowercases and strips accents', () => {
		expect(fold('Dile Qué Nó')).toBe('dile que no');
	});
});
