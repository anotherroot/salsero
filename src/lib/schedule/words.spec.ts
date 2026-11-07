import { describe, expect, it } from 'vitest';
import { awayWords, backWords, dayWords, dueWords, earlyLine, gapWords } from './words';

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
	it('past its day it reads Due today, never late', () => {
		expect(dueWords(state('2026-10-16'), TODAY, false)).toEqual([
			{ text: 'Due today', tone: null }
		]);
		expect(dueWords(state('2026-11-04'), TODAY, false)[0].text).toBe('Due today');
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
