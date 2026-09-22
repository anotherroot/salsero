import { describe, expect, it } from 'vitest';
import {
	DEFAULT_TIMEZONE,
	daysBetween,
	formatSpan,
	isValidDay,
	isValidTimeZone,
	localDay,
	noonOf,
	shiftDay,
	timeOfDay
} from './day';

/*
 * Europe/Ljubljana is CET (UTC+1) in winter and CEST (UTC+2) in summer. In 2026
 * the transitions are 29 March (02:00 → 03:00) and 25 October (03:00 → 02:00),
 * both at 01:00 UTC. Those two nights are where naive offset arithmetic breaks,
 * so they get their own tests rather than a "handles DST" hand-wave.
 */
const LJ = 'Europe/Ljubljana';

describe('localDay', () => {
	it('reads the day in the given zone, not in UTC', () => {
		// 23:30 UTC on the 23rd is already 01:30 on the 24th in Ljubljana.
		const at = Date.UTC(2026, 7, 23, 23, 30);
		expect(localDay(at, LJ)).toBe('2026-08-24');
		expect(localDay(at, 'UTC')).toBe('2026-08-23');
	});

	it('pads to YYYY-MM-DD so the value drops straight into a date column', () => {
		expect(localDay(Date.UTC(2026, 0, 5, 12), LJ)).toBe('2026-01-05');
	});

	it('is stable across the spring-forward night, when 02:00–03:00 never happens', () => {
		// 00:30 UTC = 01:30 CET, before the jump. 01:30 UTC = 03:30 CEST, after it.
		expect(localDay(Date.UTC(2026, 2, 29, 0, 30), LJ)).toBe('2026-03-29');
		expect(localDay(Date.UTC(2026, 2, 29, 1, 30), LJ)).toBe('2026-03-29');
		// The instant just before midnight local is still the 28th.
		expect(localDay(Date.UTC(2026, 2, 28, 22, 59), LJ)).toBe('2026-03-28');
	});

	it('is stable across the autumn night, when 02:00–03:00 happens twice', () => {
		// Both of these are wall-clock 02:30 in Ljubljana — different instants,
		// same calendar day. Offset arithmetic gets exactly this wrong.
		expect(localDay(Date.UTC(2026, 9, 25, 0, 30), LJ)).toBe('2026-10-25');
		expect(localDay(Date.UTC(2026, 9, 25, 1, 30), LJ)).toBe('2026-10-25');
	});
});

describe('localDay with a later rollover', () => {
	it('puts the small hours on the previous day', () => {
		// 01:30 local on the 24th is "still the 23rd" if the day starts at 4am.
		expect(localDay(Date.UTC(2026, 7, 23, 23, 30), LJ, 4)).toBe('2026-08-23');
	});

	it('leaves the rest of the day alone', () => {
		// 06:00 local is comfortably past the rollover.
		expect(localDay(Date.UTC(2026, 7, 24, 4, 0), LJ, 4)).toBe('2026-08-24');
	});

	it('lands exactly on the boundary rather than an hour either side of it', () => {
		// 04:00 local on the dot belongs to the new day; 03:59 does not.
		expect(localDay(Date.UTC(2026, 7, 24, 2, 0), LJ, 4)).toBe('2026-08-24');
		expect(localDay(Date.UTC(2026, 7, 24, 1, 59), LJ, 4)).toBe('2026-08-23');
	});

	it('still resolves on a DST night', () => {
		// 02:30 CET on the 25th, minus four hours, is 23:30 CEST on the 24th.
		expect(localDay(Date.UTC(2026, 9, 25, 1, 30), LJ, 4)).toBe('2026-10-24');
	});
});

describe('guards', () => {
	it('names the offending zone instead of leaking an ICU RangeError', () => {
		expect(() => localDay(0, 'Mars/Olympus_Mons')).toThrow(/Unknown IANA time zone/);
	});

	it('refuses a non-finite clock', () => {
		expect(() => localDay(Number.NaN, LJ)).toThrow(/finite epoch/);
	});

	it('accepts the default the schema backfills with', () => {
		expect(isValidTimeZone(DEFAULT_TIMEZONE)).toBe(true);
	});

	it('rejects something that is merely a plausible-looking string', () => {
		expect(isValidTimeZone('Europe/Ljubljanaa')).toBe(false);
	});
});

describe('timeOfDay', () => {
	// 2026-08-25T22:30:00Z — Ljubljana is UTC+2 in August, so the next day locally.
	const at = Date.UTC(2026, 7, 25, 22, 30);

	it('reads the wall clock in the given zone, not UTC', () => {
		expect(timeOfDay(at, 'Europe/Ljubljana')).toBe('00:30');
		expect(timeOfDay(at, 'UTC')).toBe('22:30');
	});

	it('agrees with localDay about which day that is', () => {
		// The point of using one zone for both: the time shown must not contradict
		// the heading the set is filed under.
		expect(localDay(at, 'Europe/Ljubljana')).toBe('2026-08-26');
	});

	it('is 24-hour and zero-padded, so a column of times lines up', () => {
		expect(timeOfDay(Date.UTC(2026, 7, 25, 6, 5), 'UTC')).toBe('06:05');
	});

	it('names an unknown zone rather than leaking an ICU RangeError', () => {
		expect(() => timeOfDay(at, 'Mars/Olympus_Mons')).toThrow(/Unknown IANA time zone/);
	});

	it('refuses a non-finite epoch', () => {
		expect(() => timeOfDay(NaN, 'UTC')).toThrow(TypeError);
	});
});

describe('isValidDay', () => {
	it('accepts the shape localDay emits', () => {
		expect(isValidDay('2026-08-29')).toBe(true);
		expect(isValidDay('2026-01-01')).toBe(true);
	});

	it('rejects anything that is not that shape', () => {
		// It reaches a WHERE clause, so it is user input until proven otherwise.
		expect(isValidDay('')).toBe(false);
		expect(isValidDay('2026-8-9')).toBe(false);
		expect(isValidDay('today')).toBe(false);
		expect(isValidDay("2026-08-29'; drop table sets--")).toBe(false);
	});

	it('rejects a date that matches the shape but does not exist', () => {
		// JS rolls 02-31 forward to March, so the round-trip catches it.
		expect(isValidDay('2026-02-31')).toBe(false);
		expect(isValidDay('2026-13-01')).toBe(false);
		expect(isValidDay('2026-00-10')).toBe(false);
	});

	it('accepts a real leap day and rejects a fake one', () => {
		expect(isValidDay('2024-02-29')).toBe(true);
		expect(isValidDay('2026-02-29')).toBe(false);
	});
});

describe('shiftDay', () => {
	it('steps back and forward', () => {
		expect(shiftDay('2026-08-29', -1)).toBe('2026-08-28');
		expect(shiftDay('2026-08-29', 1)).toBe('2026-08-30');
	});

	it('crosses month and year boundaries', () => {
		expect(shiftDay('2026-09-01', -1)).toBe('2026-08-31');
		expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
		expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
	});

	it('handles a leap day', () => {
		expect(shiftDay('2024-02-28', 1)).toBe('2024-02-29');
		expect(shiftDay('2026-02-28', 1)).toBe('2026-03-01');
	});

	it('steps exactly one day across a DST boundary', () => {
		// Europe/Ljubljana springs forward on 2026-03-29. These are calendar
		// labels, not instants, so the arithmetic is in UTC and unaffected.
		expect(shiftDay('2026-03-29', -1)).toBe('2026-03-28');
		expect(shiftDay('2026-03-28', 1)).toBe('2026-03-29');
		expect(shiftDay('2026-10-25', -1)).toBe('2026-10-24');
	});

	it('is a no-op for zero, and reversible', () => {
		expect(shiftDay('2026-08-29', 0)).toBe('2026-08-29');
		expect(shiftDay(shiftDay('2026-08-29', -7), 7)).toBe('2026-08-29');
	});
});

describe('formatSpan', () => {
	it('reads hours and minutes without looking like a clock time', () => {
		expect(formatSpan(72 * 60_000)).toBe('1h 12m');
		expect(formatSpan(125 * 60_000)).toBe('2h 5m');
	});

	it('drops the hour when there is not one', () => {
		expect(formatSpan(12 * 60_000)).toBe('12m');
	});

	it('names anything under a minute rather than showing 0m', () => {
		expect(formatSpan(0)).toBe('<1m');
		expect(formatSpan(59_000)).toBe('<1m');
	});

	it('keeps a whole hour honest', () => {
		expect(formatSpan(60 * 60_000)).toBe('1h 0m');
	});
});

describe('daysBetween', () => {
	it('counts whole calendar days, positive when the second is later', () => {
		expect(daysBetween('2026-09-04', '2026-09-16')).toBe(12);
		expect(daysBetween('2026-09-15', '2026-09-16')).toBe(1);
		expect(daysBetween('2026-09-16', '2026-09-16')).toBe(0);
	});

	it('counts across a month and a year boundary', () => {
		expect(daysBetween('2026-11-30', '2026-12-30')).toBe(30);
		expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
	});

	it('counts a leap day', () => {
		expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
		expect(daysBetween('2027-02-28', '2027-03-01')).toBe(1);
	});

	it('is unaffected by a DST boundary', () => {
		// The reason the arithmetic is in UTC. Through a zone, the day the clocks
		// change is 23 or 25 hours long, so dividing elapsed time by 86400000
		// would round a gap to the wrong number twice a year.
		expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
		expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
	});

	it('goes negative when the second day is earlier', () => {
		expect(daysBetween('2026-09-16', '2026-09-14')).toBe(-2);
	});

	it('answers zero for an unparseable day rather than NaN', () => {
		// A gap label is decoration; `NaN days` on screen is worse than none.
		expect(daysBetween('not-a-day', '2026-09-16')).toBe(0);
		expect(daysBetween('2026-09-16', '')).toBe(0);
	});
});

describe('noonOf', () => {
	it('is 12:00 local on that calendar day, in summer and winter', () => {
		expect(noonOf('2026-09-22', LJ)).toBe(Date.UTC(2026, 8, 22, 10, 0)); // CEST
		expect(noonOf('2026-01-15', LJ)).toBe(Date.UTC(2026, 0, 15, 11, 0)); // CET
	});

	it('round-trips through localDay and timeOfDay', () => {
		for (const day of ['2026-03-29', '2026-10-25', '2026-12-31']) {
			expect(localDay(noonOf(day, LJ), LJ)).toBe(day);
			expect(timeOfDay(noonOf(day, LJ), LJ)).toBe('12:00');
		}
	});
});
