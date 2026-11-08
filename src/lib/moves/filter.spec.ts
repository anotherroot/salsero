import { describe, expect, it } from 'vitest';
import { figureMatches, figuresView, parseFigureFilter, type FiguresLists } from './filter';
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
