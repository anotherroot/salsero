import { describe, expect, it } from 'vitest';
import { phraseCandidates, phraseSlice, type SliceSpec } from './slice';

/** 120 BPM at 48 kHz: 24 000 samples a beat, 192 000 a bar. */
const BEAT = 24000;
const BAR = BEAT * 8;

const spec = (over: Partial<SliceSpec> = {}): SliceSpec => ({
	beatSamples: BEAT,
	barStart: BAR, // one count-in bar ahead of the capture
	offsetBeats: 0,
	spanBeats: 3,
	preRollSamples: 4800, // 100 ms
	tailSamples: BEAT, // the silent 4
	totalSamples: BAR * 5,
	...over
});

describe('phraseSlice', () => {
	it('starts a pre-roll before the phrase and runs to the end of its tail', () => {
		const s = phraseSlice(spec());
		expect(s).toEqual({
			start: BAR - 4800,
			preRoll: 4800,
			length: BEAT * 3,
			duration: 4800 + BEAT * 3 + BEAT
		});
	});

	it('offsets son by a beat, since its phrase starts on the 2', () => {
		const s = phraseSlice(spec({ offsetBeats: 1 }));
		expect(s?.start).toBe(BAR + BEAT - 4800);
		expect(s?.length).toBe(BEAT * 3);
	});

	it('spans four beats when every count is spoken', () => {
		expect(phraseSlice(spec({ spanBeats: 4 }))?.length).toBe(BEAT * 4);
	});

	/**
	 * A phrase missing its pre-roll or its last beat is worse than no take: it
	 * would drop a consonant or a whole word and read as a scheduling bug.
	 */
	it('refuses a phrase whose pre-roll falls before the capture', () => {
		expect(phraseSlice(spec({ barStart: 0 }))).toBeNull();
	});

	it('refuses a phrase whose tail runs past the capture', () => {
		expect(phraseSlice(spec({ totalSamples: BAR + BEAT * 3 }))).toBeNull();
	});

	it('accepts a phrase that ends exactly on the last captured sample', () => {
		const exact = BAR + BEAT * 3 + BEAT;
		expect(phraseSlice(spec({ totalSamples: exact }))).not.toBeNull();
		expect(phraseSlice(spec({ totalSamples: exact - 1 }))).toBeNull();
	});
});

describe('phraseCandidates', () => {
	it('gives one candidate per counted bar', () => {
		const c = phraseCandidates(spec({ totalSamples: BAR * 6 }), BAR, 4);
		expect(c).toHaveLength(4);
		expect(c.map((s) => s.start)).toEqual([
			BAR - 4800,
			BAR * 2 - 4800,
			BAR * 3 - 4800,
			BAR * 4 - 4800
		]);
	});

	it('drops the bars the capture does not fully hold', () => {
		// Four bars asked for, but the capture stops partway through the third.
		expect(phraseCandidates(spec({ totalSamples: BAR * 3 }), BAR, 4)).toHaveLength(2);
	});

	it('takes the first counted bar from the caller, not from sample 0', () => {
		const c = phraseCandidates(spec({ totalSamples: BAR * 6 }), BAR * 2, 1);
		expect(c[0].start).toBe(BAR * 2 - 4800);
	});
});
