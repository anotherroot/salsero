/** PURE, client-safe: what the Lessons list shows. */
import { byteSize, monthLabel, plural, weekdayShort, fullDateLabel } from '$lib/format';
import type { LessonItem } from '$lib/types';

/** Consecutive lessons of one month share a group; the load already sorts newest first. */
export function monthGroups(
	lessons: LessonItem[]
): { key: string; label: string; lessons: LessonItem[] }[] {
	const groups: { key: string; label: string; lessons: LessonItem[] }[] = [];
	for (const l of lessons) {
		const key = l.lessonDay.slice(0, 7);
		const last = groups[groups.length - 1];
		if (last && last.key === key) last.lessons.push(l);
		else groups.push({ key, label: monthLabel(l.lessonDay), lessons: [l] });
	}
	return groups;
}

/** The date tile of a row: `Wed`, `28`, and the full label for screen readers. */
export function dateTile(day: string): { weekday: string; day: number; label: string } {
	return { weekday: weekdayShort(day), day: Number(day.slice(8, 10)), label: fullDateLabel(day) };
}

/** `3 videos · 1.2 GB`, or `null` with no videos. */
export function videoMeta(l: Pick<LessonItem, 'videos' | 'videoBytes'>): string | null {
	if (l.videos === 0) return null;
	return `${plural(l.videos, 'video', 'videos')} · ${byteSize(l.videoBytes)}`;
}

/** The three counts of a row, always, in this order. */
export function lessonCounts(
	l: Pick<LessonItem, 'sections' | 'routines' | 'figures'>
): { n: number; word: string }[] {
	const w = (n: number, one: string, many: string) => ({ n, word: n === 1 ? one : many });
	return [
		w(l.sections, 'section', 'sections'),
		w(l.routines, 'routine', 'routines'),
		w(l.figures, 'figure', 'figures')
	];
}

/** The list header's subtitle, or `undefined` with nothing on disk. */
export function diskSubtitle(bytes: number): string | undefined {
	return bytes > 0 ? `Videos on disk: ${byteSize(bytes)}` : undefined;
}

/**
 * A group's lessons in group mode: the editors' drafts apart, then the published ones.
 * Only a group's lesson is ever a draft; a person's own has no publish (its
 * `publishedAt` is null too), as a song's draft is a group song not yet shared.
 */
export function splitDrafts<T extends LessonItem & { publishedAt?: number | null }>(
	lessons: T[]
): { drafts: T[]; published: T[] } {
	const draft = (l: T) => l.team !== null && l.publishedAt === null;
	return {
		drafts: lessons.filter(draft),
		published: lessons.filter((l) => !draft(l))
	};
}

/** The empty Lessons list's invitation: a group's drafts have no Today review. */
export function emptyLessonsBody(inGroup: boolean): string {
	return inGroup
		? 'Add one after your next class — the videos and the notes. Members see it once you publish it.'
		: 'Add one after your next class — the videos, the notes, and something on Today to make you go back over it.';
}
