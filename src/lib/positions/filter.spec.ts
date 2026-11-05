import { describe, expect, it } from 'vitest';
import { parsePositionFilter, positionMatches, positionsView, type PositionsLists } from './filter';
import { OTHER_TYPE } from './view';
import { EMPTY_HOLD } from './hold';
import type { PositionListRow } from '$lib/types';

const row = (o: Partial<PositionListRow>): PositionListRow => ({
	id: 1,
	name: 'x',
	styleTag: 'Salsa',
	hold: EMPTY_HOLD,
	teamId: null,
	archived: false,
	inCount: 0,
	outCount: 0,
	deadEnd: false,
	orphan: false,
	island: false,
	unused: false,
	from: null,
	twins: false,
	...o
});

describe('positionMatches', () => {
	it('the search is folded', () => {
		expect(positionMatches(row({ name: 'Manos Cruzadas' }), { q: 'cruzadas' })).toBe(true);
		expect(positionMatches(row({ name: 'Café' }), { q: 'cafe' })).toBe(true);
		expect(positionMatches(row({ name: 'Café' }), { q: 'zz' })).toBe(false);
	});
	it('Other matches an untyped row', () => {
		expect(positionMatches(row({ styleTag: null }), { q: '', type: OTHER_TYPE })).toBe(true);
		expect(positionMatches(row({ styleTag: 'Salsa' }), { q: '', type: OTHER_TYPE })).toBe(false);
		expect(positionMatches(row({ styleTag: 'Salsa' }), { q: '', type: 'Salsa' })).toBe(true);
	});
	it('gaps keeps dead ends, orphans and islands', () => {
		const g = { q: '', gaps: '1' as const };
		expect(positionMatches(row({ deadEnd: true }), g)).toBe(true);
		expect(positionMatches(row({ orphan: true }), g)).toBe(true);
		expect(positionMatches(row({ island: true }), g)).toBe(true);
		expect(positionMatches(row({}), g)).toBe(false);
	});
});

describe('positionsView', () => {
	const l: PositionsLists = {
		rows: [row({ id: 1, name: 'A', deadEnd: true }), row({ id: 2, name: 'B' })],
		groups: [{ team: { id: 5, name: 'T' }, rows: [row({ id: 3, name: 'A2', teamId: 5 })] }],
		none: { none: 0, onlyStart: 0, onlyEnd: 0 },
		tagged: { done: 0, total: 0 },
		gaps: 1,
		hasOwn: true,
		untyped: false,
		types: ['Salsa'],
		styleLabel: {},
		defaultStyle: 'Salsa',
		owned: [],
		inGroupMode: false
	};
	it('filters rows and groups, dropping empty groups', () => {
		const v = positionsView(l, { q: 'a' });
		expect(v.rows.map((r) => r.id)).toEqual([1]);
		expect(v.groups[0].rows.map((r) => r.id)).toEqual([3]);
		expect(positionsView(l, { q: 'b' }).groups).toEqual([]);
	});
	it('gaps empties the groups', () => {
		const v = positionsView(l, { q: '', gaps: '1' });
		expect(v.rows.map((r) => r.id)).toEqual([1]);
		expect(v.groups).toEqual([]);
	});
});

describe('parsePositionFilter', () => {
	it('gaps never in group mode; type only if valid', () => {
		expect(parsePositionFilter(new URLSearchParams('gaps=1&type=Son'), ['Salsa'], true)).toEqual({
			q: ''
		});
		expect(parsePositionFilter(new URLSearchParams('gaps=1&type=Salsa'), ['Salsa'], false)).toEqual(
			{
				q: '',
				type: 'Salsa',
				gaps: '1'
			}
		);
		expect(parsePositionFilter(new URLSearchParams(`type=${OTHER_TYPE}`), [], false).type).toBe(
			OTHER_TYPE
		);
	});
});
