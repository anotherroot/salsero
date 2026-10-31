import { describe, expect, it } from 'vitest';
import { plan, type PlanExercise } from '$lib/urgency/urgency';
import {
	archiveCopy,
	moveState,
	practiceLine,
	recordingDay,
	routineUseMeta,
	timingLine,
	variationNav
} from './page';

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

describe('timingLine', () => {
	it('names whole eights', () => {
		expect(timingLine(1, 16)).toEqual({ main: 'Starts on 1 · 16 counts', extra: ' · 2 eights' });
		expect(timingLine(1, 8).extra).toBe(' · one 8-count');
	});
	it('says nothing more when the length is not whole eights', () => {
		expect(timingLine(5, 4)).toEqual({ main: 'Starts on 5 · 4 counts', extra: '' });
		expect(timingLine(3, 12).extra).toBe('');
	});
});

describe('archiveCopy', () => {
	it('a variation among others', () =>
		expect(archiveCopy('Enchufla', 'Doble', false)).toEqual({
			title: 'Archive Doble?',
			button: 'Archive Doble',
			caption: 'Doble leaves Enchufla. Its recordings and practice history are kept.'
		}));
	it('the last variation takes its figure', () =>
		expect(archiveCopy('Setenta', 'Basic', true)).toEqual({
			title: 'Archive Basic?',
			button: 'Archive and remove figure',
			caption:
				'Setenta goes with it: Basic is its last variation. Its recordings and practice history are kept.'
		}));
});

describe('recordingDay', () => {
	it('this year: the long day', () =>
		expect(recordingDay('2026-10-28', '2026-10-31')).toBe('Wednesday, 28 October'));
	it('another year: the year too', () =>
		expect(recordingDay('2025-10-28', '2026-10-31')).toBe('Tuesday, 28 October, 2025'));
});

describe('variationNav', () => {
	const three = [{ id: 4 }, { id: 9 }, { id: 12 }];
	it('steps both ways and wraps', () => {
		expect(variationNav(three, 9)).toEqual({
			index: 1,
			count: 3,
			prev: 4,
			next: 12,
			position: '2 of 3 variations'
		});
		expect(variationNav(three, 12).next).toBe(4);
		expect(variationNav(three, 4).prev).toBe(12);
	});
	it('has nowhere to step with one variation', () => {
		expect(variationNav([{ id: 4 }], 4)).toEqual({
			index: 0,
			count: 1,
			prev: null,
			next: null,
			position: '1 of 1 variation'
		});
	});
	it('counts an unknown id as the first', () => {
		expect(variationNav(three, 99).index).toBe(0);
	});
});

describe('moveState', () => {
	const dile = { name: 'Dile que no', variations: ['Basic', 'Doble'] };
	it('a name that clashes, trimmed and in any case', () =>
		expect(moveState({ last: false, chosen: dile, joinName: '  doble ' })).toEqual({
			cta: 'Move to Dile que no',
			danger: false,
			clash: 'Dile que no already has a doble. Pick another name.',
			blocked: true
		}));
	it('a blank name blocks without a clash', () =>
		expect(moveState({ last: false, chosen: dile, joinName: '' })).toMatchObject({
			blocked: true,
			clash: null
		}));
	it('a free name goes', () =>
		expect(moveState({ last: false, chosen: dile, joinName: 'Cuddle entry' }).blocked).toBe(false));
	it('the last variation removes its figure', () =>
		expect(moveState({ last: true, chosen: null, joinName: 'Basic' })).toEqual({
			cta: 'Move and remove figure',
			danger: true,
			clash: null,
			blocked: false
		}));
	it('no figure chosen: its own figure', () =>
		expect(moveState({ last: false, chosen: null, joinName: 'x' }).cta).toBe(
			'Make it its own figure'
		));
});
