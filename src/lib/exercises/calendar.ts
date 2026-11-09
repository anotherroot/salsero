/**
 * The past day's calendar: how many exercises each day had, laid out as months
 * (Monday first) from the first entry, or the shown day if older, to today's
 * month. PURE, client-safe; `today` and the zone are arguments.
 */
import { localDay } from '$lib/day/day';
import type { CalendarDay, CalendarMonth } from '$lib/types';

/** Distinct exercises per local day: `{ '2026-11-02': 11 }`. */
export function dayCounts(
	rows: { exerciseId: number; doneAt: number }[],
	tz: string
): Record<string, number> {
	const seen = new Map<string, Set<number>>();
	for (const r of rows) {
		const day = localDay(r.doneAt, tz);
		let ids = seen.get(day);
		if (!ids) seen.set(day, (ids = new Set()));
		ids.add(r.exerciseId);
	}
	return Object.fromEntries([...seen].map(([day, ids]) => [day, ids.size]));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-11` → the next month's `YYYY-MM`, in plain calendar arithmetic. */
function nextMonth(ym: string): string {
	const [y, m] = ym.split('-').map(Number);
	return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
}

function month(
	ym: string,
	counts: Record<string, number>,
	shown: string,
	today: string
): CalendarMonth {
	const [y, m] = ym.split('-').map(Number);
	const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
	const weekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
	const days: CalendarDay[] = [];
	for (let date = 1; date <= length; date++) {
		const day = `${ym}-${pad(date)}`;
		days.push({
			day,
			date,
			count: counts[day] ?? 0,
			when: day < today ? 'past' : day === today ? 'today' : 'future',
			shown: day === shown
		});
	}
	return {
		first: `${ym}-01`,
		lead: (weekday + 6) % 7,
		days,
		activeDays: days.filter((d) => d.count > 0).length,
		exercises: days.reduce((sum, d) => sum + d.count, 0)
	};
}

export function calendarMonths(
	counts: Record<string, number>,
	shown: string,
	today: string
): CalendarMonth[] {
	const start = [shown, ...Object.keys(counts)].reduce((a, b) => (b < a ? b : a)).slice(0, 7);
	const end = today.slice(0, 7);
	const months: CalendarMonth[] = [];
	for (let ym = start; ym <= end; ym = nextMonth(ym)) months.push(month(ym, counts, shown, today));
	return months;
}
