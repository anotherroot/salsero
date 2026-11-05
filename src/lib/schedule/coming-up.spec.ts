import { describe, expect, it } from 'vitest';
import { shiftDay } from '$lib/day/day';
import { comingUp } from './coming-up';
import type { DayExercise, DayInput, DayPick } from './today-list';

const TZ = 'Europe/Ljubljana';
const TODAY = '2026-11-05';
const at = (day: string, h = 12) => Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00+01:00`);
const day = (n: number) => shiftDay(TODAY, n);
const NOW = at(TODAY, 15);

let seq = 100;
const ex = (name: string, createdDay: string, over: Partial<DayExercise> = {}): DayExercise => ({
	id: ++seq,
	name,
	active: true,
	archived: false,
	createdAt: at(createdDay, 9),
	everyDays: 3,
	...over
});
const pick = (e: DayExercise, kind: DayPick['kind']): DayPick => ({
	id: ++seq,
	exerciseId: e.id,
	kind,
	createdAt: NOW - 1000
});
const input = (
	exercises: DayExercise[],
	over: Partial<DayInput<DayExercise>> = {}
): DayInput<DayExercise> => ({
	exercises,
	sets: [],
	picks: [],
	daily: 1,
	now: NOW,
	timeZone: TZ,
	...over
});
const shape = (gs: ReturnType<typeof comingUp>) =>
	gs.map((g) => [g.key, g.away, g.rows.map((r) => `${r.exercise.name}:${r.state}`)]);

describe('comingUp', () => {
	it('orders Waiting, then days ascending, then Paused', () => {
		const first = ex('first', day(-2));
		const second = ex('second', day(-1));
		const later = ex('later', day(3));
		const tomorrow = ex('tomorrow', day(1));
		const off = ex('off', day(-9), { active: false });
		const gone = ex('gone', day(-9), { archived: true });
		const gs = comingUp(input([off, later, gone, second, tomorrow, first]));
		expect(shape(gs)).toEqual([
			['waiting', null, ['second:add']],
			[day(1), 'tomorrow', ['tomorrow:add']],
			[day(3), 'in 3 days', ['later:add']],
			['paused', null, ['off:paused']]
		]);
		expect(gs[0].day).toBeNull();
		expect(gs[1].day).toBe(day(1));
		expect(gs[3].rows[0].dueDay).toBeNull();
	});

	it('a skipped exercise sits in Waiting with state skipped', () => {
		const a = ex('a', day(-2));
		const b = ex('b', day(-1));
		const gs = comingUp(input([a, b], { picks: [pick(a, 'skip')] }));
		expect(shape(gs)).toEqual([['waiting', null, ['a:skipped']]]);
		// b is on Today (daily 1) and due already: not listed.
	});

	it('an added one shows as onToday under its date, a done one as doneToday', () => {
		const added = ex('added', day(2));
		const done = ex('done', day(-1), { everyDays: 2 });
		const gs = comingUp(
			input([added, done], {
				picks: [pick(added, 'add')],
				sets: [{ exerciseId: done.id, doneAt: at(TODAY, 10), rating: null }]
			})
		);
		expect(shape(gs)).toEqual([[day(2), 'in 2 days', ['done:doneToday', 'added:onToday']]]);
	});

	it('a year-away exercise is alone in its own group', () => {
		const far = ex('far', day(0), { everyDays: 365 });
		const near = ex('near', day(-1));
		const sets = [{ exerciseId: far.id, doneAt: at(TODAY, 8), rating: 5 }];
		const gs = comingUp(input([far, near], { sets, picks: [] }));
		const last = gs[gs.length - 1];
		expect(last.rows.map((r) => r.exercise.name)).toEqual(['far']);
		expect(last.rows[0].state).toBe('doneToday');
		expect(last.away).toMatch(/^in /);
	});

	it('leaves out a paused exercise from dates and archived from everywhere', () => {
		const p = ex('p', day(2), { active: false });
		const a = ex('a', day(2), { archived: true });
		expect(shape(comingUp(input([p, a])))).toEqual([['paused', null, ['p:paused']]]);
	});

	it('skipped not-yet-due picked row shows skipped in its date group', () => {
		const a = ex('a', day(-1));
		const ahead = ex('ahead', day(2));
		const gs = comingUp(input([a, ahead], { picks: [pick(ahead, 'next'), pick(ahead, 'skip')] }));
		// Not on Today (skipped), comes back in 2 days: under that day, marked skipped (its + re-adds).
		expect(shape(gs)).toEqual([[day(2), 'in 2 days', ['ahead:skipped']]]);
	});

	it('is empty with no exercises', () => {
		expect(comingUp(input([]))).toEqual([]);
	});
});
