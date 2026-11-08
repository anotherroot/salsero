import { describe, expect, it } from 'vitest';
import { isQuiet, quietRanges } from './quiet';

// Two eights a second apart per beat: beat i at i seconds, 1 on 0, 8, 16, 24.
const beats = Array.from({ length: 32 }, (_, i) => i);
const counts = beats.map((i) => (i % 8) + 1);

describe('the quiet parts of a song (a section with the count off)', () => {
	it('runs from a count-off section’s 1 to the next section’s', () => {
		const ranges = quietRanges(
			[
				{ at: 0, name: 'Intro', countOff: true },
				{ at: 8.2, name: 'Verse', countOff: false },
				{ at: 23.6, name: 'Break', countOff: true }
			],
			beats,
			counts
		);
		expect(ranges).toEqual([
			{ from: 0, to: 8 },
			{ from: 24, to: Infinity }
		]);
	});

	it('is nothing without a count-off section', () => {
		expect(quietRanges([{ at: 0, name: 'A', countOff: false }], beats, counts)).toEqual([]);
		expect(quietRanges([], beats, counts)).toEqual([]);
	});

	it('is quiet from the start of a range up to, not at, its end', () => {
		const ranges = [{ from: 0, to: 8 }];
		expect(isQuiet(ranges, 0)).toBe(true);
		expect(isQuiet(ranges, 7.9)).toBe(true);
		expect(isQuiet(ranges, 8)).toBe(false);
		expect(isQuiet([], 3)).toBe(false);
	});
});
