/**
 * What My count's recording screen shows for the beat the click is on.
 * PURE and client-safe.
 */
import type { PhrasePattern } from '$lib/labels';
import { COUNT_POSITIONS } from '$lib/scheduler/scheduler';
import { t } from '$lib/i18n/catalog';

export type Dot = 'said' | 'current' | 'silent' | 'next';

/** The banner when the click ran but no whole bar was usable. */
export function nothingCaptured(): { title: string; body: string } {
	const w = t().settings.voice;
	return { title: w.nothingCaptured, body: w.checkMic };
}

const silentCounts = (pattern: PhrasePattern) =>
	[1, 2, 3, 4, 5, 6, 7, 8].filter((n) => !COUNT_POSITIONS[pattern].includes(n));

/**
 * `beat` is null before the first click; the count-in is bar -1. A silent beat
 * is `silent` even before it passes, but `current` wins on it.
 */
export function recordingView(
	pattern: PhrasePattern,
	bars: number,
	beat: { bar: number; count: number } | null
): {
	heading: string;
	say: string | null;
	line: string | null;
	dots: Dot[];
	barsDone: number;
	barFraction: number;
} {
	const w = t().settings.voice;
	const silent = silentCounts(pattern);
	const counting = beat !== null && beat.bar >= 0;
	const dots = [1, 2, 3, 4, 5, 6, 7, 8].map((n): Dot => {
		if (beat && beat.count === n) return 'current';
		if (silent.includes(n)) return 'silent';
		return counting && n < beat!.count ? 'said' : 'next';
	});
	if (!beat) {
		return { heading: w.getReady, say: null, line: null, dots, barsDone: 0, barFraction: 0 };
	}
	if (beat.bar < 0) {
		return {
			heading: w.countIn,
			say: null,
			line: w.startOnNext,
			dots,
			barsDone: 0,
			barFraction: 0
		};
	}
	const isSilent = silent.includes(beat.count);
	return {
		heading: w.barOf(beat.bar + 1, bars),
		say: isSilent ? null : String(beat.count),
		line: isSilent ? w.silentOn(beat.count) : null,
		dots,
		barsDone: beat.bar,
		barFraction: beat.count / 8
	};
}

/** The arming card's third step. */
export function silentLine(pattern: PhrasePattern): string {
	const s = silentCounts(pattern);
	const w = t().settings.voice;
	return s.length === 0 ? w.everyBeat : w.leaveSilent(s);
}

/** A recording failure as a banner's title and body. */
export function voiceError(e: unknown): { title: string; body: string } {
	const w = t().settings.voice;
	if (e instanceof Error && e.name === 'NotAllowedError')
		return { title: w.micRefused, body: w.micRefusedBody };
	return { title: w.failed, body: e instanceof Error ? e.message : w.failedLine };
}
