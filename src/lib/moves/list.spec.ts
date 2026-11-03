import { describe, expect, it } from 'vitest';
import { figureRowMeta, figureRowParts, movesHeading } from './list';

const base = {
	startCount: null,
	lengthCounts: null,
	recordings: 0,
	hasSection: true,
	hasLesson: true
};

describe('figureRowMeta', () => {
	it('names the start, the length and the recordings', () => {
		expect(figureRowMeta({ ...base, startCount: 1, lengthCounts: 16, recordings: 2 })).toBe(
			'Starts on 1 · 16 counts · 2 recordings'
		);
	});
	it('omits what is unknown', () => {
		expect(figureRowMeta(base)).toBe('');
		expect(figureRowMeta({ ...base, startCount: 5 })).toBe('Starts on 5');
		expect(figureRowMeta({ ...base, lengthCounts: 1, recordings: 1 })).toBe(
			'1 count · 1 recording'
		);
	});
	it('appends what it lacks, as status parts', () => {
		const f = { ...base, startCount: 1, lengthCounts: 8, hasSection: false };
		expect(figureRowMeta(f)).toBe('Starts on 1 · 8 counts · No section');
		expect(figureRowParts({ ...f, hasLesson: false }).filter((p) => p.status)).toEqual([
			{ text: 'No section', status: true },
			{ text: 'No lesson', status: true }
		]);
	});
});

describe('movesHeading', () => {
	it('counts figures, with Yours, or matches', () => {
		expect(movesHeading({ moves: 5, figures: 14 }, false)).toBe('Yours · 14 figures');
		expect(movesHeading({ moves: 5, figures: 14 }, true)).toBe('14 figures match');
		expect(movesHeading({ moves: 1, figures: 1 }, false)).toBe('Yours · 1 figure');
		expect(movesHeading({ moves: 1, figures: 1 }, true)).toBe('1 figure matches');
		expect(movesHeading({ moves: 1, figures: 2 }, false, null)).toBe('2 figures');
	});
});
