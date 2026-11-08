import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import type { DayList, DayRow, RowKind } from '$lib/schedule/today-list';
import type { DayPick } from '$lib/schedule/picks';
import type { ScheduleState } from '$lib/schedule/schedule';
import type { DaySet, ExerciseItem } from '$lib/types';
import {
	deletedGroupName,
	listLabel,
	nothingLeftMeta,
	notTodayMessage,
	onTodayMessage,
	pastGroups,
	rowMeta,
	tileTone,
	todayHero,
	undoLogMessage
} from './today';

const TODAY = '2026-11-05'; // a Thursday

function ex(id: number, name = `E${id}`): ExerciseItem {
	return {
		id,
		name,
		source: 'custom',
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
		team: null
	};
}

const st = (dueDay: string, gap = 3, lastDay: string | null = '2026-11-01'): ScheduleState => ({
	gap,
	lastDay,
	dueDay
});

function row(
	kind: RowKind,
	o: {
		start?: ScheduleState;
		state?: ScheduleState;
		neverDone?: boolean;
		pick?: DayPick['kind'];
	} = {}
): DayRow<ExerciseItem> {
	const start = o.start ?? st(TODAY);
	return {
		exercise: ex(1, 'Basic step on 1'),
		kind,
		start,
		state: o.state ?? start,
		neverDone: o.neverDone ?? false,
		pick: o.pick ? { id: 9, exerciseId: 1, kind: o.pick, createdAt: 0 } : null
	};
}

const words = (m: { text: string }[]) => m.map((p) => p.text).join(' · ');

describe('rowMeta', () => {
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
	it('late and due today', () => {
		expect(rowMeta(row('todo', { start: st('2026-11-03') }), TODAY, null)).toEqual([
			{ text: '2 days late', tone: 'status' }
		]);
		expect(words(rowMeta(row('todo', { start: st(TODAY) }), TODAY, null))).toBe('Due today');
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
	it('picked by Next when already due: the due words', () => {
		expect(words(rowMeta(row('picked', { pick: 'next', start: st(TODAY) }), TODAY, null))).toBe(
			'Due today'
		);
		expect(rowMeta(row('picked', { pick: 'next', start: st('2026-11-01') }), TODAY, null)).toEqual([
			{ text: '4 days late', tone: 'status' }
		]);
	});
	it('added from Coming up: Added · due tomorrow', () => {
		expect(
			words(rowMeta(row('picked', { pick: 'add', start: st('2026-11-06') }), TODAY, null))
		).toBe('Added · due tomorrow');
		expect(
			words(rowMeta(row('picked', { pick: 'add', start: st('2026-11-04') }), TODAY, null))
		).toBe('Added · 1 day late');
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
		done: 0,
		total: 0,
		left: 0,
		showNext: false,
		nothingLeft: null,
		...o
	};
}

describe('todayHero', () => {
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

describe('listLabel', () => {
	it('Today · N, or Done today · N once nothing is left', () => {
		expect(listLabel({ total: 5, nothingLeft: null })).toBe('Today · 5');
		expect(listLabel({ total: 14, nothingLeft: { next: ex(2), day: '2026-11-06', more: 0 } })).toBe(
			'Done today · 14'
		);
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
	const set = (id: number, exerciseId: number, t: string): DaySet => ({
		id,
		exerciseId,
		exerciseName: `E${exerciseId}`,
		doneAt: Date.parse(`2026-10-30T${t}:00Z`),
		durationS: null,
		reps: null,
		rating: null,
		note: null
	});
	it('groups by exercise, first done first, oldest set first', () => {
		const g = pastGroups([set(3, 1, '20:10'), set(1, 1, '19:42'), set(2, 2, '18:05')]);
		expect(g.map((x) => x.exerciseId)).toEqual([2, 1]);
		expect(g[1].sets.map((s) => s.id)).toEqual([1, 3]);
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
describe('undoLogMessage', () => {
	it('names the exercise and when it comes back', () => {
		expect(undoLogMessage('Basic step on 1', 5)).toBe('Basic step on 1 · back in 5 days');
		expect(undoLogMessage('Basic step on 1', 21)).toBe('Basic step on 1 · back in 3 weeks');
		expect(undoLogMessage('Basic step on 1', 75)).toBe('Basic step on 1 · back in 3 months');
		// As the row says it ("Done · Back in a week").
		expect(undoLogMessage('Setenta', 7)).toBe('Setenta · back in a week');
		expect(undoLogMessage('Setenta', 365)).toBe('Setenta · back in a year');
	});

	it('says tomorrow for a gap of one day', () => {
		expect(undoLogMessage('Setenta', 1)).toBe('Setenta · back tomorrow');
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

	it("the list's heading, and what comes back once nothing is left", () => {
		expect(sl(() => listLabel({ total: 5, nothingLeft: null }))).toBe('Danes · 5');
		expect(
			sl(() => listLabel({ total: 14, nothingLeft: { next: ex(2), day: '2026-11-06', more: 0 } }))
		).toBe('Opravljeno danes · 14');
		expect(sl(() => nothingLeftMeta({ day: '2026-11-06', more: 3 }, TODAY))).toBe(
			'Jutri · in še 3'
		);
		expect(sl(() => nothingLeftMeta({ day: '2026-11-08', more: 0 }, TODAY))).toBe('V nedeljo');
		expect(sl(() => nothingLeftMeta({ day: '2026-11-20', more: 1 }, TODAY))).toBe(
			'20. nov. · in še 1'
		);
	});

	it('the toasts: a logged set, Not today and Coming up’s +', () => {
		expect(sl(() => undoLogMessage('Setenta', 7))).toBe('Setenta · spet čez en teden');
		expect(sl(() => undoLogMessage('Setenta', 1))).toBe('Setenta · spet jutri');
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
