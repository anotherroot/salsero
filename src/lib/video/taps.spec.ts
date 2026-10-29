import { describe, expect, it } from 'vitest';
import { CHAIN_MS, DOUBLE_TAP_MS, expire, IDLE, tap, zoneOf } from './taps';

describe('zoneOf', () => {
	it('splits the picture in thirds', () => {
		expect(zoneOf(10, 300)).toBe('left');
		expect(zoneOf(150, 300)).toBe('mid');
		expect(zoneOf(290, 300)).toBe('right');
	});
});

describe('tap', () => {
	it('acts on a middle tap at once', () => {
		const r = tap(IDLE, 0, 'mid');
		expect(r.act).toEqual({ kind: 'single' });
		expect(r.wait).toBe(false);
	});

	it('waits on a side tap, and it becomes a single tap when no second comes', () => {
		const r = tap(IDLE, 0, 'left');
		expect(r.act).toBeNull();
		expect(r.wait).toBe(true);
		expect(expire(r.state, DOUBLE_TAP_MS - 10).act).toBeNull();
		expect(expire(r.state, DOUBLE_TAP_MS + 10).act).toEqual({ kind: 'single' });
	});

	it('jumps on a double tap, and each further tap on that side adds a second', () => {
		let r = tap(IDLE, 0, 'left');
		r = tap(r.state, 200, 'left');
		expect(r.act).toEqual({ kind: 'jump', side: 'left', total: 1 });
		r = tap(r.state, 500, 'left');
		expect(r.act).toEqual({ kind: 'jump', side: 'left', total: 2 });
		expect(expire(r.state, 500 + DOUBLE_TAP_MS + 10).act).toBeNull();
	});

	it('breaks the chain on the other side', () => {
		let r = tap(IDLE, 0, 'right');
		r = tap(r.state, 100, 'right');
		r = tap(r.state, 150, 'left');
		expect(r.act).toBeNull();
		expect(r.wait).toBe(true);
	});

	it('does not jump for one tap on each side', () => {
		const r = tap(tap(IDLE, 0, 'left').state, 100, 'right');
		expect(r.act).toBeNull();
	});

	it('does not jump for two taps further apart than the window', () => {
		const r = tap(tap(IDLE, 0, 'left').state, DOUBLE_TAP_MS + 50, 'left');
		expect(r.act).toBeNull();
		expect(r.wait).toBe(true);
	});

	it('ends a chain once it has been quiet for the chain window', () => {
		let r = tap(IDLE, 0, 'left');
		r = tap(r.state, 100, 'left');
		const after = expire(r.state, 100 + CHAIN_MS + 100);
		expect(after.state).toEqual(IDLE);
		expect(tap(after.state, 100 + CHAIN_MS + 120, 'left').act).toBeNull();
	});
});
