import { describe, expect, it } from 'vitest';
import type { Placed } from '$lib/songs/sections';
import type { DropAnswer } from './drops';
import { revealOf, roundSpan, songParts } from './round';

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
		hits: 0,
		of: 1,
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

describe('revealOf a drop nobody tapped', () => {
	it('says there was no tap', () => {
		const none: DropAnswer = {
			start: 0,
			tap: null,
			hit: false,
			offset: null,
			count: null,
			listened: null,
			hits: 0,
			of: 1
		};
		expect(revealOf(none, [1])).toEqual({ kind: 'none' });
	});
});

describe('revealOf a pattern drop', () => {
	it('says how many of its beats were hit', () => {
		const a: DropAnswer = {
			start: 0,
			tap: 1,
			hit: false,
			offset: 0,
			count: 1,
			listened: 1,
			hits: 4,
			of: 5
		};
		expect(revealOf(a, [2, 3, 5, 6.5, 8])).toEqual({ kind: 'pattern', hits: 4, of: 5 });
	});
});
