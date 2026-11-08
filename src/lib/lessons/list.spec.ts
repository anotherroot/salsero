import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import type { LessonItem } from '$lib/types';
import {
	pickLesson,
	dateTile,
	diskSubtitle,
	emptyLessonsBody,
	groupVideosSubtitle,
	isOpenLesson,
	lessonCounts,
	monthGroups,
	splitDrafts,
	videoMeta
} from './list';
import { byteSize } from '$lib/format';

const lesson = (lessonDay: string, over: Partial<LessonItem> = {}): LessonItem => ({
	id: 1,
	lessonDay,
	title: 'Class',
	videos: 0,
	videoBytes: 0,
	sections: 0,
	routines: 0,
	figures: 0,
	createdAt: 0,
	team: null,
	copyOf: null,
	...over
});

describe('monthGroups', () => {
	it('groups consecutive lessons of one month, keeping order', () => {
		const groups = monthGroups([lesson('2026-01-07'), lesson('2026-01-02'), lesson('2025-12-31')]);
		expect(groups.map((g) => [g.key, g.label, g.lessons.length])).toEqual([
			['2026-01', 'January 2026', 2],
			['2025-12', 'December 2025', 1]
		]);
		expect(monthGroups([])).toEqual([]);
	});
});

describe('dateTile', () => {
	it('gives weekday, day number and the full label', () => {
		expect(dateTile('2026-10-24')).toEqual({ weekday: 'Sat', day: 24, label: '24 October 2026' });
	});
});

describe('videoMeta', () => {
	it('counts videos and sizes them', () => {
		expect(videoMeta({ videos: 3, videoBytes: 1.2 * 1024 ** 3 })).toBe('3 videos · 1.2 GB');
		expect(videoMeta({ videos: 1, videoBytes: 410 * 1024 ** 2 })).toBe('1 video · 410 MB');
		expect(videoMeta({ videos: 0, videoBytes: 0 })).toBeNull();
	});
	it('leaves the size out for a simple person (Follow my class, Practise and keep my own)', () => {
		expect(videoMeta({ videos: 3, videoBytes: 1.2 * 1024 ** 3 }, false)).toBe('3 videos');
		expect(videoMeta({ videos: 1, videoBytes: 410 * 1024 ** 2 }, false)).toBe('1 video');
		expect(videoMeta({ videos: 0, videoBytes: 0 }, false)).toBeNull();
	});
});

describe('lessonCounts', () => {
	it('is always three, in order', () => {
		expect(lessonCounts({ sections: 6, routines: 1, figures: 0 })).toEqual([
			{ n: 6, word: 'sections' },
			{ n: 1, word: 'routine' },
			{ n: 0, word: 'figures' }
		]);
	});
});

describe('diskSubtitle', () => {
	it('names the size, or nothing at zero', () => {
		expect(diskSubtitle(3.4 * 1024 ** 3)).toBe('Videos on disk: 3.4 GB');
		expect(diskSubtitle(0)).toBeUndefined();
	});
});

describe('splitDrafts', () => {
	it('sets the drafts apart and keeps order', () => {
		const team = { id: 7, name: 'Class' };
		const a = { ...lesson('2026-11-02', { id: 1, team }), publishedAt: null };
		const b = { ...lesson('2026-11-01', { id: 2, team }), publishedAt: 5 };
		const c = { ...lesson('2026-10-01', { id: 3, team }), publishedAt: null };
		const got = splitDrafts([a, b, c]);
		expect(got.drafts.map((l) => l.id)).toEqual([1, 3]);
		expect(got.published.map((l) => l.id)).toEqual([2]);
	});
	it('a person’s own lesson is never a draft: only a group publishes', () => {
		const own = { ...lesson('2026-11-02', { id: 1 }), publishedAt: null };
		const added = {
			...lesson('2026-11-01', { id: 2, team: { id: 7, name: 'C' } }),
			publishedAt: 5
		};
		const got = splitDrafts([own, added]);
		expect(got.drafts).toEqual([]);
		expect(got.published.map((l) => l.id)).toEqual([1, 2]);
	});
	it('treats a lesson without publishedAt as published (the personal list)', () => {
		expect(splitDrafts([lesson('2026-11-01')]).published).toHaveLength(1);
	});
});

describe('emptyLessonsBody', () => {
	it('promises a Today review only outside a group', async () => {
		const { emptyLessonsBody } = await import('./list');
		expect(emptyLessonsBody(false)).toContain('Today');
		expect(emptyLessonsBody(true)).not.toContain('Today');
	});
});

describe('isOpenLesson', () => {
	it('is the open lesson, or a row standing for it as a twin', () => {
		expect(isOpenLesson({ id: 5 }, 5)).toBe(true);
		expect(isOpenLesson({ id: 5, twinIds: [9] }, 9)).toBe(true);
		expect(isOpenLesson({ id: 5 }, null)).toBe(false);
		expect(isOpenLesson({ id: 5, twinIds: [9] }, 7)).toBe(false);
	});
});

describe('groupVideosSubtitle', () => {
	it('says what the group has used of its limit', () => {
		expect(groupVideosSubtitle(1.6e9, 3e9)).toBe(
			`Group videos: ${byteSize(1.6e9)} of ${byteSize(3e9)}`
		);
		expect(groupVideosSubtitle(1.6 * 1024 ** 3, 3 * 1024 ** 3)).toBe(
			'Group videos: 1.6 GB of 3.0 GB'
		);
	});
});

describe('pickLesson', () => {
	it('is the empty pane’s words', () => {
		expect(pickLesson()).toEqual({
			title: 'Pick a lesson',
			body: 'Its notes, videos and what it teaches open here, beside the list.'
		});
	});
});

describe('the Lessons list in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('names a month alone, in the nominative', () => {
		const groups = sl(() => monthGroups([lesson('2026-11-03'), lesson('2026-10-27')]));
		expect(groups.map((g) => g.label)).toEqual(['november 2026', 'oktober 2026']);
	});

	it('the date tile in Slovenian', () => {
		expect(sl(() => dateTile('2026-10-28'))).toEqual({
			weekday: 'sre',
			day: 28,
			label: '28. oktobra 2026'
		});
	});

	it('counts videos in four forms, with a decimal comma', () => {
		const v = (videos: number, sized = false) =>
			sl(() => videoMeta({ videos, videoBytes: 1.2 * 1024 ** 3 }, sized));
		expect(v(1)).toBe('1 video');
		expect(v(2)).toBe('2 videa');
		expect(v(3)).toBe('3 videi');
		expect(v(5)).toBe('5 videov');
		expect(v(3, true)).toBe('3 videi · 1,2 GB');
		expect(sl(() => videoMeta({ videos: 1, videoBytes: 1.5 * 1024 ** 3 }))).toBe(
			'1 video · 1,5 GB'
		);
	});

	it('counts sections, routines and figures in four forms', () => {
		const words = (n: number) =>
			sl(() => lessonCounts({ sections: n, routines: n, figures: n })).map((c) => c.word);
		expect(words(1)).toEqual(['odsek', 'kombinacija', 'različica']);
		expect(words(2)).toEqual(['odseka', 'kombinaciji', 'različici']);
		expect(words(3)).toEqual(['odseki', 'kombinacije', 'različice']);
		expect(words(0)).toEqual(['odsekov', 'kombinacij', 'različic']);
	});

	it('the subtitles, the empty list and the empty pane', () => {
		expect(sl(() => diskSubtitle(3.4 * 1024 ** 3))).toBe('Videi na disku: 3,4 GB');
		expect(sl(() => groupVideosSubtitle(1.6 * 1024 ** 3, 3 * 1024 ** 3))).toBe(
			'Videi skupine: 1,6 GB od 3,0 GB'
		);
		expect(sl(() => emptyLessonsBody(false))).toContain('Danes');
		expect(sl(() => emptyLessonsBody(true))).not.toContain('Danes');
		expect(sl(() => pickLesson().title)).toBe('Izberite lekcijo');
	});
});
