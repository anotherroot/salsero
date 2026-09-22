import { describe, expect, it } from 'vitest';
import { plan, type PlanExercise, type PlanSet } from './urgency';

const TZ = 'Europe/Ljubljana';
const DAY = 86_400_000;
// 2026-09-22 12:00 in Ljubljana (CEST, UTC+2).
const NOW = Date.UTC(2026, 8, 22, 10, 0);

let nextId = 1;
function ex(partial: Partial<PlanExercise> = {}): PlanExercise {
	const id = partial.id ?? nextId++;
	return {
		id,
		name: `ex ${id}`,
		everyDays: 3,
		active: true,
		archived: false,
		createdAt: NOW - 30 * DAY,
		...partial
	};
}
const set = (exerciseId: number, doneAt: number): PlanSet => ({ exerciseId, doneAt });
const ids = (rows: { exercise: PlanExercise }[]) => rows.map((r) => r.exercise.id);

describe('plan', () => {
	it('orders to-do by elapsed time over target frequency, most urgent first', () => {
		const daily = ex({ id: 1, everyDays: 1 });
		const weekly = ex({ id: 2, everyDays: 7 });
		const out = plan(
			[weekly, daily],
			[set(1, NOW - 2 * DAY), set(2, NOW - 5 * DAY)], // 2/1 = 2.0 vs 5/7 = 0.71
			NOW,
			TZ
		);
		expect(ids(out.todo)).toEqual([1, 2]);
		expect(out.todo[0].urgency).toBeCloseTo(2);
		expect(out.todo[1].urgency).toBeCloseTo(5 / 7);
	});

	it('marks overdue once urgency reaches 1', () => {
		const a = ex({ id: 1, everyDays: 2 });
		const b = ex({ id: 2, everyDays: 2 });
		const out = plan([a, b], [set(1, NOW - 2 * DAY), set(2, NOW - 1 * DAY)], NOW, TZ);
		expect(out.todo.find((r) => r.exercise.id === 1)?.overdue).toBe(true);
		expect(out.todo.find((r) => r.exercise.id === 2)?.overdue).toBe(false);
	});

	it('puts never-done exercises first, oldest created first', () => {
		const done = ex({ id: 1, everyDays: 1 });
		const newer = ex({ id: 2, createdAt: NOW - DAY });
		const older = ex({ id: 3, createdAt: NOW - 10 * DAY });
		const out = plan([done, newer, older], [set(1, NOW - 20 * DAY)], NOW, TZ);
		expect(ids(out.todo)).toEqual([3, 2, 1]);
		expect(out.todo[0].urgency).toBeNull();
		expect(out.todo[0].lastDoneDaysAgo).toBeNull();
		expect(out.todo[0].overdue).toBe(true);
	});

	it('breaks urgency ties by name', () => {
		const b = ex({ id: 1, name: 'Bravo' });
		const a = ex({ id: 2, name: 'alpha' });
		const out = plan([b, a], [set(1, NOW - 2 * DAY), set(2, NOW - 2 * DAY)], NOW, TZ);
		expect(ids(out.todo)).toEqual([2, 1]);
	});

	it('uses only the most recent set', () => {
		const e = ex({ id: 1, everyDays: 1 });
		const out = plan([e], [set(1, NOW - 9 * DAY), set(1, NOW - 2 * DAY)], NOW, TZ);
		expect(out.todo[0].urgency).toBeCloseTo(2);
		expect(out.todo[0].lastDoneAt).toBe(NOW - 2 * DAY);
	});

	it('moves anything with a set today into doneToday, newest first, with counts', () => {
		const a = ex({ id: 1 });
		const b = ex({ id: 2 });
		const c = ex({ id: 3 });
		const morning = Date.UTC(2026, 8, 22, 6, 0); // 08:00 local
		const out = plan(
			[a, b, c],
			[set(1, morning), set(1, morning + 60_000), set(2, NOW - 60_000)],
			NOW,
			TZ
		);
		expect(ids(out.doneToday)).toEqual([2, 1]);
		expect(out.doneToday[1].setsToday).toBe(2);
		expect(ids(out.todo)).toEqual([3]);
	});

	it('files a late-evening set under its own day, not today, when read next morning', () => {
		const e = ex({ id: 1, everyDays: 1 });
		const lastNight = Date.UTC(2026, 8, 21, 21, 30); // 23:30 local on the 21st
		const nextMorning = Date.UTC(2026, 8, 22, 5, 0); // 07:00 local on the 22nd
		const out = plan([e], [set(1, lastNight)], nextMorning, TZ);
		expect(out.doneToday).toHaveLength(0);
		// Under 24h elapsed, but it WAS yesterday — the label speaks calendar days.
		expect(out.todo[0].lastDoneDaysAgo).toBe(1);
		expect(out.todo[0].urgency).toBeLessThan(1);
	});

	it('lists inactive exercises separately, alphabetically, still with their history', () => {
		const z = ex({ id: 1, name: 'Zeta', active: false });
		const a = ex({ id: 2, name: 'alpha', active: false });
		const out = plan([z, a], [set(1, NOW - 3 * DAY)], NOW, TZ);
		expect(ids(out.inactive)).toEqual([2, 1]);
		expect(out.todo).toHaveLength(0);
		expect(out.inactive[1].lastDoneDaysAgo).toBe(3);
	});

	it('shows an inactive exercise under doneToday when it was logged today', () => {
		const e = ex({ id: 1, active: false });
		const out = plan([e], [set(1, NOW - 60_000)], NOW, TZ);
		expect(ids(out.doneToday)).toEqual([1]);
		expect(out.inactive).toHaveLength(0);
	});

	it('excludes archived exercises entirely', () => {
		const e = ex({ id: 1, archived: true });
		const out = plan([e], [set(1, NOW - 60_000)], NOW, TZ);
		expect(out.doneToday).toHaveLength(0);
		expect(out.todo).toHaveLength(0);
		expect(out.inactive).toHaveLength(0);
	});

	it('ignores sets for exercises it was not given', () => {
		const e = ex({ id: 1 });
		const out = plan([e], [set(999, NOW)], NOW, TZ);
		expect(ids(out.todo)).toEqual([1]);
	});

	it('counts "days ago" in calendar days across the autumn DST change', () => {
		// Clocks go back on 2026-10-25. A set at 20:00 on the 24th, read at 08:00 on the 26th.
		const e = ex({ id: 1, everyDays: 7 });
		const done = Date.UTC(2026, 9, 24, 18, 0); // 20:00 CEST
		const now = Date.UTC(2026, 9, 26, 7, 0); // 08:00 CET
		const out = plan([e], [set(1, done)], now, TZ);
		expect(out.todo[0].lastDoneDaysAgo).toBe(2);
	});
});
