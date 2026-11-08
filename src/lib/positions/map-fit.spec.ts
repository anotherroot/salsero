import { describe, expect, it } from 'vitest';
import {
	clampMapView,
	fitView,
	panMapView,
	pinchMapView,
	viewTransform,
	wheelMapView,
	wholeView,
	type Room
} from './map-fit';

const room: Room = { w: 400, h: 800, top: 60, bottom: 100 };
const frame = { width: 1000, height: 1000 };

describe('wholeView', () => {
	it('fits the whole frame in the free part of the room, centred, 12 px clear of its sides', () => {
		const v = wholeView(frame, room);
		// 400 wide less 12 a side: 376 for a frame 1000 wide.
		expect(v.scale).toBeCloseTo(0.376);
		expect(v.x).toBeCloseTo(12);
		// Free height 640, frame 376 tall: centred between top and bottom.
		expect(v.y).toBeCloseTo(60 + (640 - 376) / 2);
	});
	it('never blows a small frame up', () => {
		expect(wholeView({ width: 100, height: 100 }, room).scale).toBe(1);
	});
});

describe('fitView', () => {
	it('centres one box at scale 1 (the max)', () => {
		const v = fitView([{ x: 500, y: 500, w: 100, h: 30 }], frame, room);
		expect(v.scale).toBe(1);
		expect(500 * v.scale + v.x).toBeCloseTo(room.w / 2);
		expect(500 * v.scale + v.y).toBeCloseTo(room.top + (room.h - room.top - room.bottom) / 2);
	});
	it('scales down so boxes wider than the room all fit in the free area', () => {
		const boxes = [
			{ x: 100, y: 200, w: 100, h: 30 },
			{ x: 900, y: 700, w: 100, h: 30 }
		];
		const v = fitView(boxes, frame, room);
		expect(v.scale).toBeLessThan(1);
		for (const b of boxes) {
			const l = (b.x - b.w / 2) * v.scale + v.x;
			const r = (b.x + b.w / 2) * v.scale + v.x;
			const t = (b.y - b.h / 2) * v.scale + v.y;
			const bt = (b.y + b.h / 2) * v.scale + v.y;
			expect(l).toBeGreaterThanOrEqual(-0.001);
			expect(r).toBeLessThanOrEqual(room.w + 0.001);
			expect(t).toBeGreaterThanOrEqual(room.top - 0.001);
			expect(bt).toBeLessThanOrEqual(room.h - room.bottom + 0.001);
		}
	});
	it('pads the fit by 14 px around the boxes', () => {
		const v = fitView([{ x: 500, y: 500, w: 400, h: 30 }], frame, room);
		expect(v.scale).toBeCloseTo(400 / 428);
	});
	it("never goes below the whole view's scale", () => {
		const wide = [
			{ x: 0, y: 0, w: 100, h: 30 },
			{ x: 1000, y: 1000, w: 100, h: 30 }
		];
		expect(fitView(wide, frame, room).scale).toBeGreaterThanOrEqual(wholeView(frame, room).scale);
	});
	it('honours a larger max', () => {
		const v = fitView([{ x: 500, y: 500, w: 40, h: 20 }], frame, room, 2);
		expect(v.scale).toBe(2);
	});
	it('shows the whole map for no boxes', () => {
		expect(fitView([], frame, room)).toEqual(wholeView(frame, room));
	});
});

describe('clampMapView', () => {
	it("brings a tiny scale to the whole view's and a huge one to 4", () => {
		expect(clampMapView({ scale: 0.1, x: 0, y: 0 }, frame, room).scale).toBeCloseTo(
			wholeView(frame, room).scale
		);
		expect(clampMapView({ scale: 9, x: 0, y: 0 }, frame, room).scale).toBe(4);
	});
	it('keeps some map on screen when panned away', () => {
		const v = clampMapView({ scale: 2, x: 9999, y: -9999 }, frame, room);
		expect(v.x).toBeLessThan(room.w);
		expect(v.y + 1000 * 2).toBeGreaterThan(room.top);
	});
	it('leaves a sensible view alone', () => {
		const v = { scale: 2, x: -300, y: -200 };
		expect(clampMapView(v, frame, room)).toEqual(v);
	});
});

describe('viewTransform', () => {
	it('is the CSS for transform-origin 0 0', () => {
		expect(viewTransform({ scale: 0.5, x: 10, y: -4 })).toBe('translate(10px, -4px) scale(0.5)');
	});
});

/** Where a frame point lands on screen under a view (origin 0 0, from the room's top left). */
const screen = (v: { scale: number; x: number; y: number }, p: { x: number; y: number }) => ({
	x: p.x * v.scale + v.x,
	y: p.y * v.scale + v.y
});

describe('the gestures (pinchMapView, panMapView, wheelMapView)', () => {
	const at2 = { scale: 2, x: -300, y: -200 };
	type Two = [{ x: number; y: number }, { x: number; y: number }];

	it('a pinch keeps the map point under the fingers’ middle under it', () => {
		const from: Two = [
			{ x: 150, y: 300 },
			{ x: 250, y: 300 }
		];
		const to: Two = [
			{ x: 125, y: 300 },
			{ x: 275, y: 300 }
		];
		const v = pinchMapView(at2, from, to, frame, room);
		expect(v.scale).toBeCloseTo(3);
		// The frame point under (200, 300) at 2x is (250, 250); it stays under (200, 300).
		const q = screen(v, { x: 250, y: 250 });
		expect(q.x).toBeCloseTo(200);
		expect(q.y).toBeCloseTo(300);
	});

	it('a pinch out stops at the whole view’s scale, not at 1', () => {
		const whole = wholeView(frame, room);
		const from: Two = [
			{ x: 100, y: 300 },
			{ x: 300, y: 300 }
		];
		const to: Two = [
			{ x: 199, y: 300 },
			{ x: 201, y: 300 }
		];
		const v = pinchMapView(at2, from, to, frame, room);
		expect(v.scale).toBeCloseTo(whole.scale);
		expect(v.scale).toBeLessThan(1);
	});

	it('a pinch in stops at 4', () => {
		const from: Two = [
			{ x: 199, y: 300 },
			{ x: 201, y: 300 }
		];
		const to: Two = [
			{ x: 0, y: 300 },
			{ x: 400, y: 300 }
		];
		expect(pinchMapView(at2, from, to, frame, room).scale).toBe(4);
	});

	it('a pan moves the view by the finger, clamped like any view', () => {
		expect(panMapView(at2, 30, -20, frame, room)).toEqual({ scale: 2, x: -270, y: -220 });
		const far = panMapView(at2, 99999, 0, frame, room);
		expect(far).toEqual(clampMapView({ ...at2, x: at2.x + 99999 }, frame, room));
		expect(far.x).toBeLessThan(room.w);
	});

	it('Ctrl+wheel zooms about the pointer: up zooms in, down out', () => {
		const p = { x: 200, y: 400 };
		const under = { x: (p.x - at2.x) / at2.scale, y: (p.y - at2.y) / at2.scale };
		const v = wheelMapView(at2, p, -100, frame, room);
		expect(v.scale).toBeGreaterThan(2);
		const q = screen(v, under);
		expect(q.x).toBeCloseTo(p.x);
		expect(q.y).toBeCloseTo(p.y);
		expect(wheelMapView(at2, p, 100, frame, room).scale).toBeLessThan(2);
	});
});
