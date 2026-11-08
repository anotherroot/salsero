import { describe, expect, it } from 'vitest';
import { dismiss, fade, offscreen } from './dismiss';

const W = 358;

describe('dismiss', () => {
	it('is undecided inside the lock distance', () => {
		const d = dismiss();
		d.down(100, 100, 0, W);
		expect(d.move(105, 102, 16)).toBeNull();
	});

	it('follows a horizontal move once locked', () => {
		const d = dismiss();
		d.down(100, 100, 0, W);
		expect(d.move(70, 103, 16)).toBe(-30);
		expect(d.move(140, 103, 32)).toBe(40);
	});

	it('gives a vertical move to the page for the rest of the gesture', () => {
		const d = dismiss();
		d.down(100, 100, 0, W);
		expect(d.move(102, 130, 16)).toBeNull();
		expect(d.move(300, 130, 32)).toBeNull();
		expect(d.up(48)).toBeUndefined();
		expect(d.swallow()).toBe(false);
	});

	it('a tap is no swipe', () => {
		const d = dismiss();
		d.down(100, 100, 0, W);
		expect(d.up(80)).toBeUndefined();
		expect(d.swallow()).toBe(false);
	});

	it('goes past 35 % of its width, either way', () => {
		const d = dismiss();
		d.down(200, 100, 0, W);
		d.move(200 + 60, 100, 500);
		d.move(200 + 130, 100, 1000); // slow, 130 ≥ 125.3
		expect(d.up(1300)).toBe('right');
		d.down(200, 100, 0, W);
		d.move(200 - 60, 100, 500);
		d.move(200 - 130, 100, 1000);
		expect(d.up(1300)).toBe('left');
	});

	it('comes back short of it when slow', () => {
		const d = dismiss();
		d.down(200, 100, 0, W);
		d.move(200 + 40, 100, 400);
		d.move(200 + 80, 100, 800);
		expect(d.up(820)).toBe('back');
	});

	it('goes on a short quick flick', () => {
		const d = dismiss();
		d.down(200, 100, 0, W);
		d.move(200 - 20, 100, 16);
		d.move(200 - 40, 100, 32); // 20 px in 16 ms
		expect(d.up(40)).toBe('left');
	});

	it('a flick back toward home does not throw it the other way', () => {
		const d = dismiss();
		d.down(200, 100, 0, W);
		d.move(200 + 100, 100, 400);
		d.move(200 + 60, 100, 416); // moving left fast, still right of home
		expect(d.up(420)).toBe('back');
	});

	it('a pause before letting go is no flick', () => {
		const d = dismiss();
		d.down(200, 100, 0, W);
		d.move(200 - 20, 100, 16);
		d.move(200 - 40, 100, 32);
		expect(d.up(400)).toBe('back');
	});

	it('swallows the one click that follows a swipe', () => {
		const d = dismiss();
		d.down(200, 100, 0, W);
		d.move(200 + 30, 100, 16);
		d.up(500);
		expect(d.swallow()).toBe(true);
		expect(d.swallow()).toBe(false);
	});
});

describe('offscreen and fade', () => {
	it('goes past the width on its side', () => {
		expect(offscreen('left', W)).toBe(-(W + 24));
		expect(offscreen('right', W)).toBe(W + 24);
	});

	it('fades with distance, gone at the width', () => {
		expect(fade(0, W)).toBe(1);
		expect(fade(-W / 2, W)).toBe(0.5);
		expect(fade(W * 2, W)).toBe(0);
		expect(fade(10, 0)).toBe(1);
	});
});
