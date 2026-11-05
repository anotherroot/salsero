import { describe, expect, it } from 'vitest';
import type { ScheduleState } from '$lib/schedule/schedule';
import {
	archiveCopy,
	deleteRecordingBody,
	figureSubtitle,
	lengthError,
	moveState,
	practiceLine,
	recordingDay,
	routineUseMeta,
	timingLine,
	variationNav
} from './page';

const TODAY = '2026-10-31'; // a Saturday
const st = (dueDay: string, lastDay: string | null): ScheduleState => ({
	gap: 3,
	lastDay,
	dueDay
});

describe('routineUseMeta', () => {
	it('names the slots', () => {
		expect(routineUseMeta({ slots: [3], slotCount: 6 })).toBe('Slot 3 of 6');
		expect(routineUseMeta({ slots: [2, 5], slotCount: 8 })).toBe('Slots 2 and 5 of 8');
		expect(routineUseMeta({ slots: [1, 4, 6], slotCount: 9 })).toBe('Slots 1, 4 and 6 of 9');
	});
});

describe('practiceLine', () => {
	it('never done is New', () =>
		expect(practiceLine(st(TODAY, null), TODAY, true)).toEqual({ text: 'New', tone: 'status' }));
	it('a set today', () =>
		expect(practiceLine(st('2026-11-03', TODAY), TODAY, false)).toEqual({
			text: 'Done today',
			tone: 'done'
		}));
	it('due this week names the day', () =>
		expect(practiceLine(st('2026-11-02', '2026-10-28'), TODAY, false)?.text).toBe('Due Monday'));
	it('late counts calendar days', () =>
		expect(practiceLine(st('2026-10-29', '2026-10-26'), TODAY, false)).toEqual({
			text: '2 days late',
			tone: 'status'
		}));
	it('no state says nothing', () => expect(practiceLine(null, TODAY, false)).toBeNull());
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
	it('a figure among others', () =>
		expect(archiveCopy('Enchufla', 'Doble', false)).toEqual({
			title: 'Archive Doble?',
			button: 'Archive Doble',
			caption: 'Doble leaves Enchufla. Its recordings and practice history are kept.'
		}));
	it('the last figure takes its move', () =>
		expect(archiveCopy('Setenta', 'Basic', true)).toEqual({
			title: 'Archive Basic?',
			button: 'Archive and remove move',
			caption:
				'Setenta goes with it: Basic is its last figure. Its recordings and practice history are kept.'
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
			position: '2 of 3 figures'
		});
		expect(variationNav(three, 12).next).toBe(4);
		expect(variationNav(three, 4).prev).toBe(12);
	});
	it('has nowhere to step with one figure', () => {
		expect(variationNav([{ id: 4 }], 4)).toEqual({
			index: 0,
			count: 1,
			prev: null,
			next: null,
			position: '1 of 1 figure'
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
	it('the last figure removes its move', () =>
		expect(moveState({ last: true, chosen: null, joinName: 'Basic' })).toEqual({
			cta: 'Move and remove move',
			danger: true,
			clash: null,
			blocked: false
		}));
	it('no move chosen: its own move', () =>
		expect(moveState({ last: false, chosen: null, joinName: 'x' }).cta).toBe(
			'Make it its own move'
		));
});

describe('lengthError', () => {
	const msg = '1 to 64 counts. One 8-count is 8.';
	it('a whole number from 1 to 64 is fine', () => {
		expect(lengthError('16')).toBeNull();
		expect(lengthError('64')).toBeNull();
		expect(lengthError('1')).toBeNull();
	});
	it.each(['70', '0', '', '8.5', 'abc', '-8'])('%j is refused', (v) =>
		expect(lengthError(v)).toBe(msg)
	);
});

describe('deleteRecordingBody', () => {
	it('names its sections', () =>
		expect(deleteRecordingBody('Wednesday, 28 October', '34 MB', 2)).toBe(
			'Wednesday, 28 October · 34 MB. Its 2 saved sections go with it. This can’t be undone.'
		));
	it('one section', () =>
		expect(deleteRecordingBody('Wednesday, 28 October', '34 MB', 1)).toBe(
			'Wednesday, 28 October · 34 MB. Its 1 saved section goes with it. This can’t be undone.'
		));
	it('no sections', () =>
		expect(deleteRecordingBody('Wednesday, 28 October', '34 MB', 0)).toBe(
			'Wednesday, 28 October · 34 MB. This can’t be undone.'
		));
});

describe('figureSubtitle', () => {
	it("leads with the group's name for a group's figure", () => {
		expect(figureSubtitle({ startCount: 1, lengthCounts: 8 }, 'Salsa Tuesdays')).toBe(
			'Salsa Tuesdays’ figure · starts on 1 · 8 counts'
		);
	});
	it('names the start and the length', () => {
		expect(figureSubtitle({ startCount: 1, lengthCounts: 16 })).toBe(
			'Figure · starts on 1 · 16 counts'
		);
	});
	it('is just Figure without timing', () => {
		expect(figureSubtitle({ startCount: null, lengthCounts: null })).toBe('Figure');
		expect(figureSubtitle({ startCount: 1, lengthCounts: null })).toBe('Figure');
	});
});
