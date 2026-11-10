import { describe, expect, it } from 'vitest';
import type { Placed } from '$lib/songs/sections';
import type { DropAnswer } from './drops';
import { revealOf, songParts } from './round';

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

describe('revealOf', () => {
	const answer = (a: Partial<DropAnswer>): DropAnswer => ({
		start: 0,
		tap: 1,
		hit: false,
		offset: null,
		count: null,
		listened: 1,
		...a
	});

	it('says spot on, late or early for a found drop', () => {
		expect(revealOf(answer({ hit: true, offset: 0.03, count: 1 }), [1])).toEqual({ kind: 'spot' });
		expect(revealOf(answer({ hit: true, offset: 0.1, count: 1 }), [1])).toEqual({
			kind: 'late',
			ms: 100
		});
		expect(revealOf(answer({ hit: true, offset: -0.09, count: 1 }), [1])).toEqual({
			kind: 'early',
			ms: 90
		});
	});

	it('names the count a wrong tap was on', () => {
		expect(revealOf(answer({ offset: 2, count: 5 }), [1])).toEqual({ kind: 'other', count: 5 });
	});

	it('says missed when the tap sat on a target count but too far off', () => {
		expect(revealOf(answer({ offset: 0.24, count: 1 }), [1])).toEqual({ kind: 'missed' });
	});
});
