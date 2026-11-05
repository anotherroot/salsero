import { describe, expect, it } from 'vitest';
import { shiftDay } from '$lib/day/day';
import { RATING_OF } from './feel';
import { nextGap, preview, replay } from './schedule';

const TZ = 'Europe/Ljubljana';
/** Noon local on a day, as an instant. */
const at = (day: string, h = 12, m = 0) =>
	Date.parse(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+01:00`);
const D0 = '2026-10-01';
const day = (n: number) => shiftDay(D0, n);
const gotit = (d: string) => ({ doneAt: at(d), rating: RATING_OF.gotit });

describe('nextGap', () => {
	it.each([
		[10, 10, 'gotit', 25],
		[10, 40, 'gotit', 25],
		[75, 1, 'gotit', 75],
		[10, 1, 'easy', 21],
		[30, 1, 'easy', 39],
		[10, 1, 'getting', 5],
		[2, 2, 'getting', 3],
		[75, 1, 'hard', 1],
		[300, 300, 'easy', 365]
	] as const)('nextGap(%s, %s, %s) = %s', (gap, e, feel, want) => {
		expect(nextGap(gap, e, feel)).toBe(want);
	});
	it('none keeps the gap', () => expect(nextGap(9, 5, null)).toBe(9));
	it('getting there on time uses used x 1.2', () => expect(nextGap(10, 10, 'getting')).toBe(12));
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
		expect(s).toEqual({ gap: 25, lastDay: day(10), dueDay: day(35) });
	});
	it('early, then on time (sets in any order)', () => {
		const early = [gotit(day(0)), gotit(day(1))];
		expect(replay(10, at(D0), early, TZ).dueDay).toBe(day(11));
		const later = [gotit(day(11)), ...early];
		expect(replay(10, at(D0), later, TZ)).toEqual({ gap: 25, lastDay: day(11), dueDay: day(36) });
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
		expect(p.faces.map((f) => f.gap)).toEqual([1, 12, 25, 40]);
		expect(p.early).toBeNull();
	});
	it('early', () => {
		const state = { gap: 10, lastDay: day(0), dueDay: day(10) };
		const p = preview(state, day(1));
		expect(p.faces.map((f) => f.gap)).toEqual([1, 5, 10, 21]);
		expect(p.early).toEqual({ lastDay: day(0), dueDay: day(10) });
	});
	it('is computed from the state before today', () => {
		const sets = [gotit(day(0)), { doneAt: at(day(3)), rating: RATING_OF.hard }];
		const before = replay(10, 0, sets, TZ, day(3));
		expect(preview(before, day(3)).faces.map((f) => f.gap)).toEqual([1, 5, 10, 21]);
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
