import { describe, expect, it } from 'vitest';
import { frameDurationOf, type FrameSample } from './frame-rate';

function run(n: number, gap: number, from = 0, frame0 = 0): FrameSample[] {
	return Array.from({ length: n }, (_, i) => ({
		mediaTime: from + i * gap,
		presentedFrames: frame0 + i
	}));
}

describe('frameDurationOf', () => {
	it('is the gap between consecutive frames', () => {
		expect(frameDurationOf(run(10, 1 / 25))).toBeCloseTo(0.04, 6);
	});

	it('ignores a dropped frame and a seek', () => {
		const samples = [
			...run(4, 1 / 30),
			// a dropped frame: presentedFrames jumps by 2
			{ mediaTime: 5 / 30, presentedFrames: 5 },
			// a seek: one frame on, but 1.5 s later in the media
			{ mediaTime: 5 / 30 + 1.5, presentedFrames: 6 },
			...run(4, 1 / 30, 5 / 30 + 1.5 + 1 / 30, 7)
		];
		expect(frameDurationOf(samples)).toBeCloseTo(1 / 30, 6);
	});

	it('waits for five good pairs', () => {
		expect(frameDurationOf(run(5, 1 / 30))).toBeNull();
		expect(frameDurationOf([])).toBeNull();
	});
});
