import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { differLabel, outOfSync, syncCard } from './sync';
import { figureRowParts } from './list';
import { figuresView, parseFigureFilter, type FiguresLists } from './filter';
import { figuresEmpty, filterChips, filterQuery } from './figures';
import { parsePositionFilter, positionsView, type PositionsLists } from '$lib/positions/filter';
import { positionChips, positionQuery } from '$lib/positions/view';
import { routinesView } from './routines';
import type { FigureRow, MoveRow, PositionListRow } from '$lib/types';

describe('syncCard', () => {
	it('names the count and the kind', () => {
		expect(syncCard('figure', 3)).toEqual({
			title: '3 figures out of sync',
			meta: "Your copies and the clubs' don't agree"
		});
		expect(syncCard('routine', 1)?.title).toBe('1 routine out of sync');
		expect(syncCard('position', 2)?.title).toBe('2 positions out of sync');
		expect(syncCard('figure', 1)?.title).toBe('1 figure out of sync');
	});
	it('is null when nothing differs', () => {
		expect(syncCard('figure', 0)).toBeNull();
	});
});

describe('differLabel', () => {
	it('counts the copies', () => {
		expect(differLabel(2)).toBe('2 copies differ');
		expect(differLabel(1)).toBe('1 copy differs');
	});
	it('says nothing when none differ', () => {
		expect(differLabel(0)).toBeNull();
	});
});

describe('outOfSync', () => {
	it('keeps rows with differ above 0', () => {
		expect([{ differ: 0 }, { differ: 2 }].filter(outOfSync)).toEqual([{ differ: 2 }]);
	});
});

const fig = (id: number, differ: number): FigureRow =>
	({
		id,
		name: `F${id}`,
		label: `F${id}`,
		from: null,
		startCount: null,
		lengthCounts: null,
		recordings: 0,
		hasSection: true,
		hasLesson: true,
		partner: 'partner',
		style: 'On1',
		differ
	}) as FigureRow;

describe('the figures filter', () => {
	const lists = {
		mine: [{ id: 1, name: 'M', figures: [fig(11, 0), fig(12, 2)] } as MoveRow],
		groups: [
			{ team: { id: 9, name: 'Club' }, moves: [{ id: 2, name: 'N', figures: [fig(21, 1)] }] }
		],
		sets: [],
		groupMode: false,
		unlinked: 0,
		unrouted: 0,
		defaultStyle: 'On1'
	} as unknown as FiguresLists;
	it('reads ?sync=1 and keeps only the rows that differ, in the sections too', () => {
		const f = parseFigureFilter(new URLSearchParams('sync=1'), []);
		expect(f.sync).toBe('1');
		const v = figuresView(lists, f);
		expect(v.figures.flatMap((m) => m.figures.map((x) => x.id))).toEqual([12]);
		expect(v.groups.flatMap((g) => g.moves.flatMap((m) => m.figures.map((x) => x.id)))).toEqual([
			21
		]);
	});
	it('is in the query, and an empty result reads as no match', () => {
		expect(filterQuery({ q: '', sync: '1' }, {})).toBe('sync=1');
		expect(figuresEmpty(0, { q: '', sync: '1' })).toBe('no-match');
	});
});

describe('the rows say how many copies differ', () => {
	it('a figure row ends in a warn part', () => {
		const parts = figureRowParts({ ...fig(1, 2) });
		expect(parts[parts.length - 1]).toEqual({ text: '2 copies differ', status: false, warn: true });
		expect(figureRowParts(fig(1, 0)).some((p) => p.warn)).toBe(false);
	});
});

describe('the positions filter', () => {
	it('reads ?sync=1', () => {
		const f = parsePositionFilter(new URLSearchParams('sync=1'), [], false);
		expect(f.sync).toBe('1');
		expect(positionQuery(f, {})).toBe('sync=1');
		const rows = [
			{ name: 'A', differ: 0 },
			{ name: 'B', differ: 1 }
		] as PositionListRow[];
		const v = positionsView({ rows, groups: [] } as unknown as PositionsLists, f);
		expect(v.rows.map((r) => r.name)).toEqual(['B']);
	});
});

describe('the routines filter', () => {
	it('keeps only the routines that differ', () => {
		const l = {
			routines: [
				{ id: 1, differ: 0 },
				{ id: 2, differ: 3 }
			],
			groups: [{ team: { id: 1, name: 'C' }, routines: [{ id: 3, differ: 0 }] }],
			twinned: []
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const v = routinesView(l as any, true);
		expect(v.routines.map((r) => r.id)).toEqual([2]);
		expect(v.groups).toEqual([]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(routinesView(l as any, false).routines).toHaveLength(2);
	});
});

describe('the card with the filter on and nothing left', () => {
	it('stays, to clear the filter', () => {
		expect(syncCard('figure', 0, true)?.title).toBe('All in step');
		expect(syncCard('figure', 0, false)).toBeNull();
		expect(syncCard('figure', 2, true)?.title).toBe('2 figures out of sync');
	});
});

describe('the All chips under ?sync=1', () => {
	it('Figures: All is not lit, and clears sync', () => {
		const all = filterChips({ q: '', sync: '1' }, [], {}, 0)[0];
		expect(all.on).toBe(false);
		expect(filterQuery({ q: '', sync: '1' }, all.change)).toBe('');
		expect(filterChips({ q: '' }, [], {}, 0)[0].on).toBe(true);
	});
	it('Positions: All is not lit, and clears sync', () => {
		const o = {
			types: [],
			typeLabel: {},
			gaps: 0,
			groupMode: false,
			hasOwn: false,
			untyped: false
		};
		const all = positionChips({ q: '', sync: '1' }, o)[0];
		expect(all.on).toBe(false);
		expect(positionQuery({ q: '', sync: '1' }, all.change)).toBe('');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('words the card, the count after a colon', () => {
		expect(sl(() => syncCard('figure', 3))).toEqual({
			title: 'Ni usklajeno: 3 figure',
			meta: 'Vaše kopije in kopije skupin se ne ujemajo'
		});
		expect(sl(() => syncCard('routine', 1)?.title)).toBe('Ni usklajeno: 1 kombinacija');
		expect(sl(() => syncCard('position', 5)?.title)).toBe('Ni usklajeno: 5 položajev');
		expect(sl(() => syncCard('figure', 0, true)?.title)).toBe('Vse je usklajeno');
	});

	it('agrees the verb with the copies', () => {
		expect(sl(() => [1, 2, 3, 5].map((n) => differLabel(n)))).toEqual([
			'1 kopija se razlikuje',
			'2 kopiji se razlikujeta',
			'3 kopije se razlikujejo',
			'5 kopij se razlikuje'
		]);
	});

	it('words the empty filter at call time', async () => {
		const { SYNC_EMPTY } = await import('./sync');
		expect(sl(() => SYNC_EMPTY.title)).toBe('Vse kopije se ujemajo');
		expect(SYNC_EMPTY.title).toBe('Every copy agrees');
	});
});
