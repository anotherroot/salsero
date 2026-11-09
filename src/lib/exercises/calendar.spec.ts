import { describe, expect, it } from 'vitest';
import { calendarMonths, dayCounts } from './calendar';

const at = (iso: string) => Date.parse(iso);

describe('dayCounts', () => {
	it('counts an exercise once a day', () => {
		const rows = [
			{ exerciseId: 1, doneAt: at('2026-11-02T09:00:00Z') },
			{ exerciseId: 1, doneAt: at('2026-11-02T10:00:00Z') },
			{ exerciseId: 2, doneAt: at('2026-11-02T11:00:00Z') }
		];
		expect(dayCounts(rows, 'Europe/Ljubljana')).toEqual({ '2026-11-02': 2 });
	});

	it("splits days in the person's zone", () => {
		const rows = [{ exerciseId: 1, doneAt: at('2026-11-02T23:30:00Z') }];
		expect(dayCounts(rows, 'Europe/Ljubljana')).toEqual({ '2026-11-03': 1 });
		expect(dayCounts(rows, 'UTC')).toEqual({ '2026-11-02': 1 });
	});
});

describe('calendarMonths', () => {
	const counts = { '2026-10-07': 3, '2026-10-15': 11, '2026-10-16': 1, '2026-11-02': 11 };

	it('runs from the first month with an entry to the current one', () => {
		const months = calendarMonths(counts, '2026-11-02', '2026-11-05');
		expect(months.map((m) => m.first)).toEqual(['2026-10-01', '2026-11-01']);
		const [oct, nov] = months;
		expect(oct.lead).toBe(3); // Thursday
		expect(oct.days).toHaveLength(31);
		expect(oct.activeDays).toBe(3);
		expect(oct.exercises).toBe(15);
		expect(nov.lead).toBe(6); // Sunday
		expect(nov.days).toHaveLength(30);
	});

	it('marks the shown day, today and the days after it', () => {
		const nov = calendarMonths(counts, '2026-11-02', '2026-11-05')[1];
		expect(nov.days[1]).toEqual({
			day: '2026-11-02',
			date: 2,
			count: 11,
			when: 'past',
			shown: true
		});
		expect(nov.days[4]).toMatchObject({ day: '2026-11-05', when: 'today', shown: false });
		expect(nov.days[5]).toMatchObject({ day: '2026-11-06', when: 'future', count: 0 });
	});

	it('starts at the shown day when it is older than every entry', () => {
		const months = calendarMonths({}, '2026-09-10', '2026-11-05');
		expect(months.map((m) => m.first)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
		expect(months[0].exercises).toBe(0);
	});

	it('has no blanks before a month that starts on a Monday', () => {
		expect(calendarMonths({}, '2026-06-03', '2026-06-20')[0].lead).toBe(0);
	});

	it('crosses a year', () => {
		const months = calendarMonths({ '2025-12-31': 1 }, '2026-01-02', '2026-01-05');
		expect(months.map((m) => m.first)).toEqual(['2025-12-01', '2026-01-01']);
	});
});
