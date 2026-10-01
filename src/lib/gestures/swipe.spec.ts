import { describe, expect, it } from 'vitest';
import { swipe } from './swipe';

const make = (left = true, right = true) =>
	swipe({ reveal: 84, lockPx: 10, snap: 0.4, sides: () => ({ left, right }) });

describe('swipe', () => {
	it('is undecided inside the lock distance', () => {
		const s = make();
		s.down(100, 100, null);
		expect(s.move(105, 102)).toBeNull();
	});

	it('follows a horizontal move once locked', () => {
		const s = make();
		s.down(100, 100, null);
		expect(s.move(80, 102)).toBe(-20);
	});

	it('gives a vertical move to the page for the rest of the gesture', () => {
		const s = make();
		s.down(100, 100, null);
		expect(s.move(102, 130)).toBeNull();
		expect(s.move(20, 130)).toBeNull();
		expect(s.up()).toBeUndefined();
		expect(s.swallow()).toBe(false);
	});

	it('snaps open past 40 % of the reveal, shut short of it', () => {
		const s = make();
		s.down(100, 100, null);
		s.move(60, 100); // -40 ≥ 33.6
		expect(s.up()).toBe('left');
		s.down(100, 100, null);
		s.move(80, 100); // -20
		expect(s.up()).toBeNull();
		s.down(100, 100, null);
		s.move(150, 100);
		expect(s.up()).toBe('right');
	});

	it('starts from where an open card rests', () => {
		const s = make();
		s.down(100, 100, 'left');
		expect(s.move(120, 100)).toBe(-64);
		expect(s.up()).toBe('left');
		s.down(100, 100, 'left');
		s.move(160, 100); // -84 + 60 = -24
		expect(s.up()).toBeNull();
	});

	it('will not open a side that has no button', () => {
		const s = make(true, false);
		s.down(100, 100, null);
		expect(s.move(200, 100)).toBe(0);
		expect(s.up()).toBeNull();
	});

	it('is a tap, not a swipe, without movement — and swallows only a swipe’s click', () => {
		const s = make();
		s.down(100, 100, null);
		expect(s.up()).toBeUndefined();
		expect(s.swallow()).toBe(false);
		s.down(100, 100, null);
		s.move(50, 100);
		s.up();
		expect(s.swallow()).toBe(true);
		expect(s.swallow()).toBe(false);
	});
});
