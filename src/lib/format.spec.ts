import { describe, expect, it } from 'vitest';
import { byteSize, clock, dateLabel, dayLabel, lastDoneLabel, setSummary } from './format';

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

	it('labels a day without shifting it through a zone', () => {
		expect(dayLabel('2026-09-22')).toBe('Tue 22 Sep');
		expect(dateLabel('2026-01-05')).toBe('5 Jan 2026');
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
