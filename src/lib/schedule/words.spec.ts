import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { awayWords, backWords, dayWords, dueWords, earlyLine, gapWords, whenWords } from './words';

const TODAY = '2026-11-05'; // a Thursday
const state = (dueDay: string) => ({ gap: 5, lastDay: '2026-11-01', dueDay });

describe('gapWords', () => {
	it.each([
		[1, 'Tomorrow'],
		[3, '3 days'],
		[7, '1 week'],
		[10, '10 days'],
		[21, '3 weeks'],
		[60, '2 months'],
		[344, '11 months'],
		[345, '1 year'],
		[364, '1 year'],
		[365, '1 year'],
		[0, 'Tomorrow'],
		[-3, 'Tomorrow']
	])('%s -> %s', (d, w) => expect(gapWords(d)).toBe(w));
});
describe('backWords', () => {
	it.each([
		[1, 'Back tomorrow'],
		[3, 'Back in 3 days'],
		[7, 'Back in a week'],
		[14, 'Back in 2 weeks'],
		[60, 'Back in 2 months']
	])('%s -> %s', (d, w) => expect(backWords(d)).toBe(w));
});
describe('awayWords', () => {
	it.each([
		['2026-11-05', 'today'],
		['2026-11-06', 'tomorrow'],
		['2026-11-08', 'in 3 days'],
		['2026-11-12', 'in a week'],
		['2026-11-19', 'in 2 weeks'],
		['2027-03-05', 'in 4 months']
	])('%s -> %s', (d, w) => expect(awayWords(TODAY, d)).toBe(w));
});
describe('dayWords', () => {
	it('today, tomorrow, weekday, date, with the year when not this one', () => {
		expect(dayWords(TODAY, TODAY)).toBe('today');
		expect(dayWords('2026-11-03', TODAY)).toBe('today');
		expect(dayWords('2026-11-06', TODAY)).toBe('tomorrow');
		expect(dayWords('2026-11-08', TODAY)).toBe('Sunday');
		expect(dayWords('2026-11-11', TODAY)).toBe('Wednesday');
		expect(dayWords('2026-11-12', TODAY)).toBe('12 Nov');
		expect(dayWords('2027-01-14', TODAY)).toBe('14 Jan 2027');
	});
});
describe('dueWords', () => {
	it('New', () =>
		expect(dueWords(state(TODAY), TODAY, true)).toEqual([{ text: 'New', tone: 'status' }]));
	it('late', () => {
		expect(dueWords(state('2026-11-03'), TODAY, false)).toEqual([
			{ text: '2 days late', tone: 'status' }
		]);
		expect(dueWords(state('2026-11-04'), TODAY, false)[0].text).toBe('1 day late');
	});
	it('today, tomorrow, weekday, date', () => {
		expect(dueWords(state(TODAY), TODAY, false)[0].text).toBe('Due today');
		expect(dueWords(state('2026-11-06'), TODAY, false)[0].text).toBe('Due tomorrow');
		expect(dueWords(state('2026-11-08'), TODAY, false)[0].text).toBe('Due Sunday');
		expect(dueWords(state('2026-11-11'), TODAY, false)[0].text).toBe('Due Wednesday');
		expect(dueWords(state('2026-11-14'), TODAY, false)[0].text).toBe('Due 14 Nov');
		expect(dueWords(state('2027-01-14'), TODAY, false)[0].text).toBe('Due 14 Jan 2027');
	});
});
describe('earlyLine', () => {
	it('names the day it was due', () =>
		expect(earlyLine({ lastDay: '2026-11-04', dueDay: '2026-11-14' }, TODAY)).toBe(
			'Done early: you last did it yesterday, it was due on Saturday 14 Nov.'
		));
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it.each([
		[1, 'Jutri'],
		[2, '2 dneva'],
		[3, '3 dni'],
		[5, '5 dni'],
		[7, '1 teden'],
		[21, '3 tedne'],
		[60, '2 meseca'],
		[150, '5 mesecev'],
		[365, '1 leto']
	])('gapWords(%s) -> %s', (d, w) => expect(sl(() => gapWords(d))).toBe(w));

	it.each([
		[1, 'Spet jutri'],
		[3, 'Spet čez 3 dni'],
		[7, 'Spet čez en teden'],
		[14, 'Spet čez 2 tedna'],
		[30, 'Spet čez 4 tedne'],
		[90, 'Spet čez 3 mesece'],
		[400, 'Spet čez eno leto']
	])('backWords(%s) -> %s', (d, w) => expect(sl(() => backWords(d))).toBe(w));

	it('says how far away a day is', () => {
		expect(sl(() => awayWords(TODAY, '2026-11-05'))).toBe('danes');
		expect(sl(() => awayWords(TODAY, '2026-11-06'))).toBe('jutri');
		expect(sl(() => awayWords(TODAY, '2026-11-08'))).toBe('čez 3 dni');
		expect(sl(() => awayWords(TODAY, '2026-11-12'))).toBe('čez en teden');
	});

	it('names a day, and the day something happens on', () => {
		expect(sl(() => dayWords('2026-11-08', TODAY))).toBe('nedelja');
		expect(sl(() => dayWords('2026-11-12', TODAY))).toBe('12. nov.');
		expect(sl(() => dayWords('2027-01-14', TODAY))).toBe('14. jan. 2027');
		expect(sl(() => whenWords('2026-11-08', TODAY))).toBe('v nedeljo');
		expect(sl(() => whenWords('2026-11-06', TODAY))).toBe('jutri');
	});

	it('says what is due, late or new', () => {
		expect(sl(() => dueWords(state(TODAY), TODAY, true))).toEqual([
			{ text: 'Nova', tone: 'status' }
		]);
		expect(sl(() => dueWords(state('2026-11-04'), TODAY, false)[0].text)).toBe('1 dan zamude');
		expect(sl(() => dueWords(state('2026-11-03'), TODAY, false)[0].text)).toBe('2 dneva zamude');
		expect(sl(() => dueWords(state(TODAY), TODAY, false)[0].text)).toBe('Na vrsti danes');
		expect(sl(() => dueWords(state('2026-11-08'), TODAY, false)[0].text)).toBe(
			'Na vrsti v nedeljo'
		);
		expect(sl(() => dueWords(state('2026-11-14'), TODAY, false)[0].text)).toBe('Na vrsti 14. nov.');
	});

	it('names the day an early one was due', () =>
		expect(sl(() => earlyLine({ lastDay: '2026-11-04', dueDay: '2026-11-14' }, TODAY))).toBe(
			'Opravljeno prej: zadnji vnos včeraj, na vrsti je bila v soboto, 14. nov.'
		));
});

describe('whenWords', () => {
	it('is dayWords in English', () => {
		expect(whenWords('2026-11-08', TODAY)).toBe('Sunday');
		expect(whenWords(TODAY, TODAY)).toBe('today');
	});
});
