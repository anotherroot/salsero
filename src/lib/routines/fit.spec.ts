import { describe, expect, it } from 'vitest';
import {
	anchorAfter,
	anchorAlternative,
	anchorBetween,
	canBridge,
	anchorBefore,
	anchorText,
	fitsLength,
	groupTags,
	lengthChoices,
	preselect,
	pickList,
	variationName,
	type Anchor,
	type Candidate
} from './fit';
import { fold } from '$lib/fold';
import { withLocale } from '$lib/i18n/current';
import { t } from '$lib/i18n/catalog';

/** Positions: 1 open, 2 closed, 3 hammerlock. None is special. */
const fig = (
	id: number,
	label: string,
	o: Partial<Candidate> = {},
	groupId: number | null = id
): Candidate => ({
	kind: 'figure',
	id,
	groupId,
	figure: label.split(' · ')[0],
	label,
	starts: [1],
	startCounts: [1],
	ends: [1],
	next: 1,
	...o
});

const candidates: Candidate[] = [
	fig(1, 'Cross body lead', { ends: [2] }),
	fig(2, 'Dile que no', { ends: [2] }),
	fig(3, 'Enchufla · Basic', { starts: [2] }, 3),
	fig(4, 'Enchufla · Doble', {}, 3),
	fig(5, 'Sombrero', { starts: [3] }),
	fig(6, 'Son basic', { startCounts: [5], next: 5 }),
	{ ...fig(7, 'Shine combo', {}, null), kind: 'routine', figure: null }
];

const all = { count: true, hold: true, query: '' };
const after: Anchor = { kind: 'after', ends: [1], next: 1 }; // starts on 1 from open
const ids = (l: ReturnType<typeof pickList>) => ({
	figures: l.figures.map((g) => [g.groupId, g.single, g.variations.map((v) => v.id)]),
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
				[1, true, [1]],
				[2, true, [2]],
				[3, false, [4]] // Basic starts from closed; Doble from open
			],
			routines: [7]
		});
	});

	it('before a slot: lands where it starts, ready for its count', () => {
		const before: Anchor = { kind: 'before', starts: [2], startCounts: [1] };
		expect(ids(pickList(candidates, before, all)).figures).toEqual([
			[1, true, [1]],
			[2, true, [2]]
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
		expect(ids(l).figures).toEqual([[2, true, [2]]]);
	});

	it('groups variations under their figure', () => {
		const l = pickList(candidates, { kind: 'none' }, { ...all, query: 'enchufla' });
		expect(l.figures).toHaveLength(1);
		expect(l.figures[0]).toMatchObject({ groupId: 3, name: 'Enchufla', single: false });
		expect(l.figures[0].variations.map((v) => v.id)).toEqual([3, 4]);
		expect(variationName(l.figures[0].variations[1])).toBe('Doble');
	});

	it('a one-variation figure is a single row', () => {
		const l = pickList(candidates, { kind: 'none' }, { ...all, query: 'sombrero' });
		expect(l.figures).toHaveLength(1);
		expect(l.figures[0]).toMatchObject({ groupId: 5, single: true });
		expect(l.figures[0].variations.map((v) => v.id)).toEqual([5]);
	});

	it('stays a group when only one of its variations fits', () => {
		const g = pickList(candidates, after, all).figures.find((x) => x.groupId === 3)!;
		expect(g.single).toBe(false);
		expect(g.variations.map((v) => v.id)).toEqual([4]);
	});

	it('leaves out a figure none of whose variations fit', () => {
		const before: Anchor = { kind: 'before', starts: [2], startCounts: [1] };
		expect(pickList(candidates, before, all).figures.map((g) => g.groupId)).not.toContain(3);
	});

	it('finds a variation by its own name', () => {
		const l = pickList(candidates, { kind: 'none' }, { ...all, query: 'doble' });
		expect(ids(l).figures).toEqual([[3, false, [4]]]);
	});

	it('matches every word of the query, in any order', () => {
		// The label is "Enchufla · Doble": the words are separated by more than a space.
		for (const query of ['enchufla doble', 'doble  enchufla ']) {
			const l = pickList(candidates, { kind: 'none' }, { ...all, query });
			expect(ids(l).figures).toEqual([[3, false, [4]]]);
		}
		expect(
			pickList(candidates, { kind: 'none' }, { ...all, query: 'enchufla dile' }).figures
		).toEqual([]);
	});

	it('says which filter emptied the list', () => {
		const shadow: Anchor = { kind: 'after', ends: [9], next: 1 };
		const l = pickList(candidates, shadow, all);
		expect(l.figures).toEqual([]);
		expect(l.emptiedBy).toEqual(['hold']);
	});

	it('hides a chip the anchor cannot use', () => {
		expect(pickList(candidates, { kind: 'after', ends: null, next: 1 }, all).toggles).toEqual({
			count: true,
			hold: false
		});
	});

	it('hides the hold chip when the anchor has no position on its side', () => {
		expect(pickList(candidates, { kind: 'after', ends: [], next: 1 }, all).toggles).toEqual({
			count: true,
			hold: false
		});
		expect(
			pickList(candidates, { kind: 'before', starts: [], startCounts: [1] }, all).toggles
		).toEqual({ count: true, hold: false });
	});

	it('after a slot with two ends: what starts in either fits', () => {
		const two: Anchor = { kind: 'after', ends: [2, 3], next: 1 };
		// Basic starts from closed, Sombrero from hammerlock; the rest start from open.
		expect(ids(pickList(candidates, two, all)).figures).toEqual([
			[3, false, [3]],
			[5, true, [5]]
		]);
	});

	it('a candidate with no starts fits after anything; one with no ends before anything', () => {
		const free = fig(8, 'Free', { starts: [], ends: [] });
		const shadow: Anchor = { kind: 'after', ends: [9], next: 1 };
		const intoShadow: Anchor = { kind: 'before', starts: [9], startCounts: [1] };
		expect(ids(pickList([free], shadow, all)).figures).toEqual([[8, true, [8]]]);
		expect(ids(pickList([free], intoShadow, all)).figures).toEqual([[8, true, [8]]]);
	});

	it('in alternative mode: same starts, count and landing; no routines; filters ignored', () => {
		const alt: Anchor = {
			kind: 'alternative',
			starts: [1],
			startCount: 1,
			ends: [2],
			next: 1,
			exclude: [1]
		};
		const l = pickList(candidates, alt, { count: false, hold: false, query: '' });
		expect(ids(l)).toEqual({ figures: [[2, true, [2]]], routines: [] });
	});

	it('in alternative mode: the same set of ends, in any order, and starts that meet', () => {
		const main = fig(1, 'Main', { ends: [2, 3] });
		const pool = [
			main,
			fig(2, 'Same ends, other order', { ends: [3, 2] }),
			fig(3, 'Fewer ends', { ends: [2] }),
			fig(4, 'No starts', { starts: [], ends: [2, 3] }),
			fig(5, 'Other start', { starts: [2], ends: [2, 3] })
		];
		const alt = anchorAlternative(main, [1])!;
		expect(ids(pickList(pool, alt, all)).figures.map((g) => g[0])).toEqual([2, 4]);
	});
});

describe('a repertoire with no positions', () => {
	const free = (id: number, label: string, groupId: number | null = id) =>
		fig(id, label, { starts: [], ends: [] }, groupId);
	const pool: Candidate[] = [
		free(1, 'Cross body lead'),
		free(2, 'Enchufla · Basic', 2),
		free(3, 'Enchufla · Doble', 2),
		{ ...free(4, 'Shine combo', null), kind: 'routine', figure: null }
	];
	const row = { starts: [], startCounts: [1], ends: [], next: 1 };
	const count = (l: ReturnType<typeof pickList>) =>
		l.figures.flatMap((g) => g.variations).length + l.routines.length;

	it('keeps every candidate after, before and between', () => {
		expect(count(pickList(pool, anchorAfter(row), all))).toBe(4);
		expect(count(pickList(pool, anchorBefore(row), all))).toBe(4);
		expect(count(pickList(pool, anchorBetween(row, row)!, all))).toBe(4);
	});

	it('keeps every other figure as an alternative', () => {
		const alt = anchorAlternative(pool[0], [1])!;
		expect(ids(pickList(pool, alt, all)).figures.map((g) => g[0])).toEqual([2]);
		expect(pickList(pool, alt, all).figures[0].variations.map((v) => v.id)).toEqual([2, 3]);
	});

	it('offers no hold chip', () => {
		expect(pickList(pool, anchorAfter(row), all).toggles.hold).toBe(false);
		expect(pickList(pool, anchorBefore(row), all).toggles.hold).toBe(false);
	});
});

describe('anchors', () => {
	it('builds from a row’s edges', () => {
		const e = { starts: [2], startCounts: [1], ends: [3], next: 5 };
		expect(anchorAfter(e)).toEqual({ kind: 'after', ends: [3], next: 5 });
		expect(anchorBefore(e)).toEqual({ kind: 'before', starts: [2], startCounts: [1] });
	});

	it('falls back to no anchor for a row with nothing danceable', () => {
		const empty = { starts: [], startCounts: [], ends: null, next: null };
		expect(anchorAfter(empty)).toEqual({ kind: 'none' });
		expect(anchorBefore(empty)).toEqual({ kind: 'none' });
	});

	it('has no alternative anchor when the main figure is gone', () => {
		expect(anchorAlternative(undefined, [1])).toBeNull();
		expect(anchorAlternative(fig(1, 'A', { ends: [2] }), [1])).toEqual({
			kind: 'alternative',
			starts: [1],
			startCount: 1,
			ends: [2],
			next: 1,
			exclude: [1]
		});
	});

	it('has an alternative anchor for a main figure with no position', () => {
		expect(anchorAlternative(fig(1, 'A', { starts: [], ends: [] }), [1])).toEqual({
			kind: 'alternative',
			starts: [],
			startCount: 1,
			ends: [],
			next: 1,
			exclude: [1]
		});
	});
});

describe('between two slots', () => {
	const above = { starts: [1], startCounts: [1], ends: [1], next: 1 }; // lands in open, ready for 1
	const intoClosed = { starts: [2], startCounts: [1], ends: [1], next: 1 }; // starts from closed on 1
	const intoHammerlock = { starts: [3], startCounts: [1], ends: [1], next: 1 };

	it('offers only what fits both the slot above and the slot below', () => {
		const anchor = anchorBetween(above, intoClosed)!;
		// Cross body lead and Dile que no start from open and land in closed; the
		// routine starts right but lands in open, so it does not close the seam.
		expect(ids(pickList(candidates, anchor, all))).toEqual({
			figures: [
				[1, true, [1]],
				[2, true, [2]]
			],
			routines: []
		});
	});

	it('says whether anything closes the seam at all', () => {
		expect(canBridge(candidates, anchorBetween(above, intoClosed))).toBe(true);
		// Nothing in the fixture lands in hammerlock.
		expect(canBridge(candidates, anchorBetween(above, intoHammerlock))).toBe(false);
	});

	it('has no anchor when either side has nothing danceable', () => {
		const empty = { starts: [], startCounts: [], ends: null, next: null };
		expect(anchorBetween(empty, intoClosed)).toBeNull();
		expect(anchorBetween(above, empty)).toBeNull();
		expect(canBridge(candidates, null)).toBe(false);
	});

	it('reads both halves in its context line', () => {
		const name = (id: number) => ['', 'Open', 'Closed', 'Hammerlock'][id];
		expect(anchorText(anchorBetween(above, intoClosed)!, name)).toBe(
			'Starts on 1 from Open · ends on 8 at Closed'
		);
	});
});

describe('anchorText', () => {
	const name = (id: number) => ['', 'Open', 'Closed', 'Hammerlock'][id];
	it('says it the way a dancer does', () => {
		expect(anchorText({ kind: 'after', ends: [2], next: 1 }, name)).toBe('Starts on 1 from Closed');
		expect(anchorText({ kind: 'after', ends: [1, 2], next: 1 }, name)).toBe(
			'Starts on 1 from Open or Closed'
		);
		expect(anchorText({ kind: 'after', ends: [], next: 1 }, name)).toBe('Starts on 1');
		expect(anchorText({ kind: 'before', starts: [3], startCounts: [1] }, name)).toBe(
			'Ends on 8 at Hammerlock'
		);
		expect(anchorText({ kind: 'before', starts: [1, 2], startCounts: [5] }, name)).toBe(
			'Ends on 4 at Open or Closed'
		);
		expect(
			anchorText(
				{ kind: 'alternative', starts: [2], startCount: 1, ends: [1], next: 1, exclude: [] },
				name
			)
		).toBe('Closed → Open, 1→1');
		expect(
			anchorText(
				{ kind: 'alternative', starts: [2], startCount: 1, ends: [1, 3], next: 1, exclude: [] },
				name
			)
		).toBe('Closed → Open or Hammerlock, 1→1');
		expect(
			anchorText(
				{ kind: 'alternative', starts: [], startCount: 1, ends: [3], next: 1, exclude: [] },
				name
			)
		).toBe('Anywhere → Hammerlock, 1→1');
		expect(
			anchorText(
				{ kind: 'alternative', starts: [2], startCount: 1, ends: [], next: 1, exclude: [] },
				name
			)
		).toBe('Closed → anywhere, 1→1');
		expect(
			anchorText(
				{ kind: 'alternative', starts: [], startCount: 5, ends: [], next: 1, exclude: [] },
				name
			)
		).toBe('5→1');
		expect(anchorText({ kind: 'none' }, name)).toBeNull();
	});
});

describe('fold', () => {
	it('lowercases and strips accents', () => {
		expect(fold('Dile Qué Nó')).toBe('dile que no');
	});
});

describe('a group move of the same name', () => {
	it('is its own group, keyed by move id, and carries its group', () => {
		const team = { id: 1, name: 'Salsa Tuesdays' };
		const list = pickList(
			[fig(1, 'Enchufla · Basic', {}, 3), fig(2, 'Enchufla · Basic', { team }, 9)],
			{ kind: 'none' },
			{ count: true, hold: true, query: '' }
		);
		expect(list.figures.map((g) => [g.groupId, g.team?.name])).toEqual([
			[3, undefined],
			[9, 'Salsa Tuesdays']
		]);
	});
});

describe('same names in the routine picker', () => {
	it('groupTags tags the copy of two same-named variations, not a lone one', () => {
		const list = pickList(
			[
				fig(1, 'Enchufla · Basic', {}, 3),
				fig(2, 'Enchufla · Basic', { from: 'Sreda 17:30' }, 3),
				fig(3, 'Enchufla · Doble', { from: 'Sreda 17:30' }, 3)
			],
			{ kind: 'none' },
			all
		);
		expect(list.figures).toHaveLength(1);
		expect([...groupTags(list.figures[0]).entries()]).toEqual([[2, '· Sreda 17:30']]);
	});
});

describe('anchorText in Slovenian', () => {
	const name = (id: number) => ['', 'Open', 'Closed', 'Hammerlock'][id];
	const sl = (a: Anchor) => withLocale('sl', () => anchorText(a, name));
	it('puts the positions after a colon and joins them with “ali”', () => {
		expect(sl({ kind: 'after', ends: [1, 2], next: 1 })).toBe(
			'Začne na 1, v položaju: Open ali Closed'
		);
		expect(sl({ kind: 'after', ends: [], next: 1 })).toBe('Začne na 1');
		expect(sl({ kind: 'before', starts: [3], startCounts: [1, 5] })).toBe(
			'Konča na 8 ali 4, v položaju: Hammerlock'
		);
		expect(sl({ kind: 'before', starts: [3], startCounts: [] })).toBe(
			'Konča v položaju: Hammerlock'
		);
		expect(
			sl({
				kind: 'between',
				after: { kind: 'after', ends: [1], next: 1 },
				before: { kind: 'before', starts: [2], startCounts: [1] }
			})
		).toBe('Začne na 1, v položaju: Open · konča na 8, v položaju: Closed');
		expect(
			sl({ kind: 'alternative', starts: [], startCount: 1, ends: [3], next: 1, exclude: [] })
		).toBe('Kjerkoli → Hammerlock, 1→1');
		expect(
			sl({ kind: 'alternative', starts: [2], startCount: 1, ends: [], next: 1, exclude: [] })
		).toBe('Closed → kjerkoli, 1→1');
	});

	it('says nothing fits with the context after a colon (SlotPicker)', () => {
		const between: Anchor = {
			kind: 'between',
			after: { kind: 'after', ends: [1], next: 1 },
			before: { kind: 'before', starts: [2], startCounts: [1] }
		};
		expect(withLocale('sl', () => t().routine.picker.nothingFits(anchorText(between, name)!))).toBe(
			'Nič, kar poznate, ne ustreza: začne na 1, v položaju: Open · konča na 8, v položaju: Closed.'
		);
		expect(t().routine.picker.nothingFits('Starts on 1')).toBe('Nothing you know starts on 1.');
	});
});

describe('start sets and free lengths in the picker', () => {
	// 1 or 5, 4 counts; any count, length set in the routine.
	const basic = fig(10, 'Basic step · Closed', { startCounts: [1, 5], length: 4, next: 5 });
	const walk = fig(11, 'Cradle walk · Slow', {
		startCounts: [1, 2, 3, 4, 5, 6, 7, 8],
		length: 8,
		free: true,
		next: 1
	});
	const fixed = fig(12, 'Cross body lead', { length: 8 });
	const pool = [basic, walk, fixed];
	const figureIds = (l: ReturnType<typeof pickList>) =>
		l.figures.flatMap((g) => g.variations.map((v) => v.id));

	it('fits after a slot on any count of its set', () => {
		expect(figureIds(pickList(pool, { kind: 'after', ends: [1], next: 5 }, all))).toEqual([10, 11]);
	});

	it('fits before a slot when one of its starts lands there, and a free figure always', () => {
		const before: Anchor = { kind: 'before', starts: [1], startCounts: [1] };
		// basic from 5 lands on 1; the walk can be any length; the lead from 1 lands on 1.
		expect(figureIds(pickList(pool, before, all))).toEqual([10, 11, 12]);
		const on3: Anchor = { kind: 'before', starts: [1], startCounts: [3] };
		expect(figureIds(pickList(pool, on3, all))).toEqual([11]);
	});

	it('between two rows, judges the landing from the start the row above gives', () => {
		const above = { starts: [1], startCounts: [1], ends: [1], next: 5, start: 1 };
		const below = { starts: [1], startCounts: [5], ends: [1], next: 1, start: 5 };
		// basic from 5 lands on 1, not 5; the walk fits any length.
		expect(figureIds(pickList(pool, anchorBetween(above, below)!, all))).toEqual([11]);
	});

	it('stands in for a main figure on the start the routine gives it', () => {
		const main = fig(13, 'Basic step · Open', { startCounts: [1, 5], length: 4, next: 5 });
		const row = { starts: [1], startCounts: [1, 5], ends: [1], next: 1, start: 5 };
		const alt = anchorAlternative(main, [13], row)!;
		expect(alt).toMatchObject({ startCount: 5, next: 1 });
		expect(figureIds(pickList([main, basic, walk, fixed], alt, all))).toEqual([10, 11]);
	});
});

describe('lengthChoices', () => {
	it('offers every length when nothing waits below', () => {
		expect(lengthChoices(1, null).every((c) => c.ok)).toBe(true);
		expect(lengthChoices(1, null).map((c) => c.n)).toEqual([2, 4, 6, 8, 12, 16, 24]);
	});

	it('greys the lengths that would land on another count', () => {
		expect(
			lengthChoices(1, 5)
				.filter((c) => c.ok)
				.map((c) => c.n)
		).toEqual([4, 12]);
		expect(fitsLength(1, 20, 5)).toBe(true);
		expect(fitsLength(1, 8, 5)).toBe(false);
	});

	it('preselects the shortest that lands where the slot below starts', () => {
		expect(preselect(1, 5)).toBe(4);
		expect(preselect(1, null)).toBeNull();
		// From 1, landing on 2 takes 9, 17… counts: none offered.
		expect(preselect(1, 2)).toBeNull();
	});
});
