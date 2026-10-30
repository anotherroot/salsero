/**
 * A song sample is a 15-second excerpt of a song, played from where its
 * count begins a phrase (a 1), with a one-second fade at each end. The
 * server computes where it starts (`songChoices`); the client only plays it.
 * PURE and client-safe.
 */

export const SAMPLE_LENGTH_S = 15;
export const SAMPLE_FADE_S = 1;

export function sampleStart(input: {
	durationS: number | null;
	beats: number[];
	counts: number[];
	customS: number | null;
}): number {
	const { durationS, beats, counts, customS } = input;
	const customOk =
		customS !== null &&
		Number.isFinite(customS) &&
		customS >= 0 &&
		(durationS === null || customS < durationS);
	const target = customOk ? customS : durationS !== null ? durationS / 3 : 0;
	for (let i = Math.min(beats.length, counts.length) - 1; i >= 0; i--) {
		if (beats[i] <= target && counts[i] === 1) return beats[i];
	}
	return target;
}

/** 0→1 over the first fade, 1 in the middle, 1→0 over the last fade. */
export function sampleGain(elapsedS: number, lengthS: number): number {
	const fadeIn = elapsedS / SAMPLE_FADE_S;
	const fadeOut = (lengthS - elapsedS) / SAMPLE_FADE_S;
	return Math.min(1, Math.max(0, Math.min(fadeIn, fadeOut)));
}
