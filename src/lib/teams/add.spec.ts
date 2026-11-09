import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { addItemKind, addSections, figuresCaption, holdsLine, newLine } from './add';
import type { AddItem } from '$lib/types';

const item = (kind: AddItem['kind'], id: number): AddItem => ({
	kind,
	id,
	name: `${kind} ${id}`,
	ticked: kind !== 'figure'
});

describe('holdsLine', () => {
	it('says what the lesson holds, in order, plural where due', () => {
		expect(holdsLine({ videos: 1, sections: 6, figures: 5, routines: 1, drills: 2 })).toBe(
			'1 video · 6 sections · 5 figures · 1 routine · 2 drills'
		);
	});
	it('leaves zeros out, and says so when there is nothing', () => {
		expect(holdsLine({ videos: 0, sections: 0, figures: 1, routines: 0, drills: 0 })).toBe(
			'1 figure'
		);
		expect(holdsLine({ videos: 0, sections: 0, figures: 0, routines: 0, drills: 0 })).toBe(
			'Nothing in it yet'
		);
	});
});

describe('addSections', () => {
	it('puts the lesson, routines and drills on Today and the figures apart', () => {
		const s = addSections([
			item('lesson', 1),
			item('routine', 2),
			item('drill', 3),
			item('figure', 4)
		]);
		expect(s.today.map((i) => i.kind)).toEqual(['lesson', 'routine', 'drill']);
		expect(s.figures.map((i) => i.id)).toEqual([4]);
	});
});

describe('newLine', () => {
	it('counts new drills and routines', () => {
		expect(newLine([item('drill', 1)])).toBe('1 new drill');
		expect(newLine([item('drill', 1), item('drill', 2)])).toBe('2 new drills');
		expect(newLine([item('routine', 3), item('drill', 1)])).toBe('1 new routine · 1 new drill');
	});
});

// Catches: the Add sheet in English for a Slovenian member, or a count not in its
// Slovenian form (an adjective agreeing with it included).
describe('the Add sheet in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('says what the lesson holds in four forms', () => {
		expect(
			sl(() => holdsLine({ videos: 1, sections: 6, figures: 5, routines: 1, drills: 2 }))
		).toBe('1 video · 6 odsekov · 5 figur · 1 kombinacija · 2 vaji');
		expect(
			sl(() => holdsLine({ videos: 2, sections: 3, figures: 2, routines: 5, drills: 4 }))
		).toBe('2 videa · 3 odseki · 2 figuri · 5 kombinacij · 4 vaje');
		expect(
			sl(() => holdsLine({ videos: 0, sections: 0, figures: 0, routines: 0, drills: 0 }))
		).toBe('V njej še ni ničesar');
	});

	it('says what is new, the adjective agreeing with the count', () => {
		const drills = (n: number) => Array.from({ length: n }, (_, i) => item('drill', i + 1));
		expect(sl(() => [1, 2, 3, 5].map((n) => newLine(drills(n))))).toEqual([
			'1 nova vaja',
			'2 novi vaji',
			'3 nove vaje',
			'5 novih vaj'
		]);
		expect(sl(() => newLine([item('routine', 3), item('routine', 4), item('drill', 1)]))).toBe(
			'2 novi kombinaciji · 1 nova vaja'
		);
		expect(sl(() => newLine([5, 6, 7, 8, 9].map((i) => item('routine', i))))).toBe(
			'5 novih kombinacij'
		);
	});

	it('names each row’s kind and the figures’ caption', () => {
		expect(sl(() => (['lesson', 'routine', 'figure', 'drill'] as const).map(addItemKind))).toEqual([
			'Ponavljanje lekcije',
			'Kombinacija',
			'Figura',
			'Vaja'
		]);
		expect(sl(figuresCaption)).toBe(
			'Neoznačene figure so še vedno v zavihku Figure, pod skupino. Ne zasedajo vašega prostora.'
		);
	});
});
