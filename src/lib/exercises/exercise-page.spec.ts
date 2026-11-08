import { describe, expect, it } from 'vitest';
import { noonOf } from '$lib/day/day';
import { setSummary } from '$lib/format';
import { withLocale } from '$lib/i18n/current';
import type { HistorySet, PracticeContent } from '$lib/types';
import {
	archiveBody,
	fromClassLabel,
	pageParts,
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

describe('pageParts', () => {
	it('the full page keeps everything and says Log a set', () => {
		expect(pageParts(false, true)).toMatchObject({
			editSettings: true,
			historyLink: true,
			sourceTabs: true,
			ownerRow: true,
			addBlock: true,
			historyTiles: true,
			setList: true,
			settingsBlock: true,
			fromClass: false,
			logButton: 'Log a set'
		});
	});
	it('the simple page hides the rest and says I practised this', () => {
		const p = pageParts(true, false);
		expect(Object.entries(p).filter(([k, v]) => k !== 'logButton' && v === true)).toEqual([]);
		expect(p.logButton).toBe('I practised this');
	});
	it('From class shows only on the simple page, and only with a class', () => {
		expect(pageParts(true, true).fromClass).toBe(true);
		expect(pageParts(true, false).fromClass).toBe(false);
		expect(pageParts(false, true).fromClass).toBe(false);
	});
});

describe('fromClassLabel', () => {
	it('names the class day', () => {
		expect(fromClassLabel('2026-11-03', '2026-11-05')).toBe('From class Tue 3 Nov ›');
	});
	it('adds the year for another year', () => {
		expect(fromClassLabel('2025-11-04', '2026-11-05')).toBe('From class Tue 4 Nov 2025 ›');
	});
});

// The exercise page in Slovenian: the class's readers read no English.
describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('labels the tiles with the right plural', () => {
		const label = (sets: number) => sl(() => summaryTiles({ sets, totalS: 0, recentRating: null }));
		expect(label(1).map((x) => x.label)).toEqual(['vnos', 'skupaj', 'nedavno']);
		expect(label(2)[0].label).toBe('vnosa');
		expect(label(3)[0].label).toBe('vnosi');
		expect(label(23)[0].label).toBe('vnosov');
		expect(label(104)[0].label).toBe('vnosi');
		expect(label(5)[0].label).toBe('vnosov');
		expect(label(101)[0].label).toBe('vnos');
		expect(sl(() => summaryTiles({ sets: 2, totalS: 60, recentRating: 4.6 }))[2].value).toBe(
			'Lahko'
		);
	});

	it('names the days of the history', () => {
		const d = sl(() =>
			historyDays(
				[at('2026-10-31', '19:42'), at('2026-10-30', '20:00'), at('2025-12-30', '18:00')],
				TZ,
				'2026-10-31'
			)
		);
		expect(d.map((g) => g.label)).toEqual(['Danes', 'Včeraj', 'torek, 30. december 2025']);
	});

	it('titles a set with nothing to sum up, and sums one up', () => {
		expect(sl(() => setTitle({ durationS: null, reps: null, rating: null })).text).toBe('Vnos');
		expect(sl(() => setTitle({ durationS: 300, reps: 12, rating: null })).text).toBe(
			'5 min · 12 ponovitev'
		);
	});

	it('names the owner', () => {
		expect(sl(() => ownerOf(figureContent))?.meta).toBe('Različica');
		expect(sl(() => ownerOf(lessonContent))?.meta).toBe('Lekcija · 22. okt. 2026');
		expect(sl(() => ownerOf(routineContent))?.meta).toBe('Kombinacija');
	});

	it('asks about archiving, the name before a colon and the sets counted', () => {
		expect(sl(() => archiveBody('Hips', 0))).toBe('Hips: izgine z Danes in iz vseh seznamov.');
		expect(sl(() => archiveBody('Hips', 1))).toBe(
			'Hips: izgine z Danes in iz vseh seznamov. Shranjen ostane 1 vnos.'
		);
		expect(sl(() => archiveBody('Hips', 2))).toBe(
			'Hips: izgine z Danes in iz vseh seznamov. Shranjena ostaneta 2 vnosa.'
		);
		expect(sl(() => archiveBody('Hips', 3))).toBe(
			'Hips: izgine z Danes in iz vseh seznamov. Shranjeni ostanejo 3 vnosi.'
		);
		expect(sl(() => archiveBody('Hips', 41))).toBe(
			'Hips: izgine z Danes in iz vseh seznamov. Shranjenih ostane 41 vnosov.'
		);
	});

	it('words the pinned button and the way to the class', () => {
		expect(sl(() => pageParts(false, false)).logButton).toBe('Nov vnos');
		expect(sl(() => pageParts(true, true)).logButton).toBe('Opravljeno');
		expect(sl(() => fromClassLabel('2026-11-03', '2026-11-05'))).toBe('Z lekcije tor, 3. nov. ›');
	});
});

describe('setSummary in Slovenian', () => {
	it('counts reps in all four forms', () => {
		const reps = (n: number) =>
			withLocale('sl', () => setSummary({ durationS: null, reps: n, rating: null }));
		expect(reps(1)).toBe('1 ponovitev');
		expect(reps(2)).toBe('2 ponovitvi');
		expect(reps(3)).toBe('3 ponovitve');
		expect(reps(12)).toBe('12 ponovitev');
		expect(withLocale('sl', () => setSummary({ durationS: 300, reps: 12, rating: null }))).toBe(
			'5 min · 12 ponovitev'
		);
	});
});
