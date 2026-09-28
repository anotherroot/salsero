import { describe, expect, it } from 'vitest';
import { nextInSession, sessionSummary } from './session';

const row = (id: number) => ({ exercise: { id } });

describe('nextInSession', () => {
	it('takes due first, then not-yet-due', () => {
		expect(nextInSession([row(1), row(2)], [row(3)], new Set(), null)).toEqual(row(1));
		expect(nextInSession([], [row(3)], new Set(), null)).toEqual(row(3));
	});
	it('skips the one open and the ones skipped', () => {
		expect(nextInSession([row(1), row(2)], [row(3)], new Set([2]), 1)).toEqual(row(3));
	});
	it('is null when nothing is left', () => {
		expect(nextInSession([row(1)], [], new Set(), 1)).toBeNull();
	});
});

describe('sessionSummary', () => {
	it('counts exercises and minutes', () => {
		expect(sessionSummary(3, 1500)).toBe('Session done — 3 exercises, 25 min');
		expect(sessionSummary(1, 0)).toBe('Session done — 1 exercise');
		expect(sessionSummary(0, 0)).toBe('Session done');
	});
});
