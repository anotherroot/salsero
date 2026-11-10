import { describe, expect, it } from 'vitest';
import {
	PULL_MAX,
	PULL_TRIGGER,
	PULL_HOLD,
	doneWord,
	mayStart,
	phaseWhilePulling,
	pullDistance,
	watchesMove
} from './pull-refresh';

const start = { pointerType: 'touch', scrollY: 0, dx: 0, dy: 20, inside: false };

describe('pullDistance', () => {
	it('starts at nothing and never moves up', () => {
		expect(pullDistance(0)).toBe(0);
		expect(pullDistance(-50)).toBe(0);
	});
	it('resists: the sheet moves less than the finger, and never past the max', () => {
		expect(pullDistance(200)).toBeLessThan(200);
		expect(pullDistance(10_000)).toBeLessThanOrEqual(PULL_MAX);
	});
	it('reaches the trigger with a natural pull, and holds open below it', () => {
		expect(pullDistance(160)).toBeGreaterThanOrEqual(PULL_TRIGGER);
		expect(PULL_HOLD).toBeLessThan(PULL_TRIGGER);
	});
});

describe('phaseWhilePulling', () => {
	it('says pull short of the trigger and let go past it', () => {
		expect(phaseWhilePulling(PULL_TRIGGER - 1)).toBe('pull');
		expect(phaseWhilePulling(PULL_TRIGGER)).toBe('ready');
	});
});

describe('mayStart', () => {
	it('starts on a touch moving down at the top of the page', () =>
		expect(mayStart(start)).toBe(true));
	it('never once the page has scrolled', () =>
		expect(mayStart({ ...start, scrollY: 4 })).toBe(false));
	it('never on a horizontal swipe (a row being swiped)', () =>
		expect(mayStart({ ...start, dx: 30, dy: 10 })).toBe(false));
	it('never moving up', () => expect(mayStart({ ...start, dy: -20 })).toBe(false));
	it('never with a mouse or a pen', () => {
		expect(mayStart({ ...start, pointerType: 'mouse' })).toBe(false);
		expect(mayStart({ ...start, pointerType: 'pen' })).toBe(false);
	});
	it('never inside a sheet, a dialog or the player', () =>
		expect(mayStart({ ...start, inside: true })).toBe(false));
});

describe('doneWord', () => {
	it('says up to date only when everything went', () => {
		expect(doneWord(null)).toBe(true);
		expect(doneWord({ waiting: 0, refused: 0, signedOut: false })).toBe(true);
		expect(doneWord({ waiting: 2, refused: 0, signedOut: false })).toBe(false);
		expect(doneWord({ waiting: 0, refused: 1, signedOut: false })).toBe(false);
		expect(doneWord({ waiting: 0, refused: 0, signedOut: true })).toBe(false);
	});
});

describe('watchesMove', () => {
	it('holds the scroll only for a touch that starts at the very top', () => {
		expect(watchesMove(0)).toBe(true);
		expect(watchesMove(1)).toBe(false);
		expect(watchesMove(800)).toBe(false);
	});
});
