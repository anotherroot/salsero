import { describe, expect, it } from 'vitest';
import { pickOf } from './pick';

describe('pickOf', () => {
	const on = [1, 3] as const;

	it('picks the position `?pick=` names when it is on the map', () => {
		expect(pickOf(new URLSearchParams('pick=3'), on)).toBe(3);
	});

	it('picks nothing for a position the map does not draw', () => {
		expect(pickOf(new URLSearchParams('pick=9'), on)).toBeNull();
	});

	it('picks nothing for a pick that is not an id', () => {
		expect(pickOf(new URLSearchParams('pick=abc'), on)).toBeNull();
		expect(pickOf(new URLSearchParams('pick=3.0'), on)).toBeNull();
		expect(pickOf(new URLSearchParams('pick='), on)).toBeNull();
	});

	it('picks nothing without one', () => {
		expect(pickOf(new URLSearchParams(''), on)).toBeNull();
		expect(pickOf(new URLSearchParams('q=3'), on)).toBeNull();
	});
});
