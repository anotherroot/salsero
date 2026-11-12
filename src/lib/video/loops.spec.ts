import { describe, expect, it } from 'vitest';
import { loopName, parseLoopName } from './loops';

describe('loop names', () => {
	it('name a section and its still', () => {
		expect(loopName({ id: 12, startMs: 1000, endMs: 7000 })).toBe('12-1000-7000.jpg');
		expect(loopName({ id: 12, startMs: 1000, endMs: 7000 }, true)).toBe('12-1000-7000-still.jpg');
	});

	it('parse back, and refuse what is not one', () => {
		expect(parseLoopName('12-1000-7000.jpg')).toEqual({
			id: 12,
			startMs: 1000,
			endMs: 7000,
			still: false
		});
		expect(parseLoopName('12-1000-7000-still.jpg')).toMatchObject({ still: true });
		for (const bad of ['../12-0-1.jpg', '12-1000-1000.jpg', '12-0-1.png', '12-0.jpg', 'x-0-1.jpg'])
			expect(parseLoopName(bad)).toBeNull();
	});
});
