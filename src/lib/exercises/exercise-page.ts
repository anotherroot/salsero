/** What the exercise page shows: summary tiles, history by day, the owner row. PURE, client-safe. */
import { daysBetween, localDay, timeOfDay } from '$lib/day/day';
import { dateLabel, longDayLabel, setSummary } from '$lib/format';
import { FEEL_WORD, feelOf, type Feel } from '$lib/schedule/feel';
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
	return [
		{ value: String(s.sets), label: s.sets === 1 ? 'set' : 'sets', feel: null },
		{ value: practisedLabel(s.totalS), label: 'practised', feel: null },
		{ value: feel === null ? '–' : FEEL_WORD[feel], label: 'recently', feel }
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
	const ago = daysBetween(day, today);
	if (ago === 0) return 'Today';
	if (ago === 1) return 'Yesterday';
	const label = longDayLabel(day);
	return day.slice(0, 4) === today.slice(0, 4) ? label : `${label}, ${day.slice(0, 4)}`;
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
	return { text: text === '' && s.rating === null ? 'Set' : text, rating: s.rating };
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
	switch (c.type) {
		case 'figure':
			return {
				kind: 'figure',
				id: c.figure.id,
				title: c.figure.name,
				meta: 'Figure',
				icon: 'footprints'
			};
		case 'lesson':
			return {
				kind: 'lesson',
				id: c.lesson.id,
				title: c.lesson.title,
				meta: `Lesson · ${dateLabel(c.lesson.lessonDay)}`,
				icon: 'lessons'
			};
		case 'routine':
			return {
				kind: 'routine',
				id: c.routine.id,
				title: c.routine.name,
				meta: 'Routine',
				icon: 'route'
			};
		case 'drill':
			return null;
	}
}

export function archiveBody(name: string, sets: number): string {
	const head = `${name} leaves Today and every list.`;
	return sets === 0 ? head : `${head} Its ${sets} ${sets === 1 ? 'set is' : 'sets are'} kept.`;
}
