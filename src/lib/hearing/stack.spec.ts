import { describe, expect, it } from 'vitest';
import { stackDepth, stackDots } from './stack';

describe('stackDots', () => {
	it('places a tap by how early or late it was, in beats, never past 0.45 of one', () => {
		const dots = stackDots(
			[
				{ pos: 2, offset: 0.3 },
				{ pos: 3, offset: -0.05 }
			],
			0.5
		);
		expect(dots.map((d) => [d.pos, d.dx])).toEqual([
			[2, 0.45],
			[3, -0.1]
		]);
	});

	it('stacks taps on one circle downward, ten rows, then from the top again', () => {
		const dots = stackDots(
			Array.from({ length: 12 }, (_, i) => ({ pos: 5, offset: i / 1000 })),
			0.5
		);
		expect(dots.map((d) => d.row)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1]);
		expect(stackDepth(dots)).toBe(10);
	});

	it('colours by closeness and leaves misses out', () => {
		const dots = stackDots(
			[
				{ pos: 2, offset: 0.03 },
				{ pos: 2, offset: 0.1 },
				{ pos: 3, offset: null }
			],
			0.5
		);
		expect(dots.map((d) => d.state)).toEqual(['spot', 'close']);
		expect(stackDepth([])).toBe(1);
	});
});
