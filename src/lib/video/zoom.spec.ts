import { describe, expect, it } from 'vitest';
import {
	clampView,
	fitSize,
	MAX_ZOOM,
	NO_ZOOM,
	panView,
	pinchView,
	wheelView,
	zoomTransform
} from './zoom';

const box = { w: 390, h: 690 };
const upright = fitSize(box, { w: 1080, h: 1920 });
const wide = fitSize(box, { w: 1920, h: 1080 });

describe('fitSize', () => {
	it('is the contained picture at 1×', () => {
		expect(upright).toEqual({ w: 388.125, h: 690 });
		expect(wide).toEqual({ w: 390, h: 219.375 });
	});
});

describe('clampView', () => {
	it('keeps the scale between 1× and 4×', () => {
		expect(clampView({ scale: 9, x: 0, y: 0 }, box, upright).scale).toBe(MAX_ZOOM);
		expect(clampView({ scale: 0.5, x: 30, y: 30 }, box, upright)).toEqual(NO_ZOOM);
	});
	it('never pans past the picture own edges', () => {
		const v = clampView({ scale: 2, x: 999, y: -999 }, box, upright);
		expect(v.x).toBeCloseTo((776.25 - 390) / 2, 6);
		expect(v.y).toBeCloseTo(-(1380 - 690) / 2, 6);
	});
	it('keeps the picture centred along a side where it is still smaller than its box', () => {
		const v = clampView({ scale: 2, x: 999, y: 300 }, box, wide);
		expect(v.y).toBe(0);
		expect(v.x).toBeCloseTo((780 - 390) / 2, 6);
	});
	it('re-clamps to a new box after a rotation', () => {
		const turned = { w: 844, h: 390 };
		const pic = fitSize(turned, { w: 1080, h: 1920 });
		const v = clampView({ scale: 2, x: 193.125, y: 345 }, turned, pic);
		expect(v.x).toBe(0);
		expect(v.y).toBeCloseTo((pic.h * 2 - 390) / 2, 6);
	});
});

describe('pinchView', () => {
	it('scales by how far the fingers spread', () => {
		const v = pinchView(
			NO_ZOOM,
			[
				{ x: -50, y: 0 },
				{ x: 50, y: 0 }
			],
			[
				{ x: -100, y: 0 },
				{ x: 100, y: 0 }
			],
			box,
			upright
		);
		expect(v).toEqual({ scale: 2, x: 0, y: 0 });
	});
	it('keeps the picture point under the fingers', () => {
		const v = pinchView(
			NO_ZOOM,
			[
				{ x: 50, y: 0 },
				{ x: 150, y: 0 }
			],
			[
				{ x: 0, y: 0 },
				{ x: 200, y: 0 }
			],
			box,
			upright
		);
		expect(v.scale).toBe(2);
		expect(v.x).toBeCloseTo(-100, 6);
		expect(v.y).toBe(0);
	});
});

describe('panView', () => {
	it('moves a zoomed picture, clamped', () => {
		expect(panView({ scale: 2, x: 0, y: 0 }, 50, -20, box, upright)).toEqual({
			scale: 2,
			x: 50,
			y: -20
		});
		expect(panView(NO_ZOOM, 50, -20, box, upright)).toEqual(NO_ZOOM);
	});
});

describe('wheelView', () => {
	it('zooms about the pointer', () => {
		const v = wheelView(NO_ZOOM, { x: 0, y: 0 }, -200 * Math.log(2), box, upright);
		expect(v.scale).toBeCloseTo(2, 6);
		expect(v.x).toBeCloseTo(0, 6);
	});
});

describe('zoomTransform', () => {
	it('is the wrapper transform', () => {
		expect(zoomTransform({ scale: 2, x: 10, y: -5 })).toBe('translate(10px, -5px) scale(2)');
	});
});
