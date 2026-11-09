import { describe, expect, it } from 'vitest';
import {
	figureMatches,
	figuresView,
	mergeGroups,
	parseFigureFilter,
	type FiguresLists
} from './filter';
import type { FigureRow, MoveRow } from '$lib/types';

const fig = (id: number, name: string, o: Partial<FigureRow> = {}): FigureRow => ({
	id,
	name,
	label: name,
	from: null,
	startCount: null,
	lengthCounts: null,
	recordings: 0,
	hasSection: true,
	hasLesson: true,
	partner: 'partner',
	style: 'On1',
	...o
});
const move = (id: number, name: string, figures: FigureRow[]): MoveRow => ({ id, name, figures });
const lists = (o: Partial<FiguresLists> = {}): FiguresLists => ({
	mine: [
		move(1, 'Enchufla', [
			fig(11, 'Doble', { style: 'On2', partner: 'solo', hasLesson: false }),
			fig(12, 'Básico')
		])
	],
	groups: [],
	sets: [],
	groupMode: false,
	unlinked: 0,
	unrouted: 0,
	defaultStyle: 'On1',
	moveTargets: [],
	...o
});
const names = (v: ReturnType<typeof figuresView>) =>
	v.figures.flatMap((m) => m.figures.map((f) => f.name));

describe('figuresView', () => {
	it('the search matches the move or the figure', () => {
		expect(names(figuresView(lists(), { q: 'ench' }))).toEqual(['Doble', 'Básico']);
		expect(names(figuresView(lists(), { q: 'DOB' }))).toEqual(['Doble']);
		expect(figuresView(lists(), { q: 'x' }).figures).toEqual([]);
	});
	it('style and partner filter', () => {
		expect(names(figuresView(lists(), { q: '', style: 'On2' }))).toEqual(['Doble']);
		expect(names(figuresView(lists(), { q: '', partner: 'solo' }))).toEqual(['Doble']);
	});
	it('Not linked drops a fully linked figure and empties the groups', () => {
		const l = lists({
			groups: [{ team: { id: 5, name: 'Tue' }, moves: [move(9, 'Cerrada', [fig(21, 'Uno')])] }]
		});
		const v = figuresView(l, { q: '', unlinked: '1' });
		expect(names(v)).toEqual(['Doble']);
		expect(v.groups).toEqual([]);
		expect(figuresView(l, { q: '' }).groups).toHaveLength(1);
	});
	it('twins fold after the filter', () => {
		const l = lists({
			mine: [move(1, 'Cerrada', [fig(1, 'Cerrada')])],
			groups: [{ team: { id: 5, name: 'Tue' }, moves: [move(2, 'Closed', [fig(2, 'Closed')])] }],
			sets: [[1, 2]]
		});
		const hit = figuresView(l, { q: 'closed' });
		expect(hit.figures).toEqual([]);
		expect(hit.groups[0].moves[0].figures.map((f) => f.id)).toEqual([2]);
		expect(hit.twinned).toEqual([]);
		const all = figuresView(l, { q: '' });
		expect(all.figures[0].figures.map((f) => f.id)).toEqual([1]);
		expect(all.twinned).toEqual([1]);
	});
	it('group mode keeps membersSee and never folds', () => {
		const l = lists({
			groupMode: true,
			unrouted: null,
			mine: [move(1, 'A', [fig(1, 'A', { membersSee: true }), fig(2, 'B')])],
			sets: [[1, 2]]
		});
		const v = figuresView(l, { q: '' });
		expect(v.figures[0].figures.map((f) => f.membersSee)).toEqual([true, undefined]);
		expect(v.figures[0].also).toEqual([]);
		expect(v.groups).toEqual([]);
		expect(v.twinned).toEqual([]);
	});
});

describe('figureMatches', () => {
	it('is case-blind on the move and the figure', () => {
		expect(figureMatches('Enchufla', fig(1, 'Doble'), { q: 'ENCH' })).toBe(true);
		expect(figureMatches('Enchufla', fig(1, 'Doble'), { q: 'zzz' })).toBe(false);
	});
});

describe('parseFigureFilter', () => {
	it('keeps only what is valid', () => {
		expect(
			parseFigureFilter(new URLSearchParams('style=Nope&partner=solo&unlinked=2'), ['On1'])
		).toEqual({ q: '', partner: 'solo' });
		expect(
			parseFigureFilter(new URLSearchParams('q=%20en%20&style=On1&unlinked=1'), ['On1'])
		).toEqual({ q: 'en', style: 'On1', unlinked: '1' });
	});
});

describe('mergeGroups', () => {
	const shown = (m: MoveRow) => ({ ...m, also: [] as string[] });
	const tue = { id: 5, name: 'Tue' };
	const wed = { id: 6, name: 'Wed' };
	it('a group move of the same name joins the person’s, its figures after theirs and marked', () => {
		const out = mergeGroups(
			[shown(move(1, 'Enchufla', [fig(11, 'Doble')]))],
			[{ team: tue, moves: [shown(move(9, ' enchufla', [fig(21, 'Uno')]))] }]
		);
		expect(out).toHaveLength(1);
		expect(out[0].id).toBe(1);
		expect(out[0].figures.map((f) => [f.id, f.team?.name ?? null])).toEqual([
			[11, null],
			[21, 'Tue']
		]);
	});
	it('a group move of its own name sits among the person’s by name; two groups share one', () => {
		const out = mergeGroups(
			[shown(move(1, 'Enchufla', [fig(11, 'Doble')])), shown(move(2, 'Setenta', [fig(12, 'A')]))],
			[
				{ team: tue, moves: [shown(move(9, 'Dile que no', [fig(21, 'Uno')]))] },
				{ team: wed, moves: [shown(move(8, 'Dile que no', [fig(31, 'Dos')]))] }
			]
		);
		expect(out.map((m) => [m.id, m.name])).toEqual([
			[9, 'Dile que no'],
			[1, 'Enchufla'],
			[2, 'Setenta']
		]);
		expect(out[0].figures.map((f) => f.team?.name)).toEqual(['Tue', 'Wed']);
	});
	it('keeps where twins folded in', () => {
		const out = mergeGroups(
			[{ ...move(1, 'A', [fig(1, 'A')]), also: ['Tue'] }],
			[{ team: wed, moves: [{ ...move(2, 'a', [fig(2, 'B')]), also: ['Tue', 'Rueda'] }] }]
		);
		expect(out[0].also).toEqual(['Tue', 'Rueda']);
	});
});
