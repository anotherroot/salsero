import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import type { DaySet } from '$lib/types';
import { defaultOpen, dayTotals, sessionLine } from './today-pane';

type Kind = 'done' | 'todo' | 'picked';
const r = (id: number, kind: Kind) => ({ exercise: { id }, kind });
const day = (...rows: ReturnType<typeof r>[]) => ({ rows });

describe('defaultOpen', () => {
	it('opens the first to-do row', () => {
		expect(defaultOpen(day(r(1, 'done'), r(3, 'todo'), r(4, 'todo'), r(9, 'picked')))).toBe(3);
	});
	it('falls to the first picked row', () => {
		expect(defaultOpen(day(r(1, 'done'), r(9, 'picked'), r(8, 'picked')))).toBe(9);
	});
	it('opens nothing when everything is done', () => {
		expect(defaultOpen(day(r(1, 'done')))).toBeNull();
		expect(defaultOpen(day())).toBeNull();
	});
});

describe('sessionLine', () => {
	it('opens the first walked item as 1, and a walked id also still due as its walked place', () => {
		expect(sessionLine([1, 2], [3], 1, 2)).toBe('Session · 1 of 3 · 2 logged so far');
		expect(sessionLine([4], [4, 5], 4, 0)).toBe('Session · 1 of 2');
	});
	it('counts the walked and the rest', () => {
		expect(sessionLine([1], [2, 3, 4, 5], 2, 1)).toBe('Session · 2 of 5 · 1 logged so far');
		expect(sessionLine([1, 2], [3, 4, 5], 2, 2)).toBe('Session · 2 of 5 · 2 logged so far');
		expect(sessionLine([], [1, 2, 3], 1, 0)).toBe('Session · 1 of 3');
	});
	it('counts a skipped one still due once', () => {
		expect(sessionLine([4], [4, 5], 5, 0)).toBe('Session · 2 of 2');
	});
	it('is null for an exercise outside the walk', () => {
		expect(sessionLine([1], [2], 9, 1)).toBeNull();
	});
});

describe('dayTotals', () => {
	const set = (id: number, exerciseId: number, durationS: number | null): DaySet => ({
		id,
		exerciseId,
		exerciseName: `E${exerciseId}`,
		doneAt: 0,
		durationS,
		reps: null,
		rating: null,
		note: null
	});
	it('counts distinct exercises, sets and time', () => {
		const sets = [
			set(1, 1, 3900 - 8 * 60),
			...[2, 3, 4, 5, 6, 7, 7].map((e, i) => set(i + 2, e, 60)),
			set(9, 1, 8 * 60 - 7 * 60)
		];
		expect(sets).toHaveLength(9);
		expect(dayTotals(sets)).toBe('7 exercises · 9 sets · 1 h 05');
	});
	it('leaves time out when none', () => {
		expect(dayTotals([set(1, 1, null)])).toBe('1 exercise · 1 set');
		expect(dayTotals([])).toBe('0 exercises · 0 sets');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	const set = (id: number, exerciseId: number): DaySet => ({
		id,
		exerciseId,
		exerciseName: `E${exerciseId}`,
		doneAt: 0,
		durationS: null,
		reps: null,
		rating: null,
		note: null
	});
	const sets = (exercises: number, total: number) =>
		Array.from({ length: total }, (_, i) => set(i + 1, (i % exercises) + 1));

	it.each([
		[1, 'Vadba · 2 od 5 · doslej 1 vnos'],
		[2, 'Vadba · 2 od 5 · doslej 2 vnosa'],
		[3, 'Vadba · 2 od 5 · doslej 3 vnosi'],
		[5, 'Vadba · 2 od 5 · doslej 5 vnosov']
	])('the session line counts what was logged: %s', (logged, line) => {
		expect(sl(() => sessionLine([1], [2, 3, 4, 5], 2, logged))).toBe(line);
	});

	it('the session line before anything is logged', () => {
		expect(sl(() => sessionLine([], [1, 2, 3], 1, 0))).toBe('Vadba · 1 od 3');
	});

	it.each([
		[1, 1, '1 vaja · 1 vnos'],
		[2, 2, '2 vaji · 2 vnosa'],
		[3, 3, '3 vaje · 3 vnosi'],
		[5, 5, '5 vaj · 5 vnosov']
	])("a day's totals: %s exercises, %s sets", (e, n, line) => {
		expect(sl(() => dayTotals(sets(e, n)))).toBe(line);
	});
});
