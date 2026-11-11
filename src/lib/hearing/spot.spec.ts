import { describe, expect, it } from 'vitest';
import {
	canSkip,
	endSpot,
	longestGapBeats,
	newSpot,
	restartSpot,
	skipSpot,
	stepSpot,
	tapSpot
} from './spot';

const RULES = { eightS: 4, gapS: 1, winS: 0.15, beatS: 0.5 };
const WINDOW = { eight: 3, from: 12, end: 20 };

describe('longestGapBeats', () => {
	it('is the longest wait between two target beats, round the eight', () => {
		expect(longestGapBeats([2, 3, 5, 6.5, 8])).toBe(2);
		expect(longestGapBeats([1])).toBe(8);
		expect(longestGapBeats([3, 6, 7])).toBe(4);
	});
});

describe('a spot', () => {
	it('starts over after four eights without a tap', () => {
		const s = newSpot(10);
		expect(stepSpot(s, 25.9, RULES)).toBe('keep');
		expect(stepSpot(s, 26.01, RULES)).toBe('restart');
	});

	it('starts over when the person stops tapping', () => {
		let s = tapSpot(newSpot(10), 12, WINDOW, 10);
		s = tapSpot(s, 13, WINDOW, 10);
		expect(s.phase).toBe('tapping');
		expect(stepSpot(s, 18.4, RULES)).toBe('keep');
		expect(stepSpot(s, 18.51, RULES)).toBe('restart');
	});

	it('ends when its two eights are over', () => {
		let s = tapSpot(newSpot(10), 12, WINDOW, 10);
		for (const at of [13, 14, 15, 16, 17, 18, 19]) s = tapSpot(s, at, null, 10);
		expect(stepSpot(s, 20.1, RULES)).toBe('keep');
		expect(stepSpot(s, 20.16, RULES)).toBe('end');
	});

	it('fills no more circles than it has', () => {
		let s = newSpot(10);
		for (let i = 0; i < 5; i++) s = tapSpot(s, 12 + i * 0.5, WINDOW, 3);
		expect(s.fill).toBe(3);
		expect(s.taps).toHaveLength(5);
	});

	it('keeps its window from the first tap', () => {
		const s = tapSpot(tapSpot(newSpot(10), 12, WINDOW, 10), 13, { eight: 9, from: 0, end: 1 }, 10);
		expect(s.window).toEqual(WINDOW);
		expect(s.first).toBe(12);
	});

	it('starts over from its start (the music goes back there), counting the restart', () => {
		const s = restartSpot(tapSpot(newSpot(10), 12, WINDOW, 10));
		expect(s).toMatchObject({
			start: 10,
			attemptStart: 10,
			restarts: 1,
			first: null,
			taps: [],
			fill: 0,
			window: null,
			phase: 'listening'
		});
	});

	it('offers Skip from the third start-over', () => {
		let s = newSpot(10);
		s = restartSpot(restartSpot(s));
		expect(canSkip(s)).toBe(false);
		s = restartSpot(s);
		expect(canSkip(s)).toBe(true);
		expect(skipSpot(s)).toMatchObject({ phase: 'over', skipped: true });
	});

	it('takes no taps and no start-over once over', () => {
		const over = endSpot(tapSpot(newSpot(10), 12, WINDOW, 10));
		expect(tapSpot(over, 13, null, 10)).toBe(over);
		expect(restartSpot(over)).toBe(over);
		expect(stepSpot(over, 99, RULES)).toBe('keep');
		expect(canSkip({ ...over, restarts: 5 })).toBe(false);
	});
});

describe('a spot on the 1', () => {
	it('ends rather than starting over when its only tap came just before a 1', () => {
		// The 1 at 120 BPM: an eight is 4 s, the longest gap 4 s. A tap at 15.9 opens the eight at 16; it ends at 24.
		const rules = { eightS: 4, gapS: 4, winS: 0.15, beatS: 0.5 };
		const s = tapSpot(newSpot(10), 15.9, { eight: 4, from: 16, end: 24 }, 2);
		expect(stepSpot(s, 23.95, rules)).toBe('keep');
		expect(stepSpot(s, 24.16, rules)).toBe('end');
	});
});
