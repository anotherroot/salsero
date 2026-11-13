import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import type { DayList, DayRow, RowKind } from '$lib/schedule/today-list';
import type { DayPick } from '$lib/schedule/picks';
import { FACES } from '$lib/schedule/comes-back';
import type { DueState } from '$lib/schedule/schedule';
import type { DaySet, ExerciseItem } from '$lib/types';
import {
	deletedGroupName,
	listLabels,
	nothingLeftMeta,
	notTodayMessage,
	onTodayMessage,
	pastGroups,
	pastLine,
	pastTiles,
	rowMeta,
	tileTone,
	todayHero
} from './today';
import { t } from '$lib/i18n/catalog';

const TODAY = '2026-11-05'; // a Thursday

function ex(id: number, name = `E${id}`): ExerciseItem {
	return {
		id,
		name,
		source: 'custom',
		kind: null,
		hearing: null,
		figureId: null,
		lessonId: null,
		routineId: null,
		partner: null,
		practiceMode: 'none',
		songId: null,
		countBpm: null,
		practiceJson: null,
		everyDays: 3,
		active: true,
		archived: false,
		notes: null,
		createdAt: 0,
		comesBack: FACES,
		comesBackOwn: null,
		comesBackTeacher: null,
		warmup: false,
		warmupOrder: null,
		team: null
	};
}

const st = (dueDay: string, gap = 3, lastDay: string | null = '2026-11-01'): DueState => ({
	gap,
	lastDay,
	dueDay,
	every: null,
	learning: null
});

function row(
	kind: RowKind,
	o: {
		start?: DueState;
		state?: DueState;
		neverDone?: boolean;
		pick?: DayPick['kind'];
	} = {}
): DayRow<ExerciseItem> {
	const start = o.start ?? st(TODAY);
	return {
		exercise: ex(1, 'Basic step on 1'),
		kind,
		list: 'practice',
		start,
		state: o.state ?? start,
		neverDone: o.neverDone ?? false,
		pick: o.pick ? { id: 9, exerciseId: 1, kind: o.pick, createdAt: 0 } : null
	};
}

const words = (m: { text: string }[]) => m.map((p) => p.text).join(' · ');

describe('rowMeta', () => {
	it('a hearing drill says its last score and its songs (phase 2)', () => {
		const r = row('todo', { start: st(TODAY) });
		r.exercise = { ...r.exercise, kind: 'hearing', hearing: { last: 64, songs: 3 } };
		expect(rowMeta(r, TODAY, null)).toEqual([
			{ text: 'Last time 64', tone: null },
			{ text: '3 songs', tone: null }
		]);
		const fresh = row('todo', { neverDone: true, start: st(TODAY, 3, null) });
		fresh.exercise = { ...fresh.exercise, kind: 'hearing', hearing: { last: null, songs: 1 } };
		expect(rowMeta(fresh, TODAY, null)).toEqual([
			{ text: 'New', tone: 'status' },
			{ text: '1 song', tone: null }
		]);
	});
	it('done: Done, then when it comes back', () => {
		const m = rowMeta(row('done', { state: st('2026-11-12', 7, TODAY) }), TODAY, null);
		expect(m).toEqual([
			{ text: 'Done', tone: 'done' },
			{ text: 'Back in a week', tone: null }
		]);
	});
	it('never done: New, and the class it came from', () => {
		const r = row('todo', { neverDone: true, start: st(TODAY, 3, null) });
		expect(rowMeta(r, TODAY, 'Tue 3 Nov')).toEqual([
			{ text: 'New', tone: 'status' },
			{ text: 'from class Tue 3 Nov', tone: null }
		]);
		expect(rowMeta(r, TODAY, null)).toEqual([{ text: 'New', tone: 'status' }]);
	});
	it('due today or long past: no due wording at all', () => {
		expect(rowMeta(row('todo', { start: st('2026-10-16') }), TODAY, null)).toEqual([]);
		expect(rowMeta(row('todo', { start: st(TODAY) }), TODAY, null)).toEqual([]);
	});
	it('a drill row ends in its rhythm or its learning', () => {
		const every: DueState = { ...st(TODAY), every: 2 };
		expect(rowMeta(row('todo', { start: every }), TODAY, null)).toEqual([
			{ text: 'Every 2 days', tone: null }
		]);
		const learning: DueState = { ...st(TODAY), learning: { good: 2, of: 3 } };
		expect(rowMeta(row('todo', { start: learning }), TODAY, null)).toEqual([
			{ text: 'Learning · 2 of 3 good days', tone: null }
		]);
	});
	it('a done row stays Done · back', () => {
		const every: DueState = { ...st('2026-11-07', 2, TODAY), every: 2 };
		expect(words(rowMeta(row('done', { state: every }), TODAY, null))).toBe(
			'Done · Back in 2 days'
		);
	});
	it('picked by Next before its day: Ahead · due Sunday', () => {
		const r = row('picked', { pick: 'next', start: st('2026-11-08') });
		expect(rowMeta(r, TODAY, null)).toEqual([
			{ text: 'Ahead', tone: null },
			{ text: 'due Sunday', tone: null }
		]);
		expect(
			words(rowMeta(row('picked', { pick: 'next', start: st('2026-11-14') }), TODAY, null))
		).toBe('Ahead · due 14 Nov');
	});
	it('picked by Next when already due: nothing to say about the day', () => {
		expect(rowMeta(row('picked', { pick: 'next', start: st(TODAY) }), TODAY, null)).toEqual([]);
		expect(rowMeta(row('picked', { pick: 'next', start: st('2026-11-01') }), TODAY, null)).toEqual(
			[]
		);
	});
	it('added from Coming up: Added · due tomorrow', () => {
		expect(
			words(rowMeta(row('picked', { pick: 'add', start: st('2026-11-06') }), TODAY, null))
		).toBe('Added · due tomorrow');
		expect(
			words(rowMeta(row('picked', { pick: 'add', start: st('2026-11-04') }), TODAY, null))
		).toBe('Added');
	});
});

describe('tileTone', () => {
	it('done rows take the done tile, the rest the accent one', () => {
		expect(tileTone('done')).toBe('done');
		expect(tileTone('todo')).toBe('accent');
		expect(tileTone('picked')).toBe('accent');
	});
});

function list(o: Partial<DayList<ExerciseItem>>): DayList<ExerciseItem> {
	return {
		today: TODAY,
		rows: [],
		warmups: 0,
		done: 0,
		total: 0,
		left: 0,
		showNext: false,
		nothingLeft: null,
		...o
	};
}

describe('todayHero', () => {
	// Catches: the play still named after plan 2's interim session, or its Resume and Up next left over.
	it('the play reads Start', () => {
		expect(t().today.hero.start).toBe('Start');
		expect(withLocale('sl', () => t().today.hero.start)).toBe('Začni');
		expect('resume' in t().today.hero).toBe(false);
		expect('upNext' in t().today.row).toBe(false);
	});
	it('the hero says about how long', () => {
		expect(todayHero(list({ done: 0, total: 7, left: 7 }), 1800).meta).toBe(
			'0 of 7 done · about 30 min'
		);
		expect(todayHero(list({ done: 0, total: 7, left: 7 }), 20).meta).toBe(
			'0 of 7 done · about 1 min'
		);
		expect(todayHero(list({ done: 0, total: 7, left: 7 }), null).meta).toBe('0 of 7 done');
	});
	it('before anything is done: N for today; after, N left for today', () => {
		expect(todayHero(list({ done: 0, total: 7, left: 7 }))).toMatchObject({
			title: '7 for today',
			meta: '0 of 7 done'
		});
		expect(todayHero(list({ done: 2, total: 7, left: 5 })).title).toBe('5 left for today');
	});
	it('to do: how many are left, and done of all', () => {
		expect(todayHero(list({ done: 2, total: 5, left: 3 }))).toEqual({
			title: '3 left for today',
			meta: '2 of 5 done',
			progress: 0.4,
			bar: true,
			state: 'todo'
		});
		expect(todayHero(list({ done: 4, total: 5, left: 1 })).title).toBe('1 left for today');
	});
	it('all done, more in line', () => {
		expect(todayHero(list({ done: 5, total: 5, left: 0, showNext: true }))).toEqual({
			title: 'All 5 done',
			meta: "That's today's practice",
			progress: 1,
			bar: true,
			state: 'done'
		});
	});
	it('nothing left at all', () => {
		const h = todayHero(
			list({
				done: 14,
				total: 14,
				nothingLeft: { next: ex(2), day: '2026-11-06', more: 3 }
			})
		);
		expect(h).toEqual({
			title: "You've done everything",
			meta: 'Every exercise is done until tomorrow',
			progress: 1,
			bar: false,
			state: 'nothing'
		});
		expect(
			todayHero(
				list({ done: 3, total: 3, nothingLeft: { next: ex(2), day: '2026-11-08', more: 0 } })
			).meta
		).toBe('Every exercise is done until Sunday');
	});
	it('nothing left, nothing done (all skipped): it never says done', () => {
		const h = todayHero(list({ nothingLeft: { next: ex(2), day: '2026-11-06', more: 0 } }));
		expect(h).toEqual({
			title: 'Nothing left for today',
			meta: 'The rest comes back tomorrow',
			progress: 0,
			bar: false,
			state: 'nothing'
		});
		expect(h.title + h.meta).not.toMatch(/done/i);
	});
	it('nothing due today but more ahead: no bar', () => {
		expect(todayHero(list({ showNext: true }))).toEqual({
			title: 'Nothing due today',
			meta: 'You can practise ahead below',
			progress: 0,
			bar: false,
			state: 'done'
		});
	});
});

describe('listLabels', () => {
	it('Warm-up · N and Practice · N', () => {
		expect(listLabels({ total: 7, warmups: 2, nothingLeft: null })).toEqual({
			warmup: 'Warm-up · 2',
			practice: 'Practice · 5'
		});
	});
	it('no warm-ups: no warm-up label', () => {
		expect(listLabels({ total: 5, warmups: 0, nothingLeft: null }).warmup).toBeNull();
	});
	it('Done today · N once nothing is left', () => {
		const nothingLeft = { next: ex(2), day: '2026-11-06', more: 0 };
		expect(listLabels({ total: 14, warmups: 0, nothingLeft }).practice).toBe('Done today · 14');
	});
});

describe('nothingLeftMeta', () => {
	it('names the day, and how many more come then', () => {
		expect(nothingLeftMeta({ day: '2026-11-06', more: 3 }, TODAY)).toBe('Tomorrow · and 3 more');
		expect(nothingLeftMeta({ day: '2026-11-08', more: 0 }, TODAY)).toBe('Sunday');
		expect(nothingLeftMeta({ day: '2026-11-20', more: 1 }, TODAY)).toBe('20 Nov · and 1 more');
	});
});

describe('pastGroups', () => {
	const set = (
		id: number,
		exerciseId: number,
		t: string,
		durationS: number | null = null
	): DaySet => ({
		id,
		exerciseId,
		exerciseName: `E${exerciseId}`,
		doneAt: Date.parse(`2026-10-30T${t}:00Z`),
		durationS,
		reps: null,
		rating: null,
		note: null
	});
	it('one merged entry per exercise, first done first', () => {
		const g = pastGroups([set(3, 1, '20:10', 120), set(1, 1, '19:42', 240), set(2, 2, '18:05')]);
		expect(g.map((x) => x.exerciseId)).toEqual([2, 1]);
		expect(g[1].entry.durationS).toBe(360);
		expect(g[0].entry.durationS).toBeNull();
	});

	it("carries the time of the exercise's first set that day", () => {
		const g = pastGroups([set(2, 1, '10:00'), set(1, 1, '09:00')]);
		expect(g[0].at).toBe(Date.parse('2026-10-30T09:00:00Z'));
	});
});

describe('pastLine', () => {
	const at = Date.parse('2026-11-02T09:51:00Z');
	const entry = { durationS: null, reps: null, rating: 2, note: null };
	it('the time, then minutes or reps, never the feeling', () => {
		expect(pastLine(at, { ...entry, durationS: 420 }, 'Europe/Ljubljana')).toBe('10:51 · 7 min');
		expect(pastLine(at, { ...entry, reps: 3 }, 'Europe/Ljubljana')).toBe('10:51 · 3 reps');
		expect(pastLine(at, entry, 'Europe/Ljubljana')).toBe('10:51');
	});
});

describe('pastTiles', () => {
	it('counts the exercises and adds up the minutes', () => {
		const e = (durationS: number | null) => ({ durationS, reps: null, rating: null, note: null });
		expect(pastTiles([e(420), e(480), e(null), e(312)])).toEqual([
			{ value: '4', label: 'exercises' },
			{ value: '20 min', label: 'practised' }
		]);
	});
});

describe('deletedGroupName', () => {
	// The spec's words: a log keeps its name once its group is purged.
	it('names what was practised and its group, marked deleted', () => {
		expect(deletedGroupName('Tue 3 Nov', 'Salsa nadaljevalna')).toBe(
			'Tue 3 Nov · Salsa nadaljevalna (deleted)'
		);
	});
});
describe("a past day's words", () => {
	it('adds an exercise to the day, never a set', () => {
		expect(t().today.past.add).toBe('Add an exercise to this day');
		expect(t().today.past.logOn('Thu 5 Nov')).toBe('Add to Thu 5 Nov');
		expect(t().today.past.monthTotals(3, 15)).toBe('3 days · 15 exercises');
		expect(t().today.past.monthTotals(1, 1)).toBe('1 day · 1 exercise');
		expect(t().today.past.dayCount('Mon 2 Nov', 11)).toBe('Mon 2 Nov, 11 exercises');
		expect(t().today.past.dayCount('Tue 3 Nov', 0)).toBe('Tue 3 Nov');
	});

	it('in Slovenian', () => {
		const sl = <T>(fn: () => T) => withLocale('sl', fn);
		expect(sl(() => t().today.past.add)).toBe('Dodaj vajo za ta dan');
		expect(sl(() => t().today.past.logOn('čet, 5. nov.'))).toBe('Dodaj za čet, 5. nov.');
		expect(sl(() => t().today.past.monthTotals(3, 15))).toBe('3 dnevi · 15 vaj');
		expect(sl(() => t().today.past.monthTotals(2, 2))).toBe('2 dneva · 2 vaji');
		expect(sl(() => t().today.past.dayCount('pon, 2. nov.', 11))).toBe('pon, 2. nov., 11 vaj');
		expect(sl(() => t().today.past.nothingThatDay)).toBe('Ta dan ni vpisane vadbe');
	});
});

// Today in Slovenian (the class reads it every day). Each case fails if the
// catalog entry were the English one.
describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it.each([
		[1, 'Še 1 vaja za danes'],
		[2, 'Še 2 vaji za danes'],
		[3, 'Še 3 vaje za danes'],
		[5, 'Še 5 vaj za danes']
	])('the bar card counts what is left: %s -> %s', (left, title) => {
		const h = sl(() => todayHero(list({ done: 1, total: left + 1, left })));
		expect(h.title).toBe(title);
		expect(h.meta).toBe(`Opravljeno: 1 od ${left + 1}`);
	});

	it('the bar card before anything is done', () => {
		expect(sl(() => todayHero(list({ done: 0, total: 5, left: 5 })).title)).toBe('5 vaj za danes');
		expect(sl(() => todayHero(list({ done: 0, total: 2, left: 2 })).title)).toBe('2 vaji za danes');
	});

	it('the bar card once the day is done, and once nothing is left', () => {
		expect(sl(() => todayHero(list({ done: 5, total: 5, showNext: true })))).toMatchObject({
			title: 'Vse opravljeno',
			meta: 'Današnja vadba je končana'
		});
		const left = (day: string, done: number) =>
			sl(() => todayHero(list({ done, total: done, nothingLeft: { next: ex(2), day, more: 0 } })));
		expect(left('2026-11-06', 3)).toMatchObject({
			title: 'Vse vaje so opravljene',
			meta: 'Naslednja je na vrsti jutri'
		});
		expect(left('2026-11-08', 3).meta).toBe('Naslednja je na vrsti v nedeljo');
		expect(left('2026-11-20', 3).meta).toBe('Naslednja je na vrsti 20. nov.');
		expect(left('2026-11-08', 0)).toMatchObject({
			title: 'Za danes ni nič več',
			meta: 'Ostale so spet na vrsti v nedeljo'
		});
		expect(sl(() => todayHero(list({ showNext: true })))).toMatchObject({
			title: 'Danes ni nič na vrsti',
			meta: 'Spodaj lahko vadite vnaprej'
		});
		expect(sl(() => todayHero(list({})))).toMatchObject({
			title: 'Danes ni ničesar',
			meta: 'Vse vaje so na premoru'
		});
	});

	it("a row's meta", () => {
		const done = sl(() => rowMeta(row('done', { state: st('2026-11-12', 7, TODAY) }), TODAY, null));
		expect(words(done)).toBe('Opravljeno · Spet čez en teden');
		const fresh = row('todo', { neverDone: true, start: st(TODAY, 3, null) });
		expect(words(sl(() => rowMeta(fresh, TODAY, 'tor, 3. nov.')))).toBe(
			'Nova · z lekcije tor, 3. nov.'
		);
		const ahead = row('picked', { pick: 'next', start: st('2026-11-08') });
		expect(words(sl(() => rowMeta(ahead, TODAY, null)))).toBe('Vnaprej · na vrsti v nedeljo');
		const added = row('picked', { pick: 'add', start: st('2026-11-06') });
		expect(words(sl(() => rowMeta(added, TODAY, null)))).toBe('Dodano · na vrsti jutri');
	});

	it("the lists' headings, and what comes back once nothing is left", () => {
		expect(sl(() => listLabels({ total: 7, warmups: 2, nothingLeft: null }))).toEqual({
			warmup: 'Ogrevanje · 2',
			practice: 'Vaje · 5'
		});
		const nothingLeft = { next: ex(2), day: '2026-11-06', more: 0 };
		expect(sl(() => listLabels({ total: 14, warmups: 0, nothingLeft }).practice)).toBe(
			'Opravljeno danes · 14'
		);
		expect(sl(() => nothingLeftMeta({ day: '2026-11-06', more: 3 }, TODAY))).toBe(
			'Jutri · in še 3'
		);
		expect(sl(() => nothingLeftMeta({ day: '2026-11-08', more: 0 }, TODAY))).toBe('V nedeljo');
		expect(sl(() => nothingLeftMeta({ day: '2026-11-20', more: 1 }, TODAY))).toBe(
			'20. nov. · in še 1'
		);
	});

	it('the toasts: Not today and Coming up’s +', () => {
		expect(sl(() => notTodayMessage('Setenta'))).toBe('Setenta · ne danes');
		expect(sl(() => onTodayMessage('Setenta'))).toBe('Setenta · dodano za danes');
	});

	it("a purged group's log", () => {
		expect(sl(() => deletedGroupName('tor, 3. nov.', 'Salsa nadaljevalna'))).toBe(
			'tor, 3. nov. · Salsa nadaljevalna (izbrisana)'
		);
	});
});

describe('the toasts in English', () => {
	it('Not today and Coming up’s +', () => {
		expect(notTodayMessage('Setenta')).toBe('Setenta · Not today');
		expect(onTodayMessage('Setenta')).toBe('Setenta is on Today');
	});
});
