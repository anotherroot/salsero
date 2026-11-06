import { describe, expect, it } from 'vitest';
import { keyboardInsets } from './keyboard';

const phone = { innerHeight: 844, height: 844, offsetTop: 0, scale: 1 };

describe('keyboardInsets', () => {
	it('is null with no keyboard, and in the Android app, which shrinks the page itself', () => {
		expect(keyboardInsets(phone)).toBeNull();
		expect(keyboardInsets({ ...phone, innerHeight: 544, height: 544 })).toBeNull();
	});

	it('a keyboard over the page: the sheet ends where the keyboard starts', () => {
		expect(keyboardInsets({ ...phone, height: 544 })).toEqual({ top: 0, bottom: 300, height: 544 });
	});

	it('the browser panned the page to show the field: the sheet follows the visible part', () => {
		expect(keyboardInsets({ ...phone, height: 544, offsetTop: 120 })).toEqual({
			top: 120,
			bottom: 180,
			height: 544
		});
	});

	it('a pinch zoom is not a keyboard', () => {
		expect(keyboardInsets({ ...phone, height: 422, scale: 2 })).toBeNull();
	});

	it('ignores a sub-pixel difference', () => {
		expect(keyboardInsets({ ...phone, height: 843.6 })).toBeNull();
	});
});
