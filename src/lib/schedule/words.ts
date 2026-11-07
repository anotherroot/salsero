/** The schedule's words, in the current language (`t().format`). PURE. */
import { daysBetween } from '$lib/day/day';
import { dayMonth, firstUpper, weekdayLong } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import type { SpanUnit } from '$lib/i18n/en/format';
import type { MetaPart } from '$lib/exercises/today';
import type { ScheduleState } from './schedule';

type Span = { n: number; unit: SpanUnit };

function span(days: number): Span {
	if (days < 1) days = 1;
	if (days < 14) return days === 7 ? { n: 1, unit: 'week' } : { n: days, unit: 'day' };
	if (days < 56) return { n: Math.round(days / 7), unit: 'week' };
	if (days < 345) return { n: Math.round(days / 30), unit: 'month' };
	return { n: 1, unit: 'year' };
}

const count = (s: Span) => t().format.span(s.n, s.unit);
const inWords = (s: Span) => t().format.inSpan(s.n, s.unit);

/** "Tomorrow", "3 days", "1 week", "3 weeks", "2 months", "1 year". */
export function gapWords(days: number): string {
	return days <= 1 ? firstUpper(t().format.tomorrow) : count(span(days));
}

/** "Back tomorrow", "Back in 3 days", "Back in a week". */
export function backWords(days: number): string {
	const f = t().format;
	return days <= 1 ? f.backTomorrow : f.backIn(inWords(span(days)));
}

/** "today", "tomorrow", "in 3 days", "in a week", "in 4 months". */
export function awayWords(today: string, day: string): string {
	const f = t().format;
	const d = daysBetween(today, day);
	if (d <= 0) return f.today;
	if (d === 1) return f.tomorrow;
	return f.awayIn(inWords(span(d)));
}

const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
const dated = (day: string, today: string) =>
	day.slice(0, 4) === today.slice(0, 4) ? dayMonth(day) : `${dayMonth(day)} ${day.slice(0, 4)}`;

/**
 * A day from today on, as the due words name it: "today", "tomorrow", "Sunday"
 * (within the week), "14 Nov", "14 Jan 2027". A day before today is "today".
 * The weekday is its name ("nedelja"); `whenWords` says it as a time ("v nedeljo").
 */
export function dayWords(day: string, today: string): string {
	const d = daysBetween(today, day);
	if (d <= 0) return t().format.today;
	if (d === 1) return t().format.tomorrow;
	if (d <= 6) return weekdayLong(day);
	return dated(day, today);
}

/**
 * `dayWords` as the time something happens: the same in English ("Due
 * Sunday"), the day it happens on in Slovenian ("Na vrsti v nedeljo").
 */
export function whenWords(day: string, today: string): string {
	const d = daysBetween(today, day);
	if (d > 1 && d <= 6) return t().format.onWeekday(weekdayOf(day));
	return dayWords(day, today);
}

/** "New", "N days late", "Due today", "Due tomorrow", "Due Sunday", "Due 14 Nov". */
export function dueWords(state: ScheduleState, today: string, neverDone: boolean): MetaPart[] {
	const f = t().format;
	if (neverDone) return [{ text: f.newOne, tone: 'status' }];
	const d = daysBetween(today, state.dueDay);
	if (d < 0) return [{ text: f.late(-d), tone: 'status' }];
	return [{ text: f.due(whenWords(state.dueDay, today)), tone: null }];
}

/** "Done early: you last did it yesterday, it was due on Saturday 14 Nov." */
export function earlyLine(early: { lastDay: string; dueDay: string }, today: string): string {
	const f = t().format;
	const ago = daysBetween(early.lastDay, today);
	const last = ago <= 0 ? f.today : ago === 1 ? f.yesterday : f.daysAgo(ago);
	return f.early(last, weekdayOf(early.dueDay), dated(early.dueDay, today));
}
