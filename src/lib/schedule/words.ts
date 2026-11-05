/** The schedule's words. PURE. */
import { daysBetween } from '$lib/day/day';
import { dayMonth, plural, weekdayDayMonth } from '$lib/format';
import type { MetaPart } from '$lib/exercises/today';
import type { ScheduleState } from './schedule';

type Span = { n: number; unit: 'day' | 'week' | 'month' | 'year' };

function span(days: number): Span {
	if (days < 1) days = 1;
	if (days < 14) return days === 7 ? { n: 1, unit: 'week' } : { n: days, unit: 'day' };
	if (days < 56) return { n: Math.round(days / 7), unit: 'week' };
	if (days < 345) return { n: Math.round(days / 30), unit: 'month' };
	return { n: 1, unit: 'year' };
}

const count = (s: Span) => plural(s.n, s.unit, `${s.unit}s`);
const inWords = (s: Span) => (s.n === 1 && s.unit !== 'day' ? `a ${s.unit}` : count(s));

/** "Tomorrow", "3 days", "1 week", "3 weeks", "2 months", "1 year". */
export function gapWords(days: number): string {
	return days <= 1 ? 'Tomorrow' : count(span(days));
}

/** "Back tomorrow", "Back in 3 days", "Back in a week". */
export function backWords(days: number): string {
	return days <= 1 ? 'Back tomorrow' : `Back in ${inWords(span(days))}`;
}

/** "today", "tomorrow", "in 3 days", "in a week", "in 4 months". */
export function awayWords(today: string, day: string): string {
	const d = daysBetween(today, day);
	if (d <= 0) return 'today';
	if (d === 1) return 'tomorrow';
	return `in ${inWords(span(d))}`;
}

const weekdayOf = (day: string) => weekdayDayMonth(day).split(' ')[0];
const dated = (day: string, today: string) =>
	day.slice(0, 4) === today.slice(0, 4) ? dayMonth(day) : `${dayMonth(day)} ${day.slice(0, 4)}`;

/**
 * A day from today on, as the due words name it: "today", "tomorrow", "Sunday"
 * (within the week), "14 Nov", "14 Jan 2027". A day before today is "today".
 */
export function dayWords(day: string, today: string): string {
	const d = daysBetween(today, day);
	if (d <= 0) return 'today';
	if (d === 1) return 'tomorrow';
	if (d <= 6) return weekdayOf(day);
	return dated(day, today);
}

/** "New", "N days late", "Due today", "Due tomorrow", "Due Sunday", "Due 14 Nov". */
export function dueWords(state: ScheduleState, today: string, neverDone: boolean): MetaPart[] {
	if (neverDone) return [{ text: 'New', tone: 'status' }];
	const d = daysBetween(today, state.dueDay);
	if (d < 0) return [{ text: `${plural(-d, 'day', 'days')} late`, tone: 'status' }];
	return [{ text: `Due ${dayWords(state.dueDay, today)}`, tone: null }];
}

/** "Done early: you last did it yesterday, it was due on Saturday 14 Nov." */
export function earlyLine(early: { lastDay: string; dueDay: string }, today: string): string {
	const ago = daysBetween(early.lastDay, today);
	const last = ago <= 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`;
	return `Done early: you last did it ${last}, it was due on ${weekdayOf(early.dueDay)} ${dated(early.dueDay, today)}.`;
}
