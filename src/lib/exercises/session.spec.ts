import { describe, expect, it } from 'vitest';
import { nextInSession, sessionWalk } from './session';

const row = (id: number, kind: 'done' | 'todo' | 'picked' = 'todo') => ({
	exercise: { id },
	kind
});

describe('sessionWalk', () => {
	it('walks the to-do rows, then the picked ones, never a done one', () => {
		const rows = [row(1, 'done'), row(2), row(3), row(4, 'picked'), row(5, 'picked')];
		expect(sessionWalk(rows).map((r) => r.exercise.id)).toEqual([2, 3, 4, 5]);
	});
	it('puts a picked row after every to-do one, whatever the order given', () => {
		const rows = [row(4, 'picked'), row(2), row(1, 'done'), row(3)];
		expect(sessionWalk(rows).map((r) => r.exercise.id)).toEqual([2, 3, 4]);
	});
});

type Kind = 'done' | 'todo' | 'picked';
const w = (id: number, kind: Kind = 'todo') => ({
	exercise: { id },
	kind,
	list: 'warmup' as const
});
const p = (id: number, kind: Kind = 'todo') => ({
	exercise: { id },
	kind,
	list: 'practice' as const
});

describe('sessionWalk with warm-ups', () => {
	it('walks the warm-ups first, in their order, a picked one among them', () => {
		const rows = [p(1, 'done'), w(10), w(11, 'picked'), w(12, 'done'), p(2), p(4, 'picked'), p(3)];
		expect(sessionWalk(rows).map((r) => r.exercise.id)).toEqual([10, 11, 2, 3, 4]);
	});
	it('a row without a list is practice', () => {
		expect(
			sessionWalk([{ exercise: { id: 2 }, kind: 'todo' as const }, w(10)]).map((r) => r.exercise.id)
		).toEqual([10, 2]);
	});
});

describe('nextInSession', () => {
	it('takes the first of the walk', () => {
		expect(nextInSession([row(1), row(2), row(3)], new Set(), null)).toEqual(row(1));
	});
	it('skips the one open and the ones skipped', () => {
		expect(nextInSession([row(1), row(2), row(3)], new Set([2]), 1)).toEqual(row(3));
	});
	it('is null when nothing is left', () => {
		expect(nextInSession([row(1)], new Set(), 1)).toBeNull();
		expect(nextInSession([], new Set(), null)).toBeNull();
	});
});
