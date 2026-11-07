import { FACES } from './comes-back';
import { describe, expect, it } from 'vitest';
import { shiftDay } from '$lib/day/day';
import { RATING_OF } from './feel';
import {
	dayList,
	dayListOf,
	inLine,
	workOf,
	type DayExercise,
	type DayInput,
	type DayPick
} from './today-list';
import { comingUp, comingUpOf } from './coming-up';

const TZ = 'Europe/Ljubljana';
const TODAY = '2026-11-05';
const at = (day: string, h = 12) => Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00+01:00`);
const day = (n: number) => shiftDay(TODAY, n);
const NOW = at(TODAY, 15);

let seq = 0;
/** An exercise created on a day (never done: due that day). */
const ex = (name: string, createdDay: string, over: Partial<DayExercise> = {}): DayExercise => ({
	id: ++seq,
	name,
	active: true,
	archived: false,
	createdAt: at(createdDay, 9),
	everyDays: 3,
	comesBack: FACES,
	warmup: false,
	warmupOrder: null,
	...over
});
const set = (e: DayExercise, d: string, h = 12, rating: number | null = RATING_OF.gotit) => ({
	exerciseId: e.id,
	doneAt: at(d, h),
	rating
});
const pick = (e: DayExercise, kind: DayPick['kind'], createdAt = NOW - 1000): DayPick => ({
	id: ++seq,
	exerciseId: e.id,
	kind,
	createdAt
});
const input = (
	exercises: DayExercise[],
	over: Partial<DayInput<DayExercise>> = {}
): DayInput<DayExercise> => ({
	exercises,
	sets: [],
	picks: [],
	daily: 5,
	now: NOW,
	timeZone: TZ,
	...over
});
const names = (l: { rows: { exercise: DayExercise }[] }) => l.rows.map((r) => r.exercise.name);

/** Seven due exercises, oldest first: a (7 days late) ... g (1 day late). */
const seven = () => 'abcdefg'.split('').map((n, i) => ex(n, day(-7 + i)));

describe('dayList', () => {
	it('shows the first daily rows, oldest due first', () => {
		const l = dayList(input(seven().reverse()));
		expect(names(l)).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(l.rows.every((r) => r.kind === 'todo')).toBe(true);
		expect([l.total, l.done, l.left]).toEqual([5, 0, 5]);
	});

	it("rows ignore today's sets", () => {
		const xs = seven();
		const l = dayList(input(xs, { sets: [set(xs[0], TODAY)] }));
		expect(names(l)).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(l.rows.map((r) => r.kind)).toEqual(['done', 'todo', 'todo', 'todo', 'todo']);
		expect([l.total, l.done, l.left]).toEqual([5, 1, 4]);
	});

	it('doing an off-list exercise adds a done row and does not use up a row', () => {
		const xs = seven();
		const l = dayList(input(xs, { sets: [set(xs[6], TODAY)] }));
		expect(names(l)).toEqual(['g', 'a', 'b', 'c', 'd', 'e']);
		expect(l.rows[0].kind).toBe('done');
		expect([l.total, l.done, l.left]).toEqual([6, 1, 5]);
	});

	it('done rows: the days rows in queue order, then others by first set today', () => {
		const xs = seven();
		const l = dayList(
			input(xs, {
				sets: [
					set(xs[1], TODAY, 8),
					set(xs[0], TODAY, 9),
					set(xs[5], TODAY, 11),
					set(xs[6], TODAY, 10)
				]
			})
		);
		expect(names(l).slice(0, 4)).toEqual(['a', 'b', 'g', 'f']);
	});

	it('a skip takes a row out and the next moves up', () => {
		const xs = seven();
		const l = dayList(input(xs, { picks: [pick(xs[1], 'skip')] }));
		expect(names(l)).toEqual(['a', 'c', 'd', 'e', 'f']);
	});

	it('picks come after the rows in pick order, as picked', () => {
		const xs = seven();
		const up = [ex('x', day(2)), ex('y', day(4))];
		const l = dayList(
			input([...xs, ...up], {
				picks: [pick(up[1], 'next', NOW - 10), pick(up[0], 'add', NOW - 5)]
			})
		);
		expect(names(l)).toEqual(['a', 'b', 'c', 'd', 'e', 'y', 'x']);
		expect(l.rows.slice(5).map((r) => r.kind)).toEqual(['picked', 'picked']);
		expect(l.rows[5].pick?.kind).toBe('next');
		expect(l.total).toBe(7);
	});

	it('a picked one that is done moves up to the done rows', () => {
		const up = ex('x', day(2));
		const l = dayList(input([up], { picks: [pick(up, 'add')], sets: [set(up, TODAY)] }));
		expect(l.rows.map((r) => [r.exercise.name, r.kind, r.pick?.kind])).toEqual([
			['x', 'done', 'add']
		]);
	});

	it('picked but archived or paused is dropped', () => {
		const a = ex('arch', day(2), { archived: true });
		const p = ex('paused', day(2), { active: false });
		const l = dayList(input([a, p], { picks: [pick(a, 'add'), pick(p, 'next')] }));
		expect(l.rows).toEqual([]);
	});

	it('a never-done exercise created today queues behind an older overdue one', () => {
		const old = ex('old', day(-2));
		const fresh = ex('fresh', TODAY);
		const l = dayList(input([fresh, old], { daily: 1 }));
		expect(names(l)).toEqual(['old']);
		expect(dayList(input([fresh, old], { daily: 2 })).rows.map((r) => r.exercise.name)).toEqual([
			'old',
			'fresh'
		]);
	});

	it('a class created today with two exercises does not push out an older row', () => {
		const older = ex('older', day(-1));
		const c1 = ex('c1', TODAY);
		const c2 = ex('c2', TODAY);
		const l = dayList(input([c1, c2, older], { daily: 1 }));
		expect(names(l)).toEqual(['older']);
		const l2 = dayList(input([c1, c2, older], { daily: 2 }));
		expect(names(l2)).toEqual(['older', 'c1']);
	});

	it('next row hidden when nothing is left', () => {
		const a = ex('a', day(-1));
		const b = ex('b', day(-1));
		const l = dayList(input([a, b], { sets: [set(a, TODAY), set(b, TODAY)] }));
		expect(l.left).toBe(0);
		expect(l.showNext).toBe(false);
	});

	it('next row shows with one left and something in line, not with two', () => {
		const a = ex('a', day(-1));
		const b = ex('b', day(-1));
		const up = ex('up', day(3));
		expect(dayList(input([a, b, up], { sets: [set(a, TODAY)] })).showNext).toBe(true);
		expect(dayList(input([a, b, up])).showNext).toBe(false);
		expect(dayList(input([a, up], { sets: [set(a, TODAY)] })).showNext).toBe(true);
	});

	it('nothing left names the next day', () => {
		const a = ex('a', day(-1), { everyDays: 1 });
		const b = ex('b', day(-1), { everyDays: 1 });
		const c = ex('c', day(-1), { everyDays: 4 });
		const l = dayList(input([a, b, c], { sets: [a, b, c].map((e) => set(e, TODAY, 12, null)) }));
		expect(l.nothingLeft).toEqual({ next: a, day: day(1), more: 1 });
		expect(l.showNext).toBe(false);
	});

	it('nothing left counts a skipped one as coming back tomorrow', () => {
		const a = ex('a', day(-3));
		const l = dayList(input([a], { picks: [pick(a, 'skip')] }));
		expect(l.rows).toEqual([]);
		expect(l.nothingLeft).toEqual({ next: a, day: day(1), more: 0 });
	});

	it('no nothing-left while something is in line or on the list', () => {
		const a = ex('a', day(-1));
		const up = ex('up', day(3));
		expect(dayList(input([a])).nothingLeft).toBeNull();
		expect(dayList(input([a, up], { sets: [set(a, TODAY)] })).nothingLeft).toBeNull();
		expect(dayList(input([])).nothingLeft).toBeNull();
	});

	it('daily changed mid-day changes rows', () => {
		const xs = seven();
		expect(dayList(input(xs, { daily: 3 })).rows).toHaveLength(3);
		expect(dayList(input(xs, { daily: 6 })).rows).toHaveLength(6);
	});

	it('neverDone and the two states', () => {
		const a = ex('a', day(-1));
		const b = ex('b', day(-10));
		const l = dayList(input([a, b], { sets: [set(b, day(-4)), set(b, TODAY)] }));
		const rb = l.rows.find((r) => r.exercise === b)!;
		expect(rb.neverDone).toBe(false);
		expect(rb.start.lastDay).toBe(day(-4));
		expect(rb.state.lastDay).toBe(TODAY);
		expect(l.rows.find((r) => r.exercise === a)!.neverDone).toBe(true);
	});

	it('a 23:30 set is yesterday and does not count as done today', () => {
		const a = ex('a', day(-5));
		const l = dayList(
			input([a], { sets: [{ exerciseId: a.id, doneAt: at(day(-1), 23) + 30 * 60_000, rating: 4 }] })
		);
		expect(l.rows.map((r) => r.kind)).toEqual([]);
	});
});

describe('inLine', () => {
	it('is the rest of the queue, then not yet due by due day (ties creation, name)', () => {
		const xs = seven();
		const u1 = ex('u1', day(5));
		const u2 = ex('u2', day(2));
		// Older, done on day -1 with no face: gap 3, due day 2 as well.
		const u3b = ex('u3b', day(-30));
		const sets = [{ exerciseId: u3b.id, doneAt: at(day(-1)), rating: null }];
		expect(inLine(input([u1, ...xs, u2, u3b], { sets })).map((e) => e.name)).toEqual([
			'f',
			'g',
			'u3b',
			'u2',
			'u1'
		]);
	});

	it('leaves out done today, skipped, on Today, paused and archived', () => {
		const xs = seven();
		const done = ex('done', day(2));
		const skipped = ex('skipped', day(2));
		const added = ex('added', day(2));
		const paused = ex('paused', day(2), { active: false });
		const arch = ex('arch', day(2), { archived: true });
		const free = ex('free', day(3));
		const l = inLine(
			input([...xs, done, skipped, added, paused, arch, free], {
				sets: [set(done, TODAY)],
				picks: [pick(skipped, 'skip'), pick(added, 'add')]
			})
		);
		expect(l.map((e) => e.name)).toEqual(['f', 'g', 'free']);
	});
});

describe('one worked day for the list and Coming up', () => {
	it('dayListOf and comingUpOf of one workOf equal dayList and comingUp', () => {
		const all = seven();
		const later = ex('later', day(4));
		const x = input([...all, later], {
			daily: 3,
			sets: [set(all[0], TODAY, 10)],
			picks: [pick(all[5], 'skip'), pick(later, 'add')]
		});
		const w = workOf(x);
		expect(dayListOf(w)).toEqual(dayList(x));
		expect(comingUpOf(w)).toEqual(comingUp(x));
	});
});
