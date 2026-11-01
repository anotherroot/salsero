import { describe, expect, it } from 'vitest';
import { inlineBands, inlineParts, lengthText, timeText } from './inline';

describe('inlineParts', () => {
	it('before the first play: the disc and the length, no bar', () => {
		expect(inlineParts({ played: false, paused: true, waiting: false })).toEqual({
			disc: true,
			length: true,
			bar: false,
			spinner: false
		});
	});
	it('waiting before the first play: the spinner replaces the disc', () => {
		expect(inlineParts({ played: false, paused: false, waiting: true })).toEqual({
			disc: false,
			length: true,
			bar: false,
			spinner: true
		});
	});
	it('playing: the bar only', () => {
		expect(inlineParts({ played: true, paused: false, waiting: false })).toEqual({
			disc: false,
			length: false,
			bar: true,
			spinner: false
		});
	});
	it('paused after playing (and ended counts as paused): the bar and the disc', () => {
		expect(inlineParts({ played: true, paused: true, waiting: false })).toEqual({
			disc: true,
			length: false,
			bar: true,
			spinner: false
		});
	});
	it('waiting while played: the bar and the spinner, no disc', () => {
		expect(inlineParts({ played: true, paused: false, waiting: true })).toEqual({
			disc: false,
			length: false,
			bar: true,
			spinner: true
		});
		expect(inlineParts({ played: true, paused: true, waiting: true }).disc).toBe(false);
	});
});

describe('timeText', () => {
	it('the time and the length', () => expect(timeText(9.4, 68)).toBe('0:09 / 1:08'));
	it('the length unknown: the time alone', () => {
		expect(timeText(9.4, NaN)).toBe('0:09');
		expect(timeText(9.4, Infinity)).toBe('0:09');
		expect(timeText(0, 0)).toBe('0:00');
	});
});

describe('lengthText', () => {
	it('a known length', () => expect(lengthText(68.2)).toBe('1:08'));
	it('not known yet', () => {
		expect(lengthText(NaN)).toBeNull();
		expect(lengthText(Infinity)).toBeNull();
		expect(lengthText(0)).toBeNull();
	});
});

describe('inlineBands', () => {
	it('sections and points, none active, in the order given', () => {
		const spots = [
			{ id: 1, startMs: 5000, endMs: 13700, label: 'Madrid', linkedTo: [] },
			{ id: 2, startMs: 20000, endMs: null, label: null, linkedTo: [] }
		];
		expect(inlineBands(spots)).toEqual([
			{ id: 1, startMs: 5000, endMs: 13700, active: false },
			{ id: 2, startMs: 20000, endMs: null, active: false }
		]);
	});
});
