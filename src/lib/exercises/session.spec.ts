import { describe, expect, it } from 'vitest';
import { nextInSession, sessionWalk, sessionSummary } from './session';

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

describe('sessionSummary', () => {
	it('counts exercises and minutes', () => {
		expect(sessionSummary(3, 1500)).toBe('3 exercises, 25 min');
		expect(sessionSummary(1, 0)).toBe('1 exercise');
		expect(sessionSummary(0, 0)).toBe('Nothing logged');
	});
});
