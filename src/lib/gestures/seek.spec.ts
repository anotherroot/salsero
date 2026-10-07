import { describe, expect, it } from 'vitest';
import { seekTime } from './seek';

describe('seekTime', () => {
	it('maps the pointer across the bar onto the song', () => {
		expect(seekTime(100, 100, 200, 240)).toBe(0);
		expect(seekTime(200, 100, 200, 240)).toBe(120);
		expect(seekTime(300, 100, 200, 240)).toBe(240);
	});

	it('pins a drag past either end to the start or the end', () => {
		expect(seekTime(40, 100, 200, 240)).toBe(0);
		expect(seekTime(900, 100, 200, 240)).toBe(240);
	});

	/** An `<audio>` reports NaN until its metadata loads, Infinity for a stream. */
	it('answers 0 while the duration is unknown, rather than NaN', () => {
		expect(seekTime(200, 100, 200, NaN)).toBe(0);
		expect(seekTime(200, 100, 200, Infinity)).toBe(0);
		expect(seekTime(200, 100, 0, 240)).toBe(0);
	});
});
