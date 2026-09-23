import { describe, expect, it } from 'vitest';
import { HORIZON_S, SEEK_EPSILON_S, TICK_MS } from './attach';
import { MAX_PRE_ROLL_S } from '$lib/limits';

/**
 * The player's timing constants are not independent, and getting the
 * relationships wrong fails SILENTLY — the count plays late, or nothing plays
 * at all, with no error anywhere. These are the invariants that were violated
 * in the first recorded-voice build.
 */
describe('scheduler timing invariants', () => {
	/**
	 * A recorded phrase starts one pre-roll BEFORE its beat. If the horizon only
	 * reaches the beat, that start time is already past when the phrase is
	 * discovered, and it plays up to a pre-roll late. This was 0.1 vs 0.1.
	 */
	it('looks ahead further than the longest lead a cue can need', () => {
		expect(HORIZON_S).toBeGreaterThan(MAX_PRE_ROLL_S);
	});

	/**
	 * `cursor` legitimately runs up to one horizon ahead of the song position.
	 * An epsilon below that reads every tick as a seek, clears the queue each
	 * time, and the player goes silent while still looking like it is running.
	 */
	it('treats a jump as a seek only beyond what the horizon explains', () => {
		expect(SEEK_EPSILON_S).toBeGreaterThan(HORIZON_S);
	});

	/** Several ticks per horizon, or a dropped frame leaves a hole in the count. */
	it('ticks several times within one horizon', () => {
		expect(HORIZON_S * 1000).toBeGreaterThanOrEqual(TICK_MS * 4);
	});
});
