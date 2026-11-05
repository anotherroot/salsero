import { describe, expect, it } from 'vitest';
import { FEELS, RATING_OF, feelOf } from './feel';

describe('feelOf', () => {
	it('round-trips the four faces', () => {
		expect(FEELS).toEqual(['hard', 'getting', 'gotit', 'easy']);
		for (const f of FEELS) expect(feelOf(RATING_OF[f])).toBe(f);
	});
	it('reads old stars', () => {
		expect(feelOf(3)).toBe('gotit');
		expect(feelOf(null)).toBeNull();
	});
});
