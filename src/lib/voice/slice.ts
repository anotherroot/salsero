/**
 * Where a recorded half-bar starts and ends inside a capture, as pure maths.
 *
 * The click and the capture share one `AudioContext` clock, so the sample
 * index of every beat is KNOWN rather than detected. That is the whole reason
 * this module can be a handful of arithmetic instead of onset detection.
 *
 * All times here are SAMPLES; seconds only appear at the boundary.
 */

export interface PhraseSlice {
	/** First sample of the take, pre-roll included. */
	start: number;
	/** Samples before the phrase's first beat. */
	preRoll: number;
	/** The phrase itself: its first beat to the end of its last. */
	length: number;
	/** The whole take: pre-roll + phrase + ring-out. */
	duration: number;
}

export interface SliceSpec {
	/** Samples per beat, from the click's own tempo. */
	beatSamples: number;
	/** Sample index of this bar's count 1. */
	barStart: number;
	/** Beats from the bar's 1 to the phrase's first count — 0 for salsa a, 1 for son a. */
	offsetBeats: number;
	/** Beats the phrase spans: 3 for salsa and son, 4 for every-count. */
	spanBeats: number;
	/**
	 * Kept before the phrase's first beat. A word's perceived beat is its
	 * VOWEL, and the /s/ of "cinco" starts ~80 ms earlier; trimming at the beat
	 * would cut that consonant off and the count would sound late.
	 */
	preRollSamples: number;
	/**
	 * Kept after the phrase's last beat, so the final word rings out. Salsa and
	 * son have a silent beat here; every-count does not, and its tail simply
	 * overlaps the next phrase — which is free, since each plays on its own node.
	 */
	tailSamples: number;
	/** How many samples were actually captured. */
	totalSamples: number;
}

/**
 * The slice for one bar, or `null` if the capture does not fully contain it —
 * a phrase missing its pre-roll or its last beat is worse than no take, so a
 * partial one is never offered.
 */
export function phraseSlice(spec: SliceSpec): PhraseSlice | null {
	const first = spec.barStart + spec.offsetBeats * spec.beatSamples;
	const start = first - spec.preRollSamples;
	const length = spec.spanBeats * spec.beatSamples;
	const end = first + length + spec.tailSamples;
	if (start < 0 || end > spec.totalSamples) return null;
	return { start, preRoll: spec.preRollSamples, length, duration: end - start };
}

/**
 * Every complete slice across `bars` counted bars — the candidates the
 * recorder offers to audition. Counting several and choosing beats
 * re-recording until one comes out clean.
 *
 * `firstBarStart` is the sample of the FIRST counted bar's "1", which is not
 * sample 0: capture starts before the count-in, so the click has a bar to
 * establish the tempo before anyone is expected to speak.
 */
export function phraseCandidates(
	spec: Omit<SliceSpec, 'barStart'>,
	firstBarStart: number,
	bars: number
): PhraseSlice[] {
	const out: PhraseSlice[] = [];
	for (let bar = 0; bar < bars; bar++) {
		const slice = phraseSlice({
			...spec,
			barStart: firstBarStart + bar * 8 * spec.beatSamples
		});
		if (slice) out.push(slice);
	}
	return out;
}
