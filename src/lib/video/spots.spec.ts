import { describe, expect, it } from 'vitest';
import {
	edgeByFrames,
	edgeFrameTime,
	frameNumber,
	frameSeek,
	loopTarget,
	moveEdge,
	msOf,
	resizeSpot,
	shiftSpot,
	sortSpots,
	spotLabel,
	spotTime,
	step
} from './spots';

describe('spotTime', () => {
	it.each([
		[0, '0:00.0'],
		[134_500, '2:14.5'],
		[59_999, '0:59.9'],
		[60_000, '1:00.0'],
		[3_725_300, '62:05.3']
	])('%i ms is %s', (ms, text) => {
		expect(spotTime(ms)).toBe(text);
	});
});

describe('spotLabel', () => {
	it('is the label when there is one', () => {
		expect(spotLabel({ startMs: 1000, endMs: null, label: 'Hand change' })).toBe('Hand change');
	});
	it('is the time of a point, and the range of a section', () => {
		expect(spotLabel({ startMs: 134_500, endMs: null, label: null })).toBe('2:14.5');
		expect(spotLabel({ startMs: 134_500, endMs: 142_000, label: null })).toBe('2:14.5–2:22.0');
	});
});

describe('msOf', () => {
	it('rounds seconds to whole milliseconds', () => {
		expect(msOf(2.0004)).toBe(2000);
		expect(msOf(2.0006)).toBe(2001);
	});
});

describe('step', () => {
	it('moves by the delta', () => {
		expect(step(10, -1, 60)).toBe(9);
		expect(step(10, 1, 60)).toBe(11);
	});
	it('clamps at the start and at the end', () => {
		expect(step(0.4, -1, 60)).toBe(0);
		expect(step(59.5, 1, 60)).toBe(60);
	});
	it('only clamps at the start while the duration is unknown', () => {
		expect(step(10, 1, NaN)).toBe(11);
		expect(step(10, 1, Infinity)).toBe(11);
	});
});

describe('sortSpots', () => {
	it('orders by start, then by id, without touching the input', () => {
		const input = [
			{ id: 3, startMs: 500 },
			{ id: 1, startMs: 900 },
			{ id: 2, startMs: 500 }
		];
		expect(sortSpots(input).map((s) => s.id)).toEqual([2, 3, 1]);
		expect(input.map((s) => s.id)).toEqual([3, 1, 2]);
	});
});

describe('loopTarget', () => {
	const loop = { startMs: 2000, endMs: 4000 };
	it('keeps playing inside the section and before it', () => {
		expect(loopTarget(3.9, loop)).toBeNull();
		expect(loopTarget(1, loop)).toBeNull();
	});
	it('goes back to the start at and past the end', () => {
		expect(loopTarget(4, loop)).toBe(2);
		expect(loopTarget(30, loop)).toBe(2);
	});
	it('does nothing without a loop, or for a point', () => {
		expect(loopTarget(30, null)).toBeNull();
		expect(loopTarget(30, { startMs: 2000, endMs: null })).toBeNull();
	});
});

describe('moveEdge', () => {
	const section = { startMs: 10_000, endMs: 20_000 };
	it('moves either edge of a section', () => {
		expect(moveEdge(section, 'start', 9_000, 60)).toEqual({ startMs: 9_000, endMs: 20_000 });
		expect(moveEdge(section, 'end', 21_000, 60)).toEqual({ startMs: 10_000, endMs: 21_000 });
	});
	it('keeps a section at least a second long', () => {
		expect(moveEdge(section, 'start', 25_000, 60)).toEqual({ startMs: 19_000, endMs: 20_000 });
		expect(moveEdge(section, 'end', 5_000, 60)).toEqual({ startMs: 10_000, endMs: 11_000 });
	});
	it('keeps both edges inside the video', () => {
		expect(moveEdge(section, 'start', -500, 60)).toEqual({ startMs: 0, endMs: 20_000 });
		expect(moveEdge(section, 'end', 61_000, 60)).toEqual({ startMs: 10_000, endMs: 60_000 });
	});
	it('only bounds the end by the start while the duration is unknown', () => {
		expect(moveEdge(section, 'end', 99_000, NaN)).toEqual({ startMs: 10_000, endMs: 99_000 });
	});
	it('moves a point, which has only a start', () => {
		const point = { startMs: 5_000, endMs: null };
		expect(moveEdge(point, 'start', 4_000, 60)).toEqual({ startMs: 4_000, endMs: null });
		expect(moveEdge(point, 'start', 70_000, 60)).toEqual({ startMs: 60_000, endMs: null });
		expect(moveEdge(point, 'end', 9_000, 60)).toBeNull();
	});
	it('is null when nothing would change, so the button can be disabled', () => {
		expect(moveEdge({ startMs: 0, endMs: 5_000 }, 'start', -1_000, 60)).toBeNull();
		expect(moveEdge({ startMs: 10_000, endMs: 11_000 }, 'end', 10_000, 60)).toBeNull();
		expect(moveEdge({ startMs: 50_000, endMs: 60_000 }, 'end', 61_000, 60)).toBeNull();
	});
});

const F = 1 / 30;

describe('frameNumber', () => {
	it('floors, and an exact boundary is that frame', () => {
		expect(frameNumber(0, F)).toBe(0);
		expect(frameNumber(1, F)).toBe(30);
		expect(frameNumber(1.0499, F)).toBe(31);
	});
});

describe('frameSeek', () => {
	it('lands in the middle of the next or previous frame', () => {
		expect(frameSeek(1, 1, F, 10)).toBeCloseTo(31.5 / 30, 6);
		expect(frameSeek(1, -1, F, 10)).toBeCloseTo(29.5 / 30, 6);
	});
	it('clamps inside the video, and to 0 only while the duration is unknown', () => {
		expect(frameSeek(0, -1, F, 10)).toBe(0);
		expect(frameSeek(9.99, 1, F, 10)).toBe(10);
		expect(frameSeek(0, -1, F, NaN)).toBe(0);
		expect(frameSeek(100, 1, F, NaN)).toBeCloseTo(3001.5 / 30, 6);
	});
});

describe('edgeByFrames', () => {
	const s = { startMs: 1000, endMs: 3000 };
	it('moves an edge one frame from its nearest frame boundary', () => {
		expect(edgeByFrames(s, 'start', 1, F, 10)).toEqual({ startMs: 1033, endMs: 3000 });
		expect(edgeByFrames(s, 'end', -1, F, 10)).toEqual({ startMs: 1000, endMs: 2967 });
	});
	it('is null at a bound', () => {
		expect(edgeByFrames({ startMs: 0, endMs: 3000 }, 'start', -1, F, 10)).toBeNull();
		expect(edgeByFrames({ startMs: 1000, endMs: 2000 }, 'end', -1, F, 10)).toBeNull();
		expect(edgeByFrames({ startMs: 1000, endMs: null }, 'end', 1, F, 10)).toBeNull();
	});
});

describe('edgeFrameTime', () => {
	it('is the first frame inside for a start and the last inside for an end', () => {
		expect(edgeFrameTime({ startMs: 1000, endMs: 3000 }, 'start', F)).toBeCloseTo(1 + F / 2, 6);
		expect(edgeFrameTime({ startMs: 1000, endMs: 3000 }, 'end', F)).toBeCloseTo(3 - F / 2, 6);
	});
});

describe('shiftSpot', () => {
	it('moves both edges and keeps the length', () => {
		expect(shiftSpot({ startMs: 1000, endMs: 3000 }, 500, 10)).toEqual({
			startMs: 1500,
			endMs: 3500
		});
	});
	it('stops at the start and end of the video', () => {
		expect(shiftSpot({ startMs: 200, endMs: 3000 }, -500, 10)).toEqual({
			startMs: 0,
			endMs: 2800
		});
		expect(shiftSpot({ startMs: 0, endMs: 3000 }, -500, 10)).toBeNull();
		expect(shiftSpot({ startMs: 8000, endMs: 10_000 }, 500, 10)).toBeNull();
	});
	it('is null for a point', () => {
		expect(shiftSpot({ startMs: 1000, endMs: null }, 500, 10)).toBeNull();
	});
});

describe('resizeSpot', () => {
	it('grows and shrinks each side', () => {
		expect(resizeSpot({ startMs: 1000, endMs: 3000 }, 250, 10)).toEqual({
			startMs: 750,
			endMs: 3250
		});
		expect(resizeSpot({ startMs: 1000, endMs: 3000 }, -250, 10)).toEqual({
			startMs: 1250,
			endMs: 2750
		});
	});
	it('clamps a grow at the video edges', () => {
		expect(resizeSpot({ startMs: 0, endMs: 1000 }, 250, 10)).toEqual({ startMs: 0, endMs: 1250 });
		expect(resizeSpot({ startMs: 0, endMs: 10_000 }, 250, 10)).toBeNull();
	});
	it('shrinks no further than MIN_SECTION_MS, centred', () => {
		expect(resizeSpot({ startMs: 1000, endMs: 2200 }, -250, 10)).toEqual({
			startMs: 1100,
			endMs: 2100
		});
		expect(resizeSpot({ startMs: 1000, endMs: 2000 }, -250, 10)).toBeNull();
	});
});
