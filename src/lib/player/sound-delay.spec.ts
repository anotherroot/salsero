import { describe, expect, it } from 'vitest';
import {
	DELAY_MAX_MS,
	correctionFor,
	steadyDelay,
	parseDelayCorrection,
	reportedDelayMs,
	totalDelayMs
} from './sound-delay';

describe('reportedDelayMs', () => {
	it('adds the browser buffer and the output path', () => {
		expect(reportedDelayMs({ baseLatency: 0.01, outputLatency: 0.2 })).toBe(210);
	});

	it('says 0 for a browser that reports nothing, or nonsense', () => {
		expect(reportedDelayMs(null)).toBe(0);
		expect(reportedDelayMs({})).toBe(0);
		expect(reportedDelayMs({ outputLatency: NaN, baseLatency: -1 })).toBe(0);
	});
});

describe('the whole wait', () => {
	it('is what the phone reports plus the correction', () => {
		expect(totalDelayMs(210, 40)).toBe(250);
		expect(totalDelayMs(210, -60)).toBe(150);
	});

	it('never runs the screen ahead of the sound, nor past the maximum', () => {
		expect(totalDelayMs(20, -100)).toBe(0);
		expect(totalDelayMs(300, DELAY_MAX_MS)).toBe(DELAY_MAX_MS);
	});

	it('round-trips through the correction it is set by', () => {
		const c = correctionFor(250, 210);
		expect(c).toBe(40);
		expect(totalDelayMs(210, c)).toBe(250);
		// A phone that reports nothing: the whole wait is the correction.
		expect(correctionFor(200, 0)).toBe(200);
	});
});

describe('parseDelayCorrection', () => {
	it('reads what was stored, and 0 for anything else', () => {
		expect(parseDelayCorrection('120')).toBe(120);
		expect(parseDelayCorrection('-30')).toBe(-30);
		expect(parseDelayCorrection(null)).toBe(0);
		expect(parseDelayCorrection('soon')).toBe(0);
	});

	it('keeps a stored value in range', () => {
		expect(parseDelayCorrection('99999')).toBe(DELAY_MAX_MS);
		expect(parseDelayCorrection('-99999')).toBe(-DELAY_MAX_MS);
	});
});

describe('steadyDelay', () => {
	it('holds still through the wobble', () => {
		const d = steadyDelay();
		const seen = new Set<number>();
		for (let i = 0; i < 200; i++) seen.add(d.read(250 + ((i * 7) % 31) - 15));
		expect([...seen]).toEqual([240]);
	});

	it('follows a real change (headphones connected) within half a second', () => {
		const d = steadyDelay();
		for (let i = 0; i < 40; i++) d.read(30);
		expect(d.ms).toBe(30);
		let reads = 0;
		while (d.read(250) !== 250) reads++;
		expect(reads).toBeLessThanOrEqual(20);
	});

	it('is 0 before anything is read', () => {
		expect(steadyDelay().ms).toBe(0);
	});
});
