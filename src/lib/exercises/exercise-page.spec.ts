import { describe, expect, it } from 'vitest';
import { noonOf } from '$lib/day/day';
import { setSummary } from '$lib/format';
import { withLocale } from '$lib/i18n/current';
import { t } from '$lib/i18n/catalog';
import type { HistorySet, PracticeContent } from '$lib/types';
import {
	archiveBody,
	fromClassLabel,
	pageParts,
	recordingKeys,
	ownerOf,
	practisedLabel,
	historyTiles,
	historyRows
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

describe('historyTiles', () => {
	it('gives two tiles: the times and the time in all', () => {
		expect(historyTiles({ times: 3, totalS: 1020 })).toEqual([
			{ value: '3', label: 'times' },
			{ value: '17 min', label: 'in all' }
		]);
		expect(historyTiles({ times: 1, totalS: 0 })[0]).toEqual({ value: '1', label: 'time' });
	});
});

describe('historyRows', () => {
	const row = (
		day: string,
		hhmm: string,
		durationS: number | null,
		rating: number | null,
		note: string | null
	): HistorySet => ({
		...at(day, hhmm, note),
		durationS,
		rating
	});
	it('merges a day into one row, newest day first', () => {
		const rows = historyRows(
			[
				row('2026-10-15', '21:00', 120, 2, 'Lost the clave'),
				row('2026-10-15', '10:00', 240, 4, null),
				row('2026-10-10', '10:00', null, null, null)
			],
			TZ,
			'2026-11-07'
		);
		expect(rows).toEqual([
			{
				day: '2026-10-15',
				label: 'Thu 15 Oct',
				amount: '6 min',
				feel: 'getting',
				note: 'Lost the clave'
			},
			{ day: '2026-10-10', label: 'Sat 10 Oct', amount: null, feel: null, note: null }
		]);
	});
	it('adds old reps to the amount and writes another year in full', () => {
		const old = { ...row('2025-12-31', '10:00', 360, null, null), reps: 40 };
		expect(historyRows([old], TZ, '2026-11-07')[0]).toMatchObject({
			label: 'Wed 31 Dec, 2025',
			amount: '6 min · 40 reps'
		});
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
	it('says the history is kept once there is any', () => {
		expect(archiveBody('Clave', 3)).toBe('Clave leaves Today and every list. Its history is kept.');
		expect(archiveBody('Hips', 0)).toBe('Hips leaves Today and every list.');
	});
});

describe('recordingKeys', () => {
	it('sections then links: after an unlink or a removal the next row is the next section, else the next link', () => {
		const keys = recordingKeys([{ linkId: 4 }, { linkId: 9 }], [{ id: 2 }, { id: 5 }]);
		expect(keys).toEqual(['section-4', 'section-9', 'link-2', 'link-5']);
	});
});

describe("the history's words", () => {
	it('the empty history says Done, and a deleted day names itself', () => {
		expect(t().exercise.page.nothingYetBody).toBe(
			'Tap Done after you practise — it shows up here, grouped by day.'
		);
		expect(t().exercise.page.deleteDay).toBe('Delete this day');
		expect(t().exercise.page.dayDeleted('Thu 5 Nov')).toBe('Thu 5 Nov deleted');
	});
});

describe('pageParts', () => {
	it('the full page keeps everything', () => {
		expect(pageParts(false, true)).toEqual({
			editSettings: true,
			historyLink: true,
			sourceTabs: true,
			ownerRow: true,
			addBlock: true,
			historyTiles: true,
			settingsBlock: true,
			fromClass: false
		});
	});
	it('the simple page hides the rest, the history too', () => {
		const p = pageParts(true, false);
		expect(Object.entries(p).filter(([, v]) => v === true)).toEqual([]);
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

	it('words the history tiles', () => {
		expect(sl(() => historyTiles({ times: 3, totalS: 1020 }))).toEqual([
			{ value: '3', label: 'krat' },
			{ value: '17 min', label: 'skupaj' }
		]);
	});

	it('names the owner', () => {
		expect(sl(() => ownerOf(figureContent))?.meta).toBe('Različica');
		expect(sl(() => ownerOf(lessonContent))?.meta).toBe('Lekcija · 22. okt. 2026');
		expect(sl(() => ownerOf(routineContent))?.meta).toBe('Kombinacija');
	});

	it('asks about archiving, the name before a colon', () => {
		expect(sl(() => archiveBody('Hips', 0))).toBe(
			'Hips: izgine s seznama Danes in iz vseh seznamov.'
		);
		expect(sl(() => archiveBody('Hips', 2))).toBe(
			'Hips: izgine s seznama Danes in iz vseh seznamov. Zgodovina ostane shranjena.'
		);
	});

	it('words the way to the class, and a deleted day', () => {
		expect(sl(() => t().exercise.page.dayDeleted('čet, 5. nov.'))).toBe('Izbrisano: čet, 5. nov.');
		expect(sl(() => t().exercise.page.deleteDay)).toBe('Izbriši ta dan');
		expect(sl(() => t().exercise.page.nothingYetBody)).toBe(
			'Ko vadite, pritisnite Opravljeno. Tukaj se pokaže, razvrščeno po dnevih.'
		);
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
