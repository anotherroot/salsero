import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import type { DaySet } from '$lib/types';
import { defaultOpen, dayTotals } from './today-pane';

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
	it('opens the first warm-up before a practice to-do', () => {
		const pr = { exercise: { id: 2 }, kind: 'todo' as const, list: 'practice' as const };
		const wu = { exercise: { id: 10 }, kind: 'todo' as const, list: 'warmup' as const };
		expect(defaultOpen({ rows: [pr, wu] })).toBe(10);
	});
	it('opens nothing when everything is done', () => {
		expect(defaultOpen(day(r(1, 'done')))).toBeNull();
		expect(defaultOpen(day())).toBeNull();
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
	it('counts distinct exercises and time', () => {
		const sets = [
			set(1, 1, 3900 - 8 * 60),
			...[2, 3, 4, 5, 6, 7, 7].map((e, i) => set(i + 2, e, 60)),
			set(9, 1, 8 * 60 - 7 * 60)
		];
		expect(sets).toHaveLength(9);
		expect(dayTotals(sets)).toBe('7 exercises · 1 h 05');
	});
	it('leaves time out when none', () => {
		expect(dayTotals([set(1, 1, null)])).toBe('1 exercise');
		expect(dayTotals([])).toBe('0 exercises');
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
		[1, 1, '1 vaja'],
		[2, 2, '2 vaji'],
		[3, 3, '3 vaje'],
		[5, 5, '5 vaj']
	])("a day's totals: %s exercises, %s rows", (e, n, line) => {
		expect(sl(() => dayTotals(sets(e, n)))).toBe(line);
	});
});
