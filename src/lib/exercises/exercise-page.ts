/** What the exercise page shows: summary tiles, history by day, the owner row. PURE, client-safe. */
import { daysBetween, localDay, timeOfDay } from '$lib/day/day';
import { classDayLabel, dateLabel, firstUpper, longDayLabel, setSummary } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { feelWord, feelOf, type Feel } from '$lib/schedule/feel';
import type { IconName } from '$lib/icons/icons';
import type { ExerciseSummary, HistorySet, PracticeContent } from '$lib/types';

export function practisedLabel(totalS: number): string {
	const minutes = Math.floor(totalS / 60);
	if (minutes < 60) return `${minutes} min`;
	return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export function summaryTiles(
	s: ExerciseSummary
): { value: string; label: string; feel: Feel | null }[] {
	// The recent ratings' mean, read as the face it is closest to.
	const feel = s.recentRating === null ? null : feelOf(Math.round(s.recentRating));
	const w = t().exercise.page;
	return [
		{ value: String(s.sets), label: w.tileSets(s.sets), feel: null },
		{ value: practisedLabel(s.totalS), label: w.tilePractised, feel: null },
		{ value: feel === null ? '–' : feelWord(feel), label: w.tileRecently, feel }
	];
}

/** History arrives newest first; days keep that order. */
export function historyDays(
	history: HistorySet[],
	timezone: string,
	today: string
): { day: string; label: string; sets: HistorySet[] }[] {
	const days: { day: string; label: string; sets: HistorySet[] }[] = [];
	for (const set of history) {
		const day = localDay(set.doneAt, timezone);
		const group = days.find((g) => g.day === day);
		if (group) group.sets.push(set);
		else days.push({ day, label: dayName(day, today), sets: [set] });
	}
	return days;
}

function dayName(day: string, today: string): string {
	const f = t().format;
	const ago = daysBetween(day, today);
	if (ago === 0) return firstUpper(f.today);
	if (ago === 1) return firstUpper(f.yesterday);
	const label = longDayLabel(day);
	return day.slice(0, 4) === today.slice(0, 4)
		? label
		: t().exercise.page.dayWithYear(label, day.slice(0, 4));
}

export function setTitle(s: {
	durationS: number | null;
	reps: number | null;
	rating: number | null;
}): {
	text: string;
	rating: number | null;
} {
	const text = setSummary({ ...s, rating: null });
	return {
		text: text === '' && s.rating === null ? t().exercise.sets.set : text,
		rating: s.rating
	};
}

export function setMeta(s: HistorySet, timezone: string): string {
	const time = timeOfDay(s.doneAt, timezone);
	return s.note ? `${time} · ${s.note}` : time;
}

export function ownerOf(c: PracticeContent): {
	kind: 'figure' | 'lesson' | 'routine';
	id: number;
	title: string;
	meta: string;
	icon: IconName;
} | null {
	const w = t().exercise.page;
	switch (c.type) {
		case 'figure':
			return {
				kind: 'figure',
				id: c.figure.id,
				title: c.figure.name,
				meta: w.ownerFigure,
				icon: 'footprints'
			};
		case 'lesson':
			return {
				kind: 'lesson',
				id: c.lesson.id,
				title: c.lesson.title,
				meta: w.ownerLesson(dateLabel(c.lesson.lessonDay)),
				icon: 'lessons'
			};
		case 'routine':
			return {
				kind: 'routine',
				id: c.routine.id,
				title: c.routine.name,
				meta: w.ownerRoutine,
				icon: 'route'
			};
		case 'drill':
			return null;
	}
}

export function archiveBody(name: string, sets: number): string {
	return t().exercise.page.archiveBody(name, sets);
}

/**
 * What the exercise page draws. The simple page (Follow my class, Practise and
 * keep my own) is the "I practised this" page: the type's content, where it is
 * from, the pinned button and Not today. Everything else on the full page is
 * hidden, never the route.
 */
export interface PageParts {
	editSettings: boolean;
	historyLink: boolean;
	sourceTabs: boolean;
	ownerRow: boolean;
	addBlock: boolean;
	historyTiles: boolean;
	setList: boolean;
	settingsBlock: boolean;
	fromClass: boolean;
	/** The pinned button's words. */
	logButton: string;
}

export function pageParts(simple: boolean, hasClass: boolean): PageParts {
	return {
		editSettings: !simple,
		historyLink: !simple,
		sourceTabs: !simple,
		ownerRow: !simple,
		addBlock: !simple,
		historyTiles: !simple,
		setList: !simple,
		settingsBlock: !simple,
		fromClass: simple && hasClass,
		logButton: simple ? t().exercise.page.practised : t().exercise.page.logASet
	};
}

/** The line to the class an exercise came from: `From class Tue 3 Nov ›`. */
export function fromClassLabel(lessonDay: string, today: string): string {
	return t().exercise.page.fromClass(classDayLabel(lessonDay, today));
}
