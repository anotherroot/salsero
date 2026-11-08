import { describe, expect, it } from 'vitest';
import { shiftDay } from '$lib/day/day';
import { RATING_OF } from './feel';
import { FACES } from './comes-back';
import { doneFaces, goodDaysSince, nextGap, preview, replay, scheduleOf } from './schedule';

const TZ = 'Europe/Ljubljana';
/** Noon local on a day, as an instant. */
const at = (day: string, h = 12, m = 0) =>
	Date.parse(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+01:00`);
const D0 = '2026-10-01';
const day = (n: number) => shiftDay(D0, n);
const gotit = (d: string) => ({ doneAt: at(d), rating: RATING_OF.gotit });
const getting = (d: string) => ({ doneAt: at(d), rating: RATING_OF.getting });
const easy = (d: string) => ({ doneAt: at(d), rating: RATING_OF.easy });
const unrated = (d: string) => ({ doneAt: at(d), rating: null });
const dayStr = (n: number) => shiftDay(D0, n);

describe('nextGap', () => {
	it.each([
		[10, 10, 'gotit', 15],
		[10, 40, 'gotit', 15],
		[75, 1, 'gotit', 75],
		[10, 1, 'easy', 12],
		[30, 1, 'easy', 36],
		[10, 1, 'getting', 5],
		[2, 2, 'getting', 3],
		[75, 1, 'hard', 1],
		[300, 300, 'easy', 365]
	] as const)('nextGap(%s, %s, %s) = %s', (gap, e, feel, want) => {
		expect(nextGap(gap, e, feel)).toBe(want);
	});
	it('none keeps the gap', () => expect(nextGap(9, 5, null)).toBe(9));
	const grow = (feel: 'gotit' | 'easy', start: number, n: number) => {
		let gap = start;
		let e = 0;
		const seen: number[] = [];
		for (let i = 0; i < n; i++) {
			gap = nextGap(gap, e, feel);
			seen.push(gap);
			e = gap;
		}
		return seen;
	};
	it("I've got it every time grows 3, 5, 8, 12, 18, 27, 41, 62, 93", () => {
		expect(grow('gotit', 3, 9)).toEqual([3, 5, 8, 12, 18, 27, 41, 62, 93]);
	});
	it('Easy every time grows 7, 14, 28, 56, 112, 224, 365', () => {
		expect(grow('easy', 1, 7)).toEqual([7, 14, 28, 56, 112, 224, 365]);
	});
	it('Getting there on time uses used x 1.3, at least 2', () => {
		expect(nextGap(10, 10, 'getting')).toBe(13);
		expect(nextGap(1, 1, 'getting')).toBe(2);
	});
	it('caps at 365', () => expect(nextGap(300, 300, 'easy')).toBe(365));
});

describe('replay', () => {
	it('never done: the start gap, due on the creation day', () => {
		expect(replay(3, at('2026-10-05'), [], TZ)).toEqual({
			gap: 3,
			lastDay: null,
			dueDay: '2026-10-05'
		});
	});
	it('on time', () => {
		const s = replay(10, at(D0), [gotit(day(0)), gotit(day(10))], TZ);
		expect(s).toEqual({ gap: 15, lastDay: day(10), dueDay: day(25) });
	});
	it('early, then on time (sets in any order)', () => {
		const early = [gotit(day(0)), gotit(day(1))];
		expect(replay(10, at(D0), early, TZ).dueDay).toBe(day(11));
		const later = [gotit(day(11)), ...early];
		expect(replay(10, at(D0), later, TZ)).toEqual({ gap: 15, lastDay: day(11), dueDay: day(26) });
	});
	it('counts calendar days across midnight and DST', () => {
		// 10-11 Oct 2026 is CEST (+02:00): 23:30 on the 10th and 00:30 on the 11th are two days.
		const getting = (iso: string) => ({ doneAt: Date.parse(iso), rating: RATING_OF.getting });
		const across = replay(
			10,
			0,
			[getting('2026-10-10T23:30:00+02:00'), getting('2026-10-11T00:30:00+02:00')],
			TZ
		);
		// day 10: e=0, early -> 5; day 11: e=1, early -> max(3, 2.5) = 3
		expect(across.gap).toBe(3);
		expect(across.lastDay).toBe('2026-10-11');
		// Two sets an hour apart on one local day are one review: gap 5.
		const same = replay(
			10,
			0,
			[getting('2026-10-10T22:30:00+02:00'), getting('2026-10-10T23:30:00+02:00')],
			TZ
		);
		expect(same.gap).toBe(5);
		// A gap across the 25 Oct 2026 DST end: 23 Oct noon to 27 Oct noon is 4 days.
		const t = replay(
			10,
			0,
			[
				{ doneAt: Date.parse('2026-10-23T12:00:00+02:00'), rating: RATING_OF.gotit },
				{ doneAt: Date.parse('2026-10-27T12:00:00+01:00'), rating: RATING_OF.getting }
			],
			TZ
		);
		// e = 4 (not 4.04 or 3), early: max(3, 4.8, 5) = 5
		expect(t.gap).toBe(5);
		expect(t.dueDay).toBe('2026-11-01');
	});
	it('same-day second set keeps the gap', () => {
		const s = replay(75, 0, [gotit(day(0)), { doneAt: at(day(0), 15), rating: 4 }], TZ);
		expect(s.gap).toBe(75);
		expect(s.dueDay).toBe(day(75));
	});
	it('a day is one review', () => {
		const r = (n: number | null, h: number) => ({ doneAt: at(day(0), h), rating: n });
		const once = (n: number) => replay(30, 0, [r(n, 10)], TZ);
		expect(replay(30, 0, [r(2, 10), r(2, 11)], TZ)).toEqual(once(2));
		expect(replay(30, 0, [r(5, 10), r(5, 11)], TZ)).toEqual(once(5));
		expect(replay(30, 0, [r(4, 10), r(1, 11)], TZ)).toEqual(once(1));
		expect(replay(30, 0, [r(1, 10), r(4, 11)], TZ)).toEqual(once(4));
		expect(replay(30, 0, [r(2, 10), r(null, 11)], TZ)).toEqual(once(2));
		const none = replay(30, 0, [r(null, 10)], TZ);
		expect(none.gap).toBe(30);
		expect(none.lastDay).toBe(day(0));
	});
	it('beforeDay ignores today and later sets', () => {
		const sets = [gotit(day(0)), gotit(day(5))];
		expect(replay(10, 0, sets, TZ, day(5))).toEqual(replay(10, 0, [sets[0]], TZ));
		expect(replay(10, 0, sets, TZ, day(5)).lastDay).toBe(day(0));
		expect(replay(10, 0, sets, TZ, day(0)).lastDay).toBeNull();
	});
});

describe('preview', () => {
	it('on time', () => {
		const state = { gap: 10, lastDay: day(0), dueDay: day(10) };
		const p = preview(state, day(10));
		expect(p.faces.map((f) => f.gap)).toEqual([1, 13, 15, 20]);
		expect(p.early).toBeNull();
	});
	it('early', () => {
		const state = { gap: 10, lastDay: day(0), dueDay: day(10) };
		const p = preview(state, day(1));
		expect(p.faces.map((f) => f.gap)).toEqual([1, 5, 10, 12]);
		expect(p.early).toEqual({ lastDay: day(0), dueDay: day(10) });
	});
	it('is computed from the state before today', () => {
		const sets = [gotit(day(0)), { doneAt: at(day(3)), rating: RATING_OF.hard }];
		const before = replay(10, 0, sets, TZ, day(3));
		expect(preview(before, day(3)).faces.map((f) => f.gap)).toEqual([1, 5, 10, 12]);
	});
	it('matches replay with that set added', () => {
		const state = replay(10, 0, [gotit(day(0))], TZ);
		for (const f of preview(state, day(3)).faces) {
			const after = replay(
				10,
				0,
				[gotit(day(0)), { doneAt: at(day(3)), rating: RATING_OF[f.feel] }],
				TZ
			);
			expect(after.gap).toBe(f.gap);
		}
	});
});

describe('scheduleOf', () => {
	it('faces is replay, with no rhythm and no learning', () => {
		const sets = [gotit(day(0))];
		expect(scheduleOf(3, at(D0), sets, FACES, TZ)).toEqual({
			...replay(3, at(D0), sets, TZ),
			every: null,
			learning: null
		});
	});
	it('every 2: due two days after the last set, never "late"', () => {
		const s = scheduleOf(3, at(D0), [unrated(day(0))], { kind: 'every', days: 2 }, TZ);
		expect(s).toMatchObject({ dueDay: dayStr(2), gap: 2, every: 2, learning: null });
	});
	it('every 1, missed for 5 days: still due on the day after the last set', () => {
		expect(scheduleOf(3, at(D0), [unrated(day(0))], { kind: 'every', days: 1 }, TZ).dueDay).toBe(
			dayStr(1)
		);
	});
	it('every N never done: due on its creation day', () => {
		const s = scheduleOf(3, at('2026-10-05'), [], { kind: 'every', days: 3 }, TZ);
		expect(s).toMatchObject({ lastDay: null, dueDay: '2026-10-05', gap: 3 });
	});
	it('until 3: daily while learning, counting good days from the switch', () => {
		const since = at(day(2));
		const sets = [gotit(day(0)), gotit(day(1)), gotit(day(2)), getting(day(3))];
		const s = scheduleOf(3, at(D0), sets, { kind: 'until', good: 3, since }, TZ);
		expect(s.learning).toEqual({ good: 1, of: 3 });
		expect(s.dueDay).toBe(dayStr(4));
	});
	it('until 3: a day is good by its last rated set', () => {
		const sets = [
			{ doneAt: at(day(0), 9), rating: RATING_OF.getting },
			{ doneAt: at(day(0), 10), rating: RATING_OF.gotit },
			{ doneAt: at(day(0), 11), rating: null }
		];
		const s = scheduleOf(3, at(D0), sets, { kind: 'until', good: 3, since: at(D0) }, TZ);
		expect(s.learning).toEqual({ good: 1, of: 3 });
	});
	it('until 3: learnt on the third good day, then the faces gap', () => {
		const sets = [gotit(day(0)), easy(day(1)), gotit(day(2))];
		const s = scheduleOf(3, at(D0), sets, { kind: 'until', good: 3, since: at(D0) }, TZ);
		expect(s.learning).toBeNull();
		expect(s).toMatchObject(replay(3, at(D0), sets, TZ));
	});
	it('until, never done: due on the creation day, 0 good', () => {
		const s = scheduleOf(3, at('2026-10-05'), [], { kind: 'until', good: 5, since: 0 }, TZ);
		expect(s).toMatchObject({ dueDay: '2026-10-05', learning: { good: 0, of: 5 } });
	});
	it('switched back to faces: unrated rhythm sets leave the gap', () => {
		const sets = [gotit(day(0)), unrated(day(3)), unrated(day(4))];
		expect(scheduleOf(3, at(D0), sets, FACES, TZ).gap).toBe(
			replay(3, at(D0), [gotit(day(0))], TZ).gap
		);
	});
	it("beforeDay leaves out that day's sets", () => {
		const sets = [unrated(day(0)), unrated(day(3))];
		const every1 = { kind: 'every', days: 1 } as const;
		expect(scheduleOf(3, at(D0), sets, every1, TZ).dueDay).toBe(dayStr(4));
		expect(scheduleOf(3, at(D0), sets, every1, TZ, day(3)).dueDay).toBe(dayStr(1));
	});
	it('beforeDay leaves out that day from the good days', () => {
		const sets = [gotit(day(0)), gotit(day(1)), gotit(day(2))];
		const until3 = { kind: 'until', good: 3, since: at(D0) } as const;
		expect(scheduleOf(3, at(D0), sets, until3, TZ, day(2)).learning).toEqual({ good: 2, of: 3 });
	});
});

describe('goodDaysSince', () => {
	it("counts the days since the switch whose last rated set is I've got it or Easy", () => {
		const sets = [gotit(day(0)), gotit(day(2)), getting(day(3)), easy(day(4))];
		expect(goodDaysSince(sets, at(day(2)), TZ)).toBe(2);
		expect(goodDaysSince(sets, at(D0), TZ)).toBe(3);
		expect(goodDaysSince([], at(D0), TZ)).toBe(0);
	});
	it('agrees with the learning count of scheduleOf', () => {
		const sets = [gotit(day(0)), getting(day(1))];
		const since = at(D0);
		expect(scheduleOf(3, at(D0), sets, { kind: 'until', good: 3, since }, TZ).learning?.good).toBe(
			goodDaysSince(sets, since, TZ)
		);
	});
});

describe('doneFaces', () => {
	const now = at('2026-11-07', 18);
	const until = (sets: { doneAt: number; rating: number | null }[]) => ({
		startGap: 3,
		createdAt: at('2026-11-01'),
		sets,
		comesBack: { kind: 'until', good: 3, since: at('2026-11-01') } as const
	});
	it('a learning drill one good day short: the good faces finish it, with the gap the faces earned', () => {
		expect(doneFaces(until([gotit('2026-11-05'), gotit('2026-11-06')]), now, TZ)).toEqual([
			{ feel: 'hard', gap: 1, learnt: false },
			{ feel: 'getting', gap: 1, learnt: false },
			{ feel: 'gotit', gap: 3, learnt: true },
			{ feel: 'easy', gap: 7, learnt: true }
		]);
	});
	it('two good days short: all four say tomorrow', () =>
		expect(doneFaces(until([gotit('2026-11-06')]), now, TZ)!.map((f) => [f.gap, f.learnt])).toEqual(
			[
				[1, false],
				[1, false],
				[1, false],
				[1, false]
			]
		));
	it('by the faces: the next gaps, none learnt', () =>
		expect(
			doneFaces(
				{ startGap: 3, createdAt: at('2026-11-01'), sets: [gotit('2026-11-04')], comesBack: FACES },
				now,
				TZ
			)!.map((f) => [f.gap, f.learnt])
		).toEqual([
			[1, false],
			[4, false],
			[5, false],
			[7, false]
		]));
	it('a fixed rhythm has no faces', () =>
		expect(
			doneFaces(
				{
					startGap: 3,
					createdAt: at('2026-11-01'),
					sets: [],
					comesBack: { kind: 'every', days: 2 }
				},
				now,
				TZ
			)
		).toBeNull());
});
