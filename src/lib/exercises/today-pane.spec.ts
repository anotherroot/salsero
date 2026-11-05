import { describe, expect, it } from 'vitest';
import type { DaySet } from '$lib/types';
import { defaultOpen, dayTotals, sessionLine } from './today-pane';
import { todayBands, teamOfRow } from './today';

type R = { exercise: { id: number; team: { id: number; name: string } | null } };
const own = (id: number): R => ({ exercise: { id, team: null } });
const grp = (id: number): R => ({ exercise: { id, team: { id: 1, name: 'G' } } });
const bands = (o: Partial<Record<'due' | 'upcoming' | 'doneToday' | 'inactive', R[]>>) =>
	todayBands<R>(
		{ due: [], upcoming: [], doneToday: [], inactive: [], ...o },
		(r) => teamOfRow(r) as never
	);

describe('defaultOpen', () => {
	it('prefers a due row to a not yet due one', () => {
		expect(defaultOpen(bands({ due: [own(3)], upcoming: [own(9)] }))).toBe(3);
	});
	it('opens the first due, own before a group', () => {
		expect(defaultOpen(bands({ due: [grp(7), own(3), own(4)] }))).toBe(3);
	});
	it('falls to not yet due', () => {
		expect(defaultOpen(bands({ upcoming: [own(9)] }))).toBe(9);
	});
	it('opens a group row when it is all there is', () => {
		expect(defaultOpen(bands({ due: [grp(7)] }))).toBe(7);
	});
	it('opens nothing from done today or inactive', () => {
		expect(defaultOpen(bands({ doneToday: [own(1)], inactive: [own(2)] }))).toBeNull();
		expect(defaultOpen(bands({}))).toBeNull();
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
