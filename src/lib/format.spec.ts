import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
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
		expect(setSummary({ durationS: 600, reps: 8, rating: 4 })).toBe(
			"10 min · 8 reps · I've got it"
		);
		expect(setSummary({ durationS: null, reps: null, rating: 1 })).toBe('Still hard');
		expect(setSummary({ durationS: null, reps: null, rating: 5 })).not.toContain('★');
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

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('writes a day as "tor, 22. sep." and a date as "22. sep. 2026"', () => {
		expect(sl(() => dayLabel('2026-09-22'))).toBe('tor, 22. sep.');
		expect(sl(() => dateLabel('2026-09-22'))).toBe('22. sep. 2026');
		expect(sl(() => classDayLabel('2025-12-30', '2026-01-02'))).toBe('tor, 30. dec. 2025');
		expect(sl(() => dayMonth('2026-10-26'))).toBe('26. okt.');
		expect(sl(() => weekdayShort('2026-10-28'))).toBe('sre');
	});

	it('spells weekdays and months out in lower case', () => {
		expect(sl(() => longDayLabel('2026-10-31'))).toBe('sobota, 31. oktobra');
		expect(sl(() => weekdayDayMonth('2026-10-13'))).toBe('torek, 13. oktobra');
		expect(sl(() => fullDateLabel('2026-10-28'))).toBe('28. oktobra 2026');
		expect(sl(() => monthLabel('2026-01-03'))).toBe('januar 2026');
		expect(sl(() => monthHeading('2025-12-30', '2026-11-04'))).toBe('december 2025');
	});

	// After a day number the month is genitive ("3. novembra"); alone it stays nominative.
	it('puts the month in the genitive after a day number, and every month has one', () => {
		const genitive = [
			'januarja',
			'februarja',
			'marca',
			'aprila',
			'maja',
			'junija',
			'julija',
			'avgusta',
			'septembra',
			'oktobra',
			'novembra',
			'decembra'
		];
		const days = genitive.map((_, m) => `2026-${String(m + 1).padStart(2, '0')}-03`);
		expect(sl(() => days.map((d) => fullDateLabel(d)))).toEqual(
			genitive.map((g) => `3. ${g} 2026`)
		);
		expect(sl(() => longDayLabel('2026-03-03'))).toBe('torek, 3. marca');
		expect(sl(() => weekdayDayMonth('2026-05-03'))).toBe('nedelja, 3. maja');
		expect(sl(() => monthHeading('2026-11-03', '2026-11-04'))).toBe('november');
		expect(sl(() => monthLabel('2026-03-03'))).toBe('marec 2026');
	});

	it('writes a size with a decimal comma', () => {
		expect(sl(() => byteSize(1288490189))).toBe('1,2 GB');
		expect(sl(() => byteSize(740 * 1024 * 1024))).toBe('740 MB');
	});

	it('says when it was last done, in the case "pred" takes', () => {
		expect(sl(() => lastDoneLabel(null))).toBe('Še nikoli');
		expect(sl(() => lastDoneLabel(0))).toBe('Danes');
		expect(sl(() => lastDoneLabel(1))).toBe('Včeraj');
		expect(sl(() => lastDoneLabel(2))).toBe('Pred 2 dnevoma');
		expect(sl(() => lastDoneLabel(3))).toBe('Pred 3 dnevi');
		expect(sl(() => lastDoneLabel(5))).toBe('Pred 5 dnevi');
	});

	it('counts reps in four forms and names the face', () => {
		expect(sl(() => setSummary({ durationS: 600, reps: 1, rating: 4 }))).toBe(
			'10 min · 1 ponovitev · Obvladam'
		);
		expect(sl(() => setSummary({ durationS: null, reps: 2, rating: null }))).toBe('2 ponovitvi');
		expect(sl(() => setSummary({ durationS: null, reps: 3, rating: null }))).toBe('3 ponovitve');
		expect(sl(() => setSummary({ durationS: null, reps: 5, rating: 1 }))).toBe(
			'5 ponovitev · Še težko'
		);
	});

	it('says how long ago', () => {
		const now = 10 * 24 * 60 * 60_000;
		expect(sl(() => agoText(now - 30_000, now))).toBe('pravkar');
		expect(sl(() => agoText(now - 5 * 60_000, now))).toBe('pred 5 min');
		expect(sl(() => agoText(now - 3 * 60 * 60_000, now))).toBe('pred 3 h');
		expect(sl(() => agoText(now - 30 * 60 * 60_000, now))).toBe('včeraj');
		expect(sl(() => agoText(now - 2 * 24 * 60 * 60_000, now))).toBe('pred 2 dnevoma');
		expect(sl(() => agoText(now - 4 * 24 * 60 * 60_000, now))).toBe('pred 4 dnevi');
	});
});
