import { describe, expect, it } from 'vitest';
import {
	agoText,
	byteSize,
	classDayLabel,
	clock,
	dateLabel,
	dayMonth,
	dayLabel,
	fullDateLabel,
	lastDoneLabel,
	longDayLabel,
	monthHeading,
	monthLabel,
	plural,
	setSummary,
	weekdayDayMonth,
	weekdayShort
} from './format';

describe('format', () => {
	it('labels last-done in calendar words', () => {
		expect(lastDoneLabel(null)).toBe('Never done');
		expect(lastDoneLabel(0)).toBe('Today');
		expect(lastDoneLabel(1)).toBe('Yesterday');
		expect(lastDoneLabel(4)).toBe('4 days ago');
	});

	it('summarises only the fields that were filled', () => {
		expect(setSummary({ durationS: null, reps: null, rating: null })).toBe('');
		expect(setSummary({ durationS: 600, reps: 8, rating: 3 })).toBe('10 min · 8 reps · ★★★');
	});

	it('rounds a short duration up to 1 min rather than down to 0, like minutesFrom', () => {
		expect(setSummary({ durationS: 15, reps: null, rating: null })).toBe('1 min');
	});

	it('labels a day without shifting it through a zone', () => {
		expect(dayLabel('2026-09-22')).toBe('Tue 22 Sep');
		expect(dateLabel('2026-01-05')).toBe('5 Jan 2026');
	});

	it('labels a class day with its weekday, and the year only when it is not this year', () => {
		expect(classDayLabel('2026-10-28', '2026-10-30')).toBe('Wed 28 Oct');
		expect(classDayLabel('2025-12-30', '2026-01-02')).toBe('Tue 30 Dec 2025');
	});

	it('prints a song position as m:ss', () => {
		expect(clock(0)).toBe('0:00');
		expect(clock(65.9)).toBe('1:05');
		expect(clock(600)).toBe('10:00');
	});
});

describe('byteSize', () => {
	it('says 0 MB for nothing at all', () => {
		expect(byteSize(0)).toBe('0 MB');
	});

	it('does not round a small file away to nothing', () => {
		expect(byteSize(200 * 1024)).toBe('<1 MB');
	});

	it('rounds to whole megabytes below a gigabyte', () => {
		expect(byteSize(740 * 1024 * 1024)).toBe('740 MB');
	});

	it('switches to gigabytes with one decimal, where lesson videos live', () => {
		expect(byteSize(1.2 * 1024 * 1024 * 1024)).toBe('1.2 GB');
		expect(byteSize(1024 * 1024 * 1024)).toBe('1.0 GB');
	});
});

describe('longDayLabel', () => {
	it('spells out the weekday and month', () => {
		expect(longDayLabel('2026-10-31')).toBe('Saturday, 31 October');
		expect(longDayLabel('2027-01-03')).toBe('Sunday, 3 January');
	});

	it('shortens a day to day and month', () => {
		expect(dayMonth('2026-10-26')).toBe('26 Oct');
	});
});

describe('fullDateLabel, monthLabel, weekdayShort', () => {
	it('spell a day out by hand', () => {
		expect(fullDateLabel('2026-10-28')).toBe('28 October 2026');
		expect(monthLabel('2026-01-03')).toBe('January 2026');
		expect(weekdayShort('2026-10-28')).toBe('Wed');
	});
	it('names a class day in full with no comma, and a month without this year', () => {
		expect(weekdayDayMonth('2026-10-13')).toBe('Tuesday 13 October');
		expect(weekdayDayMonth('2027-01-03')).toBe('Sunday 3 January');
		expect(monthHeading('2026-11-03', '2026-11-04')).toBe('November');
		expect(monthHeading('2025-12-30', '2026-11-04')).toBe('December 2025');
	});
});

describe('plural', () => {
	it('picks the word by the count', () => {
		expect(plural(1, 'slot', 'slots')).toBe('1 slot');
		expect(plural(4, 'slot', 'slots')).toBe('4 slots');
		expect(plural(0, 'routine', 'routines')).toBe('0 routines');
	});
});

describe('agoText', () => {
	const now = 10 * 24 * 60 * 60_000;
	it('reads minutes, hours, yesterday and days', () => {
		expect(agoText(now - 30_000, now)).toBe('just now');
		expect(agoText(now - 10 * 60_000, now)).toBe('10 min ago');
		expect(agoText(now - 3 * 60 * 60_000, now)).toBe('3 h ago');
		expect(agoText(now - 30 * 60 * 60_000, now)).toBe('yesterday');
		expect(agoText(now - 4 * 24 * 60 * 60_000, now)).toBe('4 days ago');
		// A clock a little behind another device's never reads "in the future".
		expect(agoText(now + 5_000, now)).toBe('just now');
	});
});
