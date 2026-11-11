import { describe, expect, it } from 'vitest';
import type { Placed } from '$lib/songs/sections';
import { roundSpan, songParts, tapRow } from './round';

const placed = (name: string, t: number, countOff = false): Placed => ({
	name,
	at: t,
	t,
	countOff,
	index: 0,
	beat: t * 2
});

describe('songParts', () => {
	it('lists the counted sections, each up to the next one', () => {
		expect(songParts([placed('Intro', 0, true), placed('Verse', 9), placed('Coro', 33)])).toEqual([
			{ name: 'Verse', from: 9, to: 33 },
			{ name: 'Coro', from: 33, to: Infinity }
		]);
	});
});

describe('roundSpan', () => {
	it('plays a part from one eight before it, and judges from its 1', () => {
		expect(roundSpan({ name: 'Coro', from: 33, to: 50 }, 2, 0.5)).toEqual({
			play: 29,
			judgeFrom: 33,
			to: 50
		});
	});

	it('gives the whole song one eight to listen before the first judged 1', () => {
		expect(roundSpan(null, 2, 0.5)).toEqual({ play: 2, judgeFrom: 6, to: Infinity });
	});

	it('never plays before the music starts', () => {
		expect(roundSpan({ name: 'Verse', from: 4, to: 20 }, 2, 0.5)).toEqual({
			play: 2,
			judgeFrom: 6,
			to: 20
		});
	});
});

describe('tapRow', () => {
	it('fills in order with the next circle marked', () => {
		expect(tapRow([1, 3, 5, 7], 2, false)).toEqual({
			1: 'filled',
			3: 'filled',
			5: 'next',
			7: 'future'
		});
	});

	it('shows a just-finished row full before it empties', () => {
		expect(tapRow([1], 1, true)).toEqual({ 1: 'filled' });
		expect(tapRow([1, 5], 4, true)).toEqual({ 1: 'filled', 5: 'filled' });
		expect(tapRow([1, 5], 4, false)).toEqual({ 1: 'next', 5: 'future' });
	});
});
