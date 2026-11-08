/** What the exercise page shows: summary tiles, history by day, the owner row. PURE, client-safe. */
import { localDay } from '$lib/day/day';
import { classDayLabel, dateLabel, dayLabel, setSummary } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import type { IconName } from '$lib/icons/icons';
import { feelOf, type Feel } from '$lib/schedule/feel';
import { mergeDay } from './day-entry';
import type { ExerciseSummary, HistorySet, PracticeContent } from '$lib/types';

export function practisedLabel(totalS: number): string {
	const minutes = Math.floor(totalS / 60);
	if (minutes < 60) return `${minutes} min`;
	return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export function historyTiles(s: ExerciseSummary): { value: string; label: string }[] {
	const w = t().exercise.page;
	return [
		{ value: String(s.times), label: w.times(s.times) },
		{ value: practisedLabel(s.totalS), label: w.inAll }
	];
}

/** One day of the page's history: its rows merged into one entry. */
export interface HistoryDay {
	day: string;
	label: string;
	amount: string | null;
	feel: Feel | null;
	note: string | null;
}

/** History arrives newest first; each local day is one row, merged (`mergeDay`). */
export function historyRows(history: HistorySet[], timezone: string, today: string): HistoryDay[] {
	const byDay = new Map<string, HistorySet[]>();
	for (const set of history) {
		const day = localDay(set.doneAt, timezone);
		byDay.set(day, [...(byDay.get(day) ?? []), set]);
	}
	return [...byDay].map(([day, rows]) => {
		const entry = mergeDay(rows);
		const label = dayLabel(day);
		return {
			day,
			label:
				day.slice(0, 4) === today.slice(0, 4)
					? label
					: t().exercise.page.dayWithYear(label, day.slice(0, 4)),
			amount: setSummary({ ...entry, rating: null }) || null,
			feel: feelOf(entry.rating),
			note: entry.note
		};
	});
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

export function archiveBody(name: string, times: number): string {
	return t().exercise.page.archiveBody(name, times);
}

/**
 * What the exercise page draws. The simple page (Follow my class, Practise and
 * keep my own) is the "I practised this" page: the type's content, where it is
 * from, Done and Not today, no history. Everything else on the full page is
 * hidden, never the route.
 */
export interface PageParts {
	editSettings: boolean;
	historyLink: boolean;
	sourceTabs: boolean;
	ownerRow: boolean;
	addBlock: boolean;
	historyTiles: boolean;
	settingsBlock: boolean;
	fromClass: boolean;
}

export function pageParts(simple: boolean, hasClass: boolean): PageParts {
	return {
		editSettings: !simple,
		historyLink: !simple,
		sourceTabs: !simple,
		ownerRow: !simple,
		addBlock: !simple,
		historyTiles: !simple,
		settingsBlock: !simple,
		fromClass: simple && hasClass
	};
}

/** The line to the class an exercise came from: `From class Tue 3 Nov ›`. */
export function fromClassLabel(lessonDay: string, today: string): string {
	return t().exercise.page.fromClass(classDayLabel(lessonDay, today));
}

/**
 * A drill's Recordings rows as focus keys, sections then links: after an unlink
 * or a removal focus goes to the next section, else the next link.
 */
export function recordingKeys(
	sections: readonly { linkId: number }[],
	links: readonly { id: number }[]
): string[] {
	return [...sections.map((s) => `section-${s.linkId}`), ...links.map((l) => `link-${l.id}`)];
}
