import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	figuresEmpty,
	figuresHeading,
	filterChips,
	filterQuery,
	showTiles,
	tileMetas,
	styleLabelsOf,
	type FigureFilter
} from './figures';

const none: FigureFilter = { q: '' };
const keys = (f: FigureFilter) =>
	filterChips(f, ['salsa', 'son', 'other'], { salsa: 'Salsa', son: 'Son', other: 'Other' }, 5);

describe('filterChips', () => {
	it('is All, Not linked, the styles, With partner, Solo', () => {
		expect(keys(none).map((c) => c.label)).toEqual([
			'All',
			'Not linked',
			'Salsa',
			'Son',
			'Other',
			'With partner',
			'Solo'
		]);
		expect(keys(none).map((c) => c.key)).toEqual([
			'all',
			'unlinked',
			'style:salsa',
			'style:son',
			'style:other',
			'partner:partner',
			'partner:solo'
		]);
	});

	it('counts Not linked and turns it on', () => {
		expect(keys(none)[1]).toMatchObject({ count: 5, on: false, change: { unlinked: '1' } });
		expect(keys({ q: '', unlinked: '1' })[1]).toMatchObject({
			on: true,
			change: { unlinked: undefined }
		});
	});

	it('lights All only when nothing but a search is set', () => {
		expect(keys(none)[0].on).toBe(true);
		expect(keys({ q: 'en' })[0].on).toBe(true);
		expect(keys({ q: '', partner: 'solo' })[0].on).toBe(false);
		expect(keys({ q: '', unlinked: '1' })[0].on).toBe(false);
	});

	it('toggles a style off, and replaces it with another', () => {
		const son: FigureFilter = { q: 'en', style: 'son' };
		expect(keys(son).find((c) => c.key === 'style:son')).toMatchObject({
			on: true,
			change: { style: undefined }
		});
		expect(keys(son).find((c) => c.key === 'style:salsa')!.change).toEqual({ style: 'salsa' });
	});

	it('toggles partner the same way', () => {
		const solo: FigureFilter = { q: '', partner: 'solo' };
		expect(keys(solo).find((c) => c.key === 'partner:solo')).toMatchObject({
			on: true,
			change: { partner: undefined }
		});
		expect(keys(solo).find((c) => c.key === 'partner:partner')!.change).toEqual({
			partner: 'partner'
		});
	});
});

describe('filterQuery', () => {
	const son: FigureFilter = { q: 'en', style: 'son' };

	it('keeps the search when All clears the chips', () => {
		expect(filterQuery(son, keys(son)[0].change)).toBe('q=en');
		expect(filterQuery({ q: 'en', partner: 'solo', unlinked: '1' }, keys(son)[0].change)).toBe(
			'q=en'
		);
	});

	it('keeps the search when a chip is picked', () => {
		expect(filterQuery(son, { partner: 'solo' })).toBe('q=en&style=son&partner=solo');
		expect(filterQuery(son, { unlinked: '1' })).toBe('q=en&style=son&unlinked=1');
	});

	it('is empty when nothing is set', () => {
		expect(filterQuery(none, {})).toBe('');
		expect(filterQuery({ q: 'en' }, { q: '' })).toBe('');
	});

	it('encodes the search', () => {
		expect(filterQuery(none, { q: 'dile que no & co' })).toBe('q=dile%20que%20no%20%26%20co');
	});
});

describe('figuresHeading', () => {
	it('counts figures, matches, or the unlinked', () => {
		const n = (figures: number) => ({ moves: 2, figures });
		expect(figuresHeading(n(41), none)).toBe('Yours · 41 figures');
		expect(figuresHeading(n(1), none)).toBe('Yours · 1 figure');
		expect(figuresHeading(n(1), { q: 'dile' })).toBe('1 figure matches');
		expect(figuresHeading(n(3), { q: 'en' })).toBe('3 figures match');
		expect(figuresHeading(n(5), { q: '', style: 'son' })).toBe('5 figures match');
		expect(figuresHeading(n(4), { q: '', unlinked: '1' })).toBe('4 with no section or no lesson');
	});
});

describe('figuresEmpty', () => {
	it('picks the empty state', () => {
		expect(figuresEmpty(0, none)).toBe('none');
		expect(figuresEmpty(0, { q: '', unlinked: '1' })).toBe('all-linked');
		expect(figuresEmpty(0, { q: '', unlinked: '1', style: 'son' })).toBe('no-match');
		expect(figuresEmpty(0, { q: 'zz' })).toBe('no-match');
		expect(figuresEmpty(0, { q: '', partner: 'solo' })).toBe('no-match');
		expect(figuresEmpty(3, none)).toBeNull();
	});
});

describe('showTiles', () => {
	it('shows the tiles only with no search and a non-empty list', () => {
		expect(showTiles(41, none)).toBe(true);
		expect(showTiles(4, { q: '', unlinked: '1' })).toBe(true);
		expect(showTiles(3, { q: 'en' })).toBe(false);
		expect(showTiles(0, none)).toBe(false);
	});
});

describe('tileMetas', () => {
	it('gives the Coverage tile, the only one, its count', () => {
		expect(tileMetas(7)).toEqual({ coverage: { text: '7 in no routine', status: true } });
		expect(tileMetas(0).coverage).toEqual({ text: 'All in a routine', status: false });
		expect(tileMetas(1).coverage.text).toBe('1 in no routine');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('words the chips, the styles that differ included', () => {
		const chips = sl(() =>
			filterChips(
				none,
				['salsa', 'son', 'other'],
				styleLabelsOf({ salsa: 'Salsa', son: 'Son', other: 'Other' }),
				5
			)
		);
		expect(chips.map((c) => c.label)).toEqual([
			'Vse',
			'Nepovezane',
			'Salsa',
			'Son',
			'Drugo',
			'V paru',
			'Solo'
		]);
	});

	it("keeps a dance's own style labels in English", () => {
		const labels = { dominican: 'Dominican', sensual: 'Sensual', traditional: 'Traditional' };
		expect(styleLabelsOf(labels)).toEqual(labels);
		expect(sl(() => styleLabelsOf(labels))).toEqual({
			dominican: 'Dominikanska',
			sensual: 'Senzualna',
			traditional: 'Tradicionalna'
		});
	});

	it('puts the unlinked count after a colon', () => {
		expect(sl(() => figuresHeading({ moves: 2, figures: 4 }, { q: '', unlinked: '1' }))).toBe(
			'Brez odseka ali lekcije: 4'
		);
		expect(sl(() => figuresHeading({ moves: 2, figures: 3 }, { q: 'en' }))).toBe(
			'3 figure ustrezajo'
		);
	});

	it("words the Coverage tile's meta", () => {
		expect(sl(() => tileMetas(7))).toEqual({
			coverage: { text: 'Brez kombinacije: 7', status: true }
		});
		expect(sl(() => tileMetas(0)).coverage.text).toBe('Vse so v kombinacijah');
	});
});
