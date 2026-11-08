// Every area of the English catalog has its Slovenian twin: the same keys all
// the way down, no string left in English, and every function drawing a string.
import { describe, expect, it } from 'vitest';
import { catalogOf, t } from './catalog';
import { withLocale } from './current';
import { readDecimal } from './number';

/**
 * Paths whose Slovenian is the same as the English, each because the word is
 * genuinely the same in both. A new entry needs its reason.
 */
const ALLOWED_SAME: ReadonlySet<string> = new Set([
	// ⋯ is a symbol in both languages.
	'common.more',
	// "Solo" is the word in Slovenian too (a solo figure, a chip).
	'moves.chips.solo'
]);

/**
 * Arguments for a function leaf that `1` or `'x'` cannot draw: a unit from a
 * union, a list. Every other function is drawn with `1` in each place, then `'x'`.
 */
const SAMPLE_ARGS: Readonly<Record<string, unknown[]>> = {
	'format.span': [2, 'day'],
	'format.inSpan': [2, 'week'],
	'settings.voice.leaveSilent': [[2, 6]],
	'groups.leave.everything': [['x'], 'x'],
	'groups.leave.used': [['x'], null],
	'moves.heading.alsoIn': ['x', ['y']],
	'moves.move.and': [['x', 'y']],
	'figure.relations.slots': [[2, 5], 8]
};

type Leaf = 'string' | 'function' | 'object' | 'other';

function kindOf(v: unknown): Leaf {
	if (typeof v === 'string') return 'string';
	if (typeof v === 'function') return 'function';
	if (v !== null && typeof v === 'object') return 'object';
	return 'other';
}

/** Every leaf by its path ("tabs.today"); arrays by index. */
function leaves(o: unknown, at = ''): [string, unknown][] {
	if (kindOf(o) !== 'object') return [[at, o]];
	return Object.entries(o as object).flatMap(([k, v]) => leaves(v, at ? `${at}.${k}` : k));
}

/** What a function leaf draws: its SAMPLE_ARGS, else `1` in each place, then `'x'`. */
function sample(path: string, fn: (...args: unknown[]) => unknown): unknown {
	const width = Math.max(fn.length, 1);
	const tries = SAMPLE_ARGS[path]
		? [SAMPLE_ARGS[path]]
		: [1, 'x'].map((arg) => Array.from({ length: width }, () => arg));
	for (const args of tries) {
		try {
			const out = fn(...args);
			if (typeof out === 'string') return out;
		} catch {
			// try the next sample
		}
	}
	return undefined;
}

/** Where `sl` differs in shape from `en` in `area`, or leaves an English string, as lines. */
function parityProblems(area: string, en: unknown, sl: unknown): string[] {
	const problems: string[] = [];
	const enLeaves = new Map(leaves(en, area));
	const slLeaves = new Map(leaves(sl, area));
	for (const path of enLeaves.keys()) if (!slLeaves.has(path)) problems.push(`missing: ${path}`);
	for (const path of slLeaves.keys()) if (!enLeaves.has(path)) problems.push(`extra: ${path}`);
	for (const [path, word] of enLeaves) {
		if (!slLeaves.has(path)) continue;
		const theirs = slLeaves.get(path);
		if (kindOf(word) !== kindOf(theirs)) {
			problems.push(`kind: ${path} is ${kindOf(word)} in en, ${kindOf(theirs)} in sl`);
			continue;
		}
		if (typeof word === 'string') {
			if (word === theirs && !ALLOWED_SAME.has(path)) problems.push(`english: ${path}`);
		} else if (typeof word === 'function') {
			if (typeof sample(path, word as never) !== 'string') problems.push(`no string: en ${path}`);
			if (typeof sample(path, theirs as never) !== 'string') problems.push(`no string: sl ${path}`);
		}
	}
	return problems;
}

describe('the catalogs', () => {
	const en = catalogOf('en');
	const sl = catalogOf('sl');

	it('have the same areas', () => {
		expect(Object.keys(sl).sort()).toEqual(Object.keys(en).sort());
	});

	it.each(Object.keys(en) as (keyof typeof en)[])(
		'%s: every English word in Slovenian, none left in English',
		(area) => {
			expect(parityProblems(area, en[area], sl[area])).toEqual([]);
		}
	);

	it('every ALLOWED_SAME path is a string, the same in both', () => {
		const enLeaves = new Map(leaves(en));
		const slLeaves = new Map(leaves(sl));
		for (const path of ALLOWED_SAME) {
			expect(enLeaves.get(path), path).toBeTypeOf('string');
			expect(slLeaves.get(path), path).toBe(enLeaves.get(path));
		}
	});

	it('every SAMPLE_ARGS path is a function', () => {
		const enLeaves = new Map(leaves(en));
		for (const path of Object.keys(SAMPLE_ARGS))
			expect(enLeaves.get(path), path).toBeTypeOf('function');
	});

	it('finds a key removed from sl, a string left in English, a function that draws nothing', () => {
		const common = { ...sl.common } as Record<string, unknown>;
		delete common.save;
		expect(parityProblems('common', en.common, common)).toEqual(['missing: common.save']);

		const nouns = { ...sl.nouns } as Record<string, unknown>;
		delete nouns.figures;
		expect(parityProblems('nouns', en.nouns, nouns)).toEqual(['missing: nouns.figures']);

		expect(parityProblems('common', en.common, { ...sl.common, cancel: 'Cancel' })).toEqual([
			'english: common.cancel'
		]);
		expect(parityProblems('nouns', en.nouns, { ...sl.nouns, slots: () => 3 })).toEqual([
			'no string: sl nouns.slots'
		]);
		expect(parityProblems('nouns', en.nouns, { ...sl.nouns, slots: 'mesto' })).toEqual([
			'kind: nouns.slots is function in en, string in sl'
		]);
		expect(parityProblems('common', en.common, { ...sl.common, extra: 'x' })).toEqual([
			'extra: common.extra'
		]);
	});
});

describe('nouns', () => {
	const sl = <T>(fn: () => T): T => withLocale('sl', fn);
	const each = (noun: keyof ReturnType<typeof t>['nouns'], ns: number[]) =>
		sl(() => ns.map((n) => t().nouns[noun](n)));

	it('counts a figure (različica) in all four forms, 101 like 1, 102 like 2', () => {
		expect(each('figures', [1, 2, 3, 5, 101, 102])).toEqual([
			'1 različica',
			'2 različici',
			'3 različice',
			'5 različic',
			'101 različica',
			'102 različici'
		]);
	});

	it.each([
		['routines', ['1 kombinacija', '2 kombinaciji', '3 kombinacije', '5 kombinacij']],
		['recordings', ['1 posnetek', '2 posnetka', '3 posnetki', '5 posnetkov']],
		['videos', ['1 video', '2 videa', '3 videi', '5 videov']],
		['positions', ['1 položaj', '2 položaja', '3 položaji', '5 položajev']],
		['people', ['1 oseba', '2 osebi', '3 osebe', '5 oseb']],
		['slots', ['1 mesto', '2 mesti', '3 mesta', '5 mest']],
		[
			'timingBreaks',
			[
				'1 časovna prekinitev',
				'2 časovni prekinitvi',
				'3 časovne prekinitve',
				'5 časovnih prekinitev'
			]
		]
	] as const)('%s', (noun, words) => {
		expect(each(noun, [1, 2, 3, 5])).toEqual(words);
	});

	it('counts a length in dobe', () => {
		expect(each('counts', [1, 2, 3, 8])).toEqual(['1 doba', '2 dobi', '3 dobe', '8 dob']);
	});

	it('the other nouns, in all four forms', () => {
		const forms = (noun: Parameters<typeof each>[0]) => each(noun, [1, 2, 3, 5]);
		expect(forms('moves')).toEqual(['1 figura', '2 figuri', '3 figure', '5 figur']);
		expect(forms('drills')).toEqual(['1 vaja', '2 vaji', '3 vaje', '5 vaj']);
		expect(forms('lessons')).toEqual(['1 lekcija', '2 lekciji', '3 lekcije', '5 lekcij']);
		expect(forms('sections')).toEqual(['1 odsek', '2 odseka', '3 odseki', '5 odsekov']);
		expect(forms('points')).toEqual(['1 točka', '2 točki', '3 točke', '5 točk']);
		expect(forms('songs')).toEqual(['1 skladba', '2 skladbi', '3 skladbe', '5 skladb']);
		expect(forms('groups')).toEqual(['1 skupina', '2 skupini', '3 skupine', '5 skupin']);
		expect(forms('breaks')).toEqual([
			'1 prekinitev',
			'2 prekinitvi',
			'3 prekinitve',
			'5 prekinitev'
		]);
		expect(forms('changes')).toEqual(['1 sprememba', '2 spremembi', '3 spremembe', '5 sprememb']);
		expect(forms('differences')).toEqual(['1 razlika', '2 razliki', '3 razlike', '5 razlik']);
		expect(forms('links')).toEqual(['1 povezava', '2 povezavi', '3 povezave', '5 povezav']);
		expect(forms('copies')).toEqual(['1 kopija', '2 kopiji', '3 kopije', '5 kopij']);
		expect(forms('matches')).toEqual(['1 zadetek', '2 zadetka', '3 zadetki', '5 zadetkov']);
	});

	it('English is what plural() gives today', () => {
		const n = t().nouns;
		expect([n.figures(1), n.figures(2), n.figures(0)]).toEqual([
			'1 figure',
			'2 figures',
			'0 figures'
		]);
		expect([n.people(1), n.people(3)]).toEqual(['1 person', '3 people']);
		expect([n.copies(1), n.copies(2)]).toEqual(['1 copy', '2 copies']);
		expect([n.timingBreaks(1), n.timingBreaks(2)]).toEqual(['1 timing break', '2 timing breaks']);
		expect([n.drills(1), n.drills(2)]).toEqual(['1 drill', '2 drills']);
		expect([n.counts(8), n.slots(1), n.matches(2)]).toEqual(['8 counts', '1 slot', '2 matches']);
	});
});

describe('readDecimal', () => {
	it.each([
		['1,5', 1.5],
		['1.5', 1.5],
		[' 2 ', 2],
		['0,25', 0.25],
		['10', 10]
	])('reads %j as %d', (raw, x) => {
		expect(readDecimal(raw)).toBe(x);
	});

	it.each(['1,5,2', '1.5.2', '1,5.2', '', '   ', 'abc', ',5', '1,', '-1', '1 5', '1e3'])(
		'refuses %j',
		(raw) => {
			expect(readDecimal(raw)).toBeNull();
		}
	);
});
