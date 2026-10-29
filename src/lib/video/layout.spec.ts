import { describe, expect, it } from 'vitest';
import { layoutFor } from './layout';

describe('layoutFor', () => {
	it.each([
		[390, 844, 'portrait'],
		[844, 390, 'landscape'],
		[1024, 519, 'landscape'],
		[1280, 800, 'desktop'],
		[800, 800, 'desktop']
	] as const)('%i×%i is %s', (w, h, layout) => {
		expect(layoutFor(w, h)).toBe(layout);
	});
});
