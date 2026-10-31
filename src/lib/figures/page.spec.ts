import { describe, expect, it } from 'vitest';
import { plan, type PlanExercise } from '$lib/urgency/urgency';
import { practiceLine, routineUseMeta } from './page';

const TZ = 'Europe/Ljubljana';
const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 31, 10, 0); // noon local
const ex = (everyDays: number, active = true): PlanExercise => ({
	id: 1,
	name: 'Drill',
	everyDays,
	active,
	archived: false,
	createdAt: 0
});
const line = (e: PlanExercise, ago: number | null, at = now) =>
	practiceLine(plan([e], ago === null ? [] : [{ exerciseId: 1, doneAt: at - ago }], at, TZ));

describe('routineUseMeta', () => {
	it('names the slots', () => {
		expect(routineUseMeta({ slots: [3], slotCount: 6 })).toBe('Slot 3 of 6');
		expect(routineUseMeta({ slots: [2, 5], slotCount: 8 })).toBe('Slots 2 and 5 of 8');
		expect(routineUseMeta({ slots: [1, 4, 6], slotCount: 9 })).toBe('Slots 1, 4 and 6 of 9');
	});
});

describe('practiceLine', () => {
	it('a set today', () =>
		expect(line(ex(3), 1000)).toEqual({
			title: 'Every 3 days',
			meta: { text: 'Done today', tone: 'done' }
		}));
	it('never done', () =>
		expect(line(ex(3), null)?.meta).toEqual({ text: 'Never done', tone: 'status' }));
	it('overdue by calendar days', () =>
		expect(line(ex(3), 5 * DAY)?.meta).toEqual({ text: '2 days overdue', tone: 'status' }));
	it('one day overdue', () => expect(line(ex(3), 4 * DAY)?.meta.text).toBe('1 day overdue'));
	it('due, not yet a whole day over', () =>
		expect(line(ex(7), 7 * DAY)?.meta).toEqual({ text: 'Due today', tone: 'status' }));
	it('daily, done 23:30 yesterday, read at 07:00', () => {
		const at = Date.UTC(2026, 9, 31, 6, 0); // 07:00 CET... 31 Oct is CET (+1)
		const doneAt = Date.UTC(2026, 9, 30, 22, 30); // 23:30 local
		expect(practiceLine(plan([ex(1)], [{ exerciseId: 1, doneAt }], at, TZ))).toEqual({
			title: 'Daily',
			meta: { text: 'Done yesterday', tone: null }
		});
	});
	it('not due yet', () =>
		expect(line(ex(7), 2 * DAY)?.meta).toEqual({ text: 'Done 2 days ago', tone: null }));
	it('parked', () =>
		expect(line(ex(7, false), null)?.meta).toEqual({
			text: "Inactive · not on Today's list",
			tone: null
		}));
	it('nothing to say', () =>
		expect(practiceLine({ doneToday: [], due: [], upcoming: [], inactive: [] })).toBeNull());
});
