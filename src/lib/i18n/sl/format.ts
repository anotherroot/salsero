import type { Catalog } from '../catalog';
import type { SpanUnit } from '../en/format';
import { slCount } from '../plural';

// Weekdays and months are lower case in Slovenian; a date is "22. sep. 2026".
const weekdaysShort = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];
const weekdays = ['nedelja', 'ponedeljek', 'torek', 'sreda', 'četrtek', 'petek', 'sobota'];
/** "v nedeljo": the day something happens on (accusative). */
const onWeekdays = [
	'v nedeljo',
	'v ponedeljek',
	'v torek',
	'v sredo',
	'v četrtek',
	'v petek',
	'v soboto'
];
const monthsShort = [
	'jan.',
	'feb.',
	'mar.',
	'apr.',
	'maj',
	'jun.',
	'jul.',
	'avg.',
	'sep.',
	'okt.',
	'nov.',
	'dec.'
];
const months = [
	'januar',
	'februar',
	'marec',
	'april',
	'maj',
	'junij',
	'julij',
	'avgust',
	'september',
	'oktober',
	'november',
	'december'
];
/** After a day number a month is genitive: "3. novembra", "3. novembra 2026". Alone: `months`. */
const monthsOfDay = [
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

type Forms = [one: string, two: string, few: string, other: string];

/** A gap, in the accusative it takes after "čez" and on its own ("3 tedne"). */
const SPAN: Record<SpanUnit, Forms> = {
	day: ['dan', 'dneva', 'dni', 'dni'],
	week: ['teden', 'tedna', 'tedne', 'tednov'],
	month: ['mesec', 'meseca', 'mesece', 'mesecev'],
	year: ['leto', 'leti', 'leta', 'let']
};
const ONE: Record<Exclude<SpanUnit, 'day'>, string> = {
	week: 'en teden',
	month: 'en mesec',
	year: 'eno leto'
};
/** After "pred": "pred 2 dnevoma", "pred 5 dnevi" (instrumental). */
const DAYS_AGO: Forms = ['dnevom', 'dnevoma', 'dnevi', 'dnevi'];

export const format: Catalog['format'] = {
	weekdaysShort,
	weekdays,
	monthsShort,
	months,
	today: 'danes',
	yesterday: 'včeraj',
	tomorrow: 'jutri',
	neverDone: 'Še nikoli',
	justNow: 'pravkar',
	dayLabel: (p) => `${weekdaysShort[p.weekday]}, ${p.date}. ${monthsShort[p.month]}`,
	dateLabel: (p) => `${p.date}. ${monthsShort[p.month]} ${p.year}`,
	dayMonth: (p) => `${p.date}. ${monthsShort[p.month]}`,
	longDay: (p) => `${weekdays[p.weekday]}, ${p.date}. ${monthsOfDay[p.month]}`,
	weekdayDayMonth: (p) => `${weekdays[p.weekday]}, ${p.date}. ${monthsOfDay[p.month]}`,
	fullDate: (p) => `${p.date}. ${monthsOfDay[p.month]} ${p.year}`,
	monthYear: (p) => `${months[p.month]} ${p.year}`,
	daysAgo: (n) => `pred ${slCount(n, DAYS_AGO)}`,
	minutesAgo: (n) => `pred ${n} min`,
	hoursAgo: (n) => `pred ${n} h`,
	minutes: (n) => `${n} min`,
	reps: (n) => slCount(n, ['ponovitev', 'ponovitvi', 'ponovitve', 'ponovitev']),
	feel: {
		hard: 'Še težko',
		getting: 'Napredujem',
		gotit: 'Obvladam',
		easy: 'Lahko'
	},
	span: (n, unit) => slCount(n, SPAN[unit]),
	inSpan: (n, unit) => (n === 1 && unit !== 'day' ? ONE[unit] : slCount(n, SPAN[unit])),
	backTomorrow: 'Spet jutri',
	backIn: (span) => `Spet čez ${span}`,
	awayIn: (span) => `čez ${span}`,
	onWeekday: (weekday) => onWeekdays[weekday],
	newOne: 'Nova',
	late: (n) => `${slCount(n, SPAN.day)} zamude`,
	due: (when) => `Na vrsti ${when}`,
	// "14. nov." already ends the sentence; "14. maj" and a year do not.
	early: (last, weekday, dated) =>
		`Opravljeno prej: zadnji vnos ${last}, na vrsti je bila ${onWeekdays[weekday]}, ${dated}${dated.endsWith('.') ? '' : '.'}`
};
