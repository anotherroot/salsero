import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { figureRowMeta, figureRowParts, movesHeading } from './list';

const base = {
	startCount: null,
	lengthCounts: null,
	recordings: 0,
	hasSection: true,
	hasLesson: true
};

describe('figureRowMeta', () => {
	it('names the start, the length and the recordings', () => {
		expect(figureRowMeta({ ...base, startCount: 1, lengthCounts: 16, recordings: 2 })).toBe(
			'Starts on 1 · 16 counts · 2 recordings'
		);
	});
	it('omits what is unknown', () => {
		expect(figureRowMeta(base)).toBe('');
		expect(figureRowMeta({ ...base, startCount: 5 })).toBe('Starts on 5');
		expect(figureRowMeta({ ...base, lengthCounts: 1, recordings: 1 })).toBe(
			'1 count · 1 recording'
		);
	});
	it('appends what it lacks, as status parts', () => {
		const f = { ...base, startCount: 1, lengthCounts: 8, hasSection: false };
		expect(figureRowMeta(f)).toBe('Starts on 1 · 8 counts · No section');
		expect(figureRowParts({ ...f, hasLesson: false }).filter((p) => p.status)).toEqual([
			{ text: 'No section', status: true },
			{ text: 'No lesson', status: true }
		]);
	});
});

describe('movesHeading', () => {
	it('counts figures, with Yours, or matches', () => {
		expect(movesHeading({ moves: 5, figures: 14 }, false)).toBe('Yours · 14 figures');
		expect(movesHeading({ moves: 5, figures: 14 }, true)).toBe('14 figures match');
		expect(movesHeading({ moves: 1, figures: 1 }, false)).toBe('Yours · 1 figure');
		expect(movesHeading({ moves: 1, figures: 1 }, true)).toBe('1 figure matches');
		expect(movesHeading({ moves: 1, figures: 2 }, false, null)).toBe('2 figures');
	});
});

describe('moveMeta', () => {
	it('says where else a move is, its figures counted once (board C7 p3)', async () => {
		const { moveMeta } = await import('./list');
		expect(moveMeta(3, ['Salsa Tuesdays', 'Rueda club'])).toBe(
			'3 figures · also in Salsa Tuesdays, Rueda club'
		);
		expect(moveMeta(1, ['Salsa Tuesdays'])).toBe('1 figure · also in Salsa Tuesdays');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('agrees the verb with the count while matching', () => {
		const h = (figures: number) => sl(() => movesHeading({ moves: 1, figures }, true));
		expect(h(1)).toBe('1 različica ustreza');
		expect(h(2)).toBe('2 različici ustrezata');
		expect(h(3)).toBe('3 različice ustrezajo');
		expect(h(5)).toBe('5 različic ustreza');
		expect(h(101)).toBe('101 različica ustreza');
	});

	it('says Vaše over the list, and no owner word in a group', () => {
		expect(sl(() => movesHeading({ moves: 5, figures: 14 }, false))).toBe('Vaše · 14 različic');
		expect(sl(() => movesHeading({ moves: 1, figures: 2 }, false, null))).toBe('2 različici');
	});

	it('counts dobe and posnetki in a row meta', () => {
		expect(
			sl(() => figureRowMeta({ ...base, startCount: 1, lengthCounts: 2, recordings: 2 }))
		).toBe('Začne na 1 · 2 dobi · 2 posnetka');
		expect(sl(() => figureRowMeta({ ...base, lengthCounts: 16, recordings: 5 }))).toBe(
			'16 dob · 5 posnetkov'
		);
	});

	it('names what a row lacks, and a copy that differs', () => {
		const parts = sl(() =>
			figureRowParts({ ...base, hasSection: false, hasLesson: false, differ: 3 })
		);
		expect(parts.map((p) => p.text)).toEqual([
			'Brez odseka',
			'Brez lekcije',
			'3 kopije se razlikujejo'
		]);
	});

	it('says where else a move is, the groups after a colon', async () => {
		const { moveMeta } = await import('./list');
		expect(sl(() => moveMeta(1, ['Salsa torek']))).toBe(
			'1 različica · tudi v skupini: Salsa torek'
		);
		expect(sl(() => moveMeta(3, ['Salsa torek', 'Rueda']))).toBe(
			'3 različice · tudi v skupinah: Salsa torek, Rueda'
		);
	});
});
