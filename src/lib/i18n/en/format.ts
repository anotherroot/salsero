// Dates, counts and the schedule's words ($lib/format, $lib/schedule/words, the faces).
import type { Feel } from '$lib/schedule/feel';
import { plural } from './plural';

/** A calendar day's parts, as `$lib/format` reads them: weekday 0 is Sunday, month 0 January. */
export interface DayParts {
	weekday: number;
	date: number;
	month: number;
	year: number;
}

/** The unit of a gap between days (`$lib/schedule/words`). */
export type SpanUnit = 'day' | 'week' | 'month' | 'year';

const weekdaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthsShort = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec'
];
const months = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];

const feel: Record<Feel, string> = {
	hard: 'Still hard',
	getting: 'Getting there',
	gotit: "I've got it",
	easy: 'Easy'
};

export const format = {
	/** Sunday first. */
	weekdaysShort,
	/** Sunday first. */
	weekdays,
	monthsShort,
	months,
	today: 'today',
	yesterday: 'yesterday',
	tomorrow: 'tomorrow',
	neverDone: 'Never done',
	justNow: 'just now',
	/** "Tue 22 Sep". */
	dayLabel: (p: DayParts): string =>
		`${weekdaysShort[p.weekday]} ${p.date} ${monthsShort[p.month]}`,
	/** "22 Sep 2026". */
	dateLabel: (p: DayParts): string => `${p.date} ${monthsShort[p.month]} ${p.year}`,
	/** "26 Oct". */
	dayMonth: (p: DayParts): string => `${p.date} ${monthsShort[p.month]}`,
	/** "Saturday, 31 October". */
	longDay: (p: DayParts): string => `${weekdays[p.weekday]}, ${p.date} ${months[p.month]}`,
	/** "Tuesday 13 October": a class's day on a row. */
	weekdayDayMonth: (p: DayParts): string => `${weekdays[p.weekday]} ${p.date} ${months[p.month]}`,
	/** "28 October 2026". */
	fullDate: (p: DayParts): string => `${p.date} ${months[p.month]} ${p.year}`,
	/** "October 2026". */
	monthYear: (p: DayParts): string => `${months[p.month]} ${p.year}`,
	/** "4 days ago" (n ≥ 2). */
	daysAgo: (n: number): string => `${n} days ago`,
	minutesAgo: (n: number): string => `${n} min ago`,
	hoursAgo: (n: number): string => `${n} h ago`,
	/** A set's length: "10 min". */
	minutes: (n: number): string => `${n} min`,
	/** A set's reps: "8 reps". */
	reps: (n: number): string => `${n} reps`,
	/** The four faces (`$lib/schedule/feel`). */
	feel,
	/** A gap on its own: "3 days", "1 week". */
	span: (n: number, unit: SpanUnit): string => plural(n, unit, `${unit}s`),
	/** A gap after "in": "3 days", "a week". */
	inSpan: (n: number, unit: SpanUnit): string =>
		n === 1 && unit !== 'day' ? `a ${unit}` : plural(n, unit, `${unit}s`),
	backTomorrow: 'Back tomorrow',
	/** `span` from `inSpan`. */
	backIn: (span: string): string => `Back in ${span}`,
	/** `span` from `inSpan`. */
	awayIn: (span: string): string => `in ${span}`,
	/** A weekday as the due day: "Sunday" ("Due Sunday"). */
	onWeekday: (weekday: number): string => weekdays[weekday],
	/** Never done yet. */
	newOne: 'New',
	late: (n: number): string => `${plural(n, 'day', 'days')} late`,
	/** `when`: "today", "tomorrow", `onWeekday`, a date. */
	due: (when: string): string => `Due ${when}`,
	/** `last`: "today", "yesterday", `daysAgo`; `dated`: "14 Nov". */
	early: (last: string, weekday: number, dated: string): string =>
		`Done early: you last did it ${last}, it was due on ${weekdays[weekday]} ${dated}.`
};
