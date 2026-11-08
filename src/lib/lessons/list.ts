/** PURE, client-safe: what the Lessons list shows. */
import { byteSize, monthLabel, weekdayShort, fullDateLabel } from '$lib/format';
import { t } from '$lib/i18n/catalog';
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

/**
 * `3 videos · 1.2 GB`, or `null` with no videos. `sized` false (a simple person:
 * simple screens show no sizes): `3 videos`.
 */
export function videoMeta(
	l: Pick<LessonItem, 'videos' | 'videoBytes'>,
	sized = true
): string | null {
	if (l.videos === 0) return null;
	const n = t().lesson.list.videos(l.videos);
	return sized ? `${n} · ${byteSize(l.videoBytes)}` : n;
}

/** The three counts of a row, always, in this order. */
export function lessonCounts(
	l: Pick<LessonItem, 'sections' | 'routines' | 'figures'>
): { n: number; word: string }[] {
	const w = t().lesson.list;
	return [
		{ n: l.sections, word: w.sections(l.sections) },
		{ n: l.routines, word: w.routines(l.routines) },
		{ n: l.figures, word: w.figures(l.figures) }
	];
}

/** The list header's subtitle, or `undefined` with nothing on disk. */
export function diskSubtitle(bytes: number): string | undefined {
	return bytes > 0 ? t().lesson.list.onDisk(byteSize(bytes)) : undefined;
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
	const w = t().lesson.list;
	return inGroup ? w.emptyGroup : w.emptyOwn;
}

/** Whether a row is the lesson open beside the list: itself, or a twin it stands for. */
export function isOpenLesson(row: { id: number; twinIds?: number[] }, openId: number | null) {
	return openId !== null && (row.id === openId || (row.twinIds ?? []).includes(openId));
}

/** The pane's words with no lesson open (desktop only). */
export function pickLesson(): { title: string; body: string } {
	return t().lesson.list.pick;
}

/** A group's storage as the band's subtitle on the desktop (group mode). */
export function groupVideosSubtitle(usedBytes: number, limitBytes: number): string {
	return t().lesson.list.groupVideos(byteSize(usedBytes), byteSize(limitBytes));
}
