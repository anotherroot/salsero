import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { longPress } from './longpress';

describe('longPress', () => {
	let selecting: boolean;
	let pressed: number[];
	const make = () =>
		longPress({
			ms: 500,
			tolerancePx: 10,
			enabled: () => !selecting,
			onLongPress: (id) => {
				pressed.push(id);
				selecting = true;
			}
		});

	beforeEach(() => {
		vi.useFakeTimers();
		selecting = false;
		pressed = [];
	});
	afterEach(() => vi.useRealTimers());

	it('fires after the hold and swallows the click that follows it, once', () => {
		const lp = make();
		lp.down(7, 0, 0);
		vi.advanceTimersByTime(500);
		expect(pressed).toEqual([7]);
		lp.up();
		expect(lp.swallow()).toBe(true);
		expect(lp.swallow()).toBe(false);
	});

	it('does not fire when released early, and lets the click through', () => {
		const lp = make();
		lp.down(7, 0, 0);
		vi.advanceTimersByTime(300);
		lp.up();
		vi.advanceTimersByTime(500);
		expect(pressed).toEqual([]);
		expect(lp.swallow()).toBe(false);
	});

	it('does not fire when the pointer moves away — that is a scroll', () => {
		const lp = make();
		lp.down(7, 0, 0);
		lp.move(0, 30);
		vi.advanceTimersByTime(500);
		expect(pressed).toEqual([]);
	});

	it('starts no press while the list is already selecting', () => {
		const lp = make();
		selecting = true;
		lp.down(7, 0, 0);
		vi.advanceTimersByTime(500);
		expect(pressed).toEqual([]);
	});

	// A phone often sends NO click after a long press (Android ends it as a
	// long-press gesture). The next tap must still count.
	it('lets the next tap through when the long press sent no click of its own', () => {
		const lp = make();
		lp.down(7, 0, 0);
		vi.advanceTimersByTime(500);
		lp.up();
		// no click here — then the user taps another row
		lp.down(8, 0, 0);
		lp.up();
		expect(lp.swallow()).toBe(false);
	});
});
