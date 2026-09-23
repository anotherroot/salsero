import { describe, expect, it } from 'vitest';
import type { CountTakeRow } from '$lib/types';
import { chooseTakes } from './attach';

/**
 * `attach.ts` is the impure half and is otherwise judged by ear, but this one
 * decision is pure arithmetic and decides whether the user's own voice is used
 * at all — a wrong answer is silent, either falling back when it need not or
 * pitching a take far enough to stop sounding like them.
 */
const take = (bpm: number, phrase: 'a' | 'b'): CountTakeRow => ({
	id: bpm * 10 + (phrase === 'a' ? 1 : 2),
	pattern: 'salsa',
	bpm,
	phrase,
	file: `${bpm}${phrase}.wav`,
	preRollS: 0.1,
	lengthS: (3 * 60) / bpm
});

const ladder = [120, 130, 140, 152, 164, 177, 191].flatMap((b) => [take(b, 'a'), take(b, 'b')]);

describe('chooseTakes', () => {
	it('returns both halves of the nearest tempo', () => {
		const set = chooseTakes(ladder, 141);
		expect(set?.a?.bpm).toBe(140);
		expect(set?.b?.bpm).toBe(140);
	});

	/**
	 * Tempo is multiplicative, so the tie between two rungs falls at their
	 * GEOMETRIC mean, not the arithmetic one: √(130 × 140) = 134.90, while the
	 * arithmetic midpoint is 135. Between those two numbers the answers differ,
	 * and log space is the one that matches what the stretch actually costs.
	 */
	it('measures distance in log space, not linear', () => {
		expect(chooseTakes(ladder, 134.95)?.a?.bpm).toBe(140); // linear would say 130
		expect(chooseTakes(ladder, 134.8)?.a?.bpm).toBe(130);
	});

	it('falls back when every take is more than 12 % away', () => {
		expect(chooseTakes(ladder, 250)).toBeNull();
		expect(chooseTakes(ladder, 60)).toBeNull();
		// 191 × 1.12 ≈ 214: just inside, and just outside.
		expect(chooseTakes(ladder, 210)?.a?.bpm).toBe(191);
		expect(chooseTakes(ladder, 220)).toBeNull();
	});

	it('accepts a tempo with only one half recorded', () => {
		const set = chooseTakes([take(140, 'a')], 140);
		expect(set?.a?.bpm).toBe(140);
		expect(set?.b).toBeUndefined();
	});

	it('falls back when nothing is recorded', () => {
		expect(chooseTakes([], 140)).toBeNull();
	});

	/** A grid with no beats yields a BPM of 0; that must not pick a take. */
	it('falls back on a nonsense tempo rather than dividing by it', () => {
		expect(chooseTakes(ladder, 0)).toBeNull();
		expect(chooseTakes(ladder, NaN)).toBeNull();
	});
});
