import { describe, expect, it } from 'vitest';
import type { LessonItem } from '$lib/types';
import { dateTile, diskSubtitle, lessonCounts, monthGroups, videoMeta } from './list';

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
