import { describe, expect, it } from 'vitest';
import { splitMoveVideos } from './move-videos';
import type { Place } from './where';

const PIXEL = { kind: 'android' as const, model: 'Pixel 8' };

describe('Move to: which phone-only videos upload from here first', () => {
	it('here: held on this phone, not up yet; elsewhere: on another device, gone, or unknown', () => {
		const places: Record<string, Place | null> = {
			a: { state: 'only', iphone: false },
			b: { state: 'uploading', pct: 40 },
			c: { state: 'elsewhere', label: PIXEL },
			d: { state: 'missing', gallery: true },
			e: null,
			// Uploaded since the page loaded: it moves with the lesson.
			f: { state: 'both', copyBytes: 5 },
			g: { state: 'server' }
		};
		const out = splitMoveVideos(Object.keys(places), (k) => places[k]);
		expect(out).toEqual({ here: ['a', 'b'], elsewhere: ['c', 'd', 'e'], label: PIXEL });
	});

	it('none elsewhere: no device named', () => {
		expect(splitMoveVideos(['a'], () => ({ state: 'only', iphone: true }))).toEqual({
			here: ['a'],
			elsewhere: [],
			label: null
		});
	});
});
