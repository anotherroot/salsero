import { describe, expect, it } from 'vitest';
import { noonOf, shiftDay } from '$lib/day/day';
import { withLocale } from '$lib/i18n/current';
import type { DueState } from '$lib/schedule/schedule';
import type { DayList, DayRow, ListName, RowKind } from '$lib/schedule/today-list';
import type { DaySet, ExerciseItem } from '$lib/types';
import { backLine, doneForToday, warmupLine, warmupStreak } from './done-today';

const TZ = 'Europe/Ljubljana';
const D0 = '2026-11-07';
const D1 = shiftDay(D0, 1);
const Dm1 = shiftDay(D0, -1);
const Dm2 = shiftDay(D0, -2);
const Dm3 = shiftDay(D0, -3);
const Dm4 = shiftDay(D0, -4);
const at = (day: string, hour = 0) => noonOf(day, TZ) + hour * 3_600_000;

const due = (dueDay: string, more: Partial<DueState> = {}): DueState => ({
	gap: 1,
	lastDay: null,
	dueDay,
	every: null,
	learning: null,
	...more
});

const exercise = (id: number, source: ExerciseItem['source'] = 'custom') =>
	({ id, name: `E${id}`, source, partner: null }) as ExerciseItem;

const row = (
	id: number,
	kind: RowKind,
	list: ListName,
	state: DueState,
	start: DueState = due(D0),
	source: ExerciseItem['source'] = 'custom'
): DayRow<ExerciseItem> => ({
	exercise: exercise(id, source),
	kind,
	list,
	state,
	start,
	neverDone: false,
	pick: null
});

const dayOf = (rows: DayRow<ExerciseItem>[]): DayList<ExerciseItem> => ({
	today: D0,
	rows,
	warmups: rows.filter((r) => r.list === 'warmup').length,
	done: rows.filter((r) => r.kind === 'done').length,
	total: rows.length,
	left: rows.filter((r) => r.kind !== 'done').length,
	showNext: false,
	nothingLeft: null
});

let setId = 0;
const set = (
	exerciseId: number,
	doneAt: number,
	durationS: number | null,
	rating: number | null
): DaySet => ({
	id: ++setId,
	exerciseId,
	exerciseName: `E${exerciseId}`,
	doneAt,
	durationS,
	reps: null,
	rating,
	note: null
});

// warm-ups 10, 11 done; 1 done gotit due today+12; 2 learnt today due +3; 3 fixed rhythm due +2; 4 to do
const day = dayOf([
	row(10, 'done', 'warmup', due(D1)),
	row(11, 'done', 'warmup', due(D1)),
	row(1, 'done', 'practice', due(shiftDay(D0, 12)), due(D0), 'lesson'),
	row(
		2,
		'done',
		'practice',
		due(shiftDay(D0, 3)),
		due(D0, { learning: { good: 2, of: 3 } }),
		'routine'
	),
	row(3, 'done', 'practice', due(shiftDay(D0, 2), { every: 2 }), due(D0, { every: 2 })),
	row(4, 'todo', 'practice', due(D0))
]);
// Out of order on purpose: the face is the LAST rated set's, by time.
const todaySets = [
	set(1, at(D0, 2), 300, 4),
	set(10, at(D0, -3), 600, null),
	set(1, at(D0, 3), null, null), // later, but unrated: the face stays gotit
	set(1, at(D0, -1), null, 1), // earlier and rated hard
	set(11, at(D0, -2), 600, null),
	set(2, at(D0, 1), 300, 5),
	set(3, at(D0, 4), null, null)
];

describe('doneForToday', () => {
	it('folds the warm-ups, faces and back-in for the rest', () => {
		const v = doneForToday(day, todaySets, 7);
		expect(v.count).toBe(5);
		expect(v.seconds).toBe(1800);
		expect(v.warmup).toEqual({ done: 2, line: '2 done · 7 days in a row' });
		expect(v.rows.map((r) => [r.id, r.face, r.back])).toEqual([
			[1, 'gotit', 'Back in 12 days'],
			[2, 'easy', 'Learnt · back in 3 days'], // its third good day was today
			[3, null, 'Back in 2 days']
		]);
		// The tile's type and the name come along.
		expect(v.rows.map((r) => [r.name, r.source])).toEqual([
			['E1', 'lesson'],
			['E2', 'routine'],
			['E3', 'custom']
		]);
	});

	it('nothing done: 0, no rows, no warm-up', () => {
		const allSkipped = dayOf([
			row(1, 'todo', 'practice', due(D0)),
			row(10, 'todo', 'warmup', due(D0))
		]);
		expect(doneForToday(allSkipped, [], 0)).toEqual({
			count: 0,
			seconds: 0,
			warmup: null,
			rows: []
		});
	});

	it('only warm-ups done: the Warm-up row, no other rows', () => {
		const v = doneForToday(
			dayOf([row(10, 'done', 'warmup', due(D1))]),
			[set(10, at(D0), 120, null)],
			1
		);
		expect(v).toEqual({ count: 1, seconds: 120, warmup: { done: 1, line: '1 done' }, rows: [] });
	});
});

describe('backLine', () => {
	it('back tomorrow', () =>
		expect(backLine({ state: due(D1), start: due(D0) }, D0)).toBe('Back tomorrow'));
	it('back in days', () =>
		expect(backLine({ state: due(shiftDay(D0, 4)), start: due(D0) }, D0)).toBe('Back in 4 days'));
	it('still learning is not learnt', () =>
		expect(
			backLine(
				{
					state: due(D1, { learning: { good: 2, of: 3 } }),
					start: due(D0, { learning: { good: 1, of: 3 } })
				},
				D0
			)
		).toBe('Back tomorrow'));
});

describe('warmupLine', () => {
	it('the streak only from 2 days', () => {
		expect(warmupLine(2, 7)).toBe('2 done · 7 days in a row');
		expect(warmupLine(1, 1)).toBe('1 done');
		expect(warmupLine(3, 0)).toBe('3 done');
	});
});

describe('warmupStreak', () => {
	const s = (exerciseId: number, day: string) => ({ exerciseId, doneAt: at(day) });
	it('counts back from today, any warm-up a day', () => {
		const sets = [s(10, D0), s(11, Dm1), s(10, Dm2), s(9, Dm3), s(10, Dm4)]; // 9 is not a warm-up
		expect(warmupStreak(sets, new Set([10, 11]), D0, TZ)).toBe(3);
		expect(warmupStreak([s(10, Dm1)], new Set([10]), D0, TZ)).toBe(0);
		expect(warmupStreak([], new Set([10]), D0, TZ)).toBe(0);
	});
	it('a day is the local day', () => {
		// 23:30 on Dm1, half an hour before D0 begins: it counts as Dm1, so the run holds.
		const late = { exerciseId: 10, doneAt: noonOf(Dm1, TZ) + 11.5 * 3_600_000 };
		expect(warmupStreak([s(10, D0), late], new Set([10]), D0, TZ)).toBe(2);
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	it('warmupLine', () => {
		expect(sl(() => warmupLine(2, 7))).toBe('Opravljeno: 2 · 7 dni zapored');
		expect(sl(() => warmupLine(1, 2))).toBe('Opravljeno: 1 · 2 dneva zapored');
		expect(sl(() => warmupLine(1, 3))).toBe('Opravljeno: 1 · 3 dnevi zapored');
	});
	it('a learnt drill', () =>
		expect(
			sl(() =>
				backLine(
					{ state: due(shiftDay(D0, 3)), start: due(D0, { learning: { good: 2, of: 3 } }) },
					D0
				)
			)
		).toBe('Naučeno · spet čez 3 dni'));
});
