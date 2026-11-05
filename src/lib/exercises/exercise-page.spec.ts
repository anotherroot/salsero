import { describe, expect, it } from 'vitest';
import { noonOf } from '$lib/day/day';
import type { HistorySet, PracticeContent } from '$lib/types';
import {
	archiveBody,
	historyDays,
	ownerOf,
	practisedLabel,
	setMeta,
	setTitle,
	summaryTiles
} from './exercise-page';

const TZ = 'Europe/Ljubljana';
const at = (day: string, hhmm: string, note: string | null = null): HistorySet => {
	const [h, m] = hhmm.split(':').map(Number);
	return {
		id: 1,
		doneAt: noonOf(day, TZ) + ((h - 12) * 60 + m) * 60_000,
		durationS: null,
		reps: null,
		rating: null,
		note
	};
};

const figureContent: PracticeContent = {
	type: 'figure',
	figure: { id: 12, name: 'Enchufla · Doble', say: '', notes: null, eights: 1 },
	links: [],
	recordings: [],
	sections: []
};
const lessonContent: PracticeContent = {
	type: 'lesson',
	lesson: { id: 3, title: 'Thursday class', lessonDay: '2026-10-22', notes: null },
	links: [],
	videos: [],
	figures: []
};
const routineContent: PracticeContent = {
	type: 'routine',
	routine: { id: 4, name: 'Show', notes: null },
	slots: []
};
const drillContent: PracticeContent = { type: 'drill', notes: null, links: [], sections: [] };

describe('practisedLabel', () => {
	it('uses minutes under an hour, then h and padded minutes', () => {
		expect(practisedLabel(0)).toBe('0 min');
		expect(practisedLabel(2700)).toBe('45 min');
		expect(practisedLabel(15000)).toBe('4 h 10');
		expect(practisedLabel(21900)).toBe('6 h 05');
	});
});

describe('summaryTiles', () => {
	it('gives three tiles', () => {
		expect(summaryTiles({ sets: 23, totalS: 15000, recentRating: 3.8 })).toEqual([
			{ value: '23', label: 'sets', feel: null },
			{ value: '4 h 10', label: 'practised', feel: null },
			{ value: "I've got it", label: 'recently', feel: 'gotit' }
		]);
		expect(
			summaryTiles({ sets: 1, totalS: 0, recentRating: null }).map((t) => [t.value, t.label])
		).toEqual([
			['1', 'set'],
			['0 min', 'practised'],
			['–', 'recently']
		]);
		expect(summaryTiles({ sets: 2, totalS: 60, recentRating: 4.6 })[2].value).toBe('Easy');
	});
});

describe('historyDays', () => {
	it('groups newest first and labels the days', () => {
		const d = historyDays(
			[
				at('2026-10-31', '19:42'),
				at('2026-10-31', '08:15'),
				at('2026-10-30', '20:00'),
				at('2026-10-27', '20:05'),
				at('2025-12-30', '18:00')
			],
			TZ,
			'2026-10-31'
		);
		expect(d.map((g) => g.label)).toEqual([
			'Today',
			'Yesterday',
			'Tuesday, 27 October',
			'Tuesday, 30 December, 2025'
		]);
		expect(d[0].sets).toHaveLength(2);
	});
});

describe('setTitle / setMeta', () => {
	it('titles a set', () => {
		expect(setTitle({ durationS: 360, reps: null, rating: 4 })).toEqual({
			text: '6 min',
			rating: 4
		});
		expect(setTitle({ durationS: 480, reps: 20, rating: null })).toEqual({
			text: '8 min · 20 reps',
			rating: null
		});
		expect(setTitle({ durationS: null, reps: null, rating: 3 })).toEqual({ text: '', rating: 3 });
		expect(setTitle({ durationS: null, reps: null, rating: null })).toEqual({
			text: 'Set',
			rating: null
		});
	});
	it('gives the time and note', () => {
		expect(setMeta(at('2026-10-31', '19:42', 'Turn felt late'), TZ)).toBe('19:42 · Turn felt late');
		expect(setMeta(at('2026-10-31', '08:15'), TZ)).toBe('08:15');
	});
});

describe('ownerOf', () => {
	it('names the owner by type', () => {
		expect(ownerOf(figureContent)).toEqual({
			kind: 'figure',
			id: 12,
			title: 'Enchufla · Doble',
			meta: 'Figure',
			icon: 'footprints'
		});
		expect(ownerOf(lessonContent)).toMatchObject({
			kind: 'lesson',
			title: 'Thursday class',
			meta: 'Lesson · 22 Oct 2026',
			icon: 'lessons'
		});
		expect(ownerOf(routineContent)).toMatchObject({
			kind: 'routine',
			meta: 'Routine',
			icon: 'route'
		});
		expect(ownerOf(drillContent)).toBeNull();
	});
});

describe('archiveBody', () => {
	it('counts the kept sets', () => {
		expect(archiveBody('Clave clapping · 2-3', 41)).toBe(
			'Clave clapping · 2-3 leaves Today and every list. Its 41 sets are kept.'
		);
		expect(archiveBody('Hips', 1)).toBe('Hips leaves Today and every list. Its 1 set is kept.');
		expect(archiveBody('Hips', 0)).toBe('Hips leaves Today and every list.');
	});
});
