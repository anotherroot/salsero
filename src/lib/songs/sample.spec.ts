import { describe, expect, it } from 'vitest';
import { sampleGain, sampleStart } from './sample';

const beats = Array.from({ length: 200 }, (_, i) => i * 0.5); // 120 BPM
const counts = beats.map((_, i) => (i % 8) + 1); // a 1 every 4 s, at 0, 4, 8…

describe('sampleStart', () => {
	it('starts a third of the way in, snapped back to a 1', () => {
		expect(sampleStart({ durationS: 90, beats, counts, customS: null })).toBe(28); // 30 → the 1 at 28
	});
	it('snaps a custom start the same way', () => {
		expect(sampleStart({ durationS: 90, beats, counts, customS: 43.9 })).toBe(40);
	});
	it('keeps an exact 1', () => {
		expect(sampleStart({ durationS: 90, beats, counts, customS: 44 })).toBe(44);
	});
	it('falls back to the unsnapped time with no grid', () => {
		expect(sampleStart({ durationS: 90, beats: [], counts: [], customS: null })).toBe(30);
	});
	it('uses 0 when the duration is unknown and nothing is set', () => {
		expect(sampleStart({ durationS: null, beats, counts, customS: null })).toBe(0);
	});
	it('clamps a custom start past the end back to automatic', () => {
		expect(sampleStart({ durationS: 90, beats, counts, customS: 120 })).toBe(28);
	});
	it('keeps the unsnapped target when no 1 comes at or before it', () => {
		const late = counts.map((c, i) => (i < 5 ? 3 : c)); // no 1 before beat 5
		expect(sampleStart({ durationS: 9, beats, counts: late, customS: 1 })).toBe(1);
	});
});

describe('sampleGain', () => {
	it('fades in and out over a second', () => {
		expect(sampleGain(0, 15)).toBe(0);
		expect(sampleGain(0.5, 15)).toBeCloseTo(0.5);
		expect(sampleGain(7, 15)).toBe(1);
		expect(sampleGain(14.5, 15)).toBeCloseTo(0.5);
		expect(sampleGain(20, 15)).toBe(0);
	});
});
