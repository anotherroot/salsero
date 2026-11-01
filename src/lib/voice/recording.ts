/**
 * What My count's recording screen shows for the beat the click is on.
 * PURE and client-safe.
 */
import type { PhrasePattern } from '$lib/labels';
import { COUNT_POSITIONS } from '$lib/scheduler/scheduler';

export type Dot = 'said' | 'current' | 'silent' | 'next';

export const NOTHING_CAPTURED = {
	title: 'Nothing usable was captured',
	body: 'Check the microphone permission.'
};

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
	const silent = silentCounts(pattern);
	const counting = beat !== null && beat.bar >= 0;
	const dots = [1, 2, 3, 4, 5, 6, 7, 8].map((n): Dot => {
		if (beat && beat.count === n) return 'current';
		if (silent.includes(n)) return 'silent';
		return counting && n < beat!.count ? 'said' : 'next';
	});
	if (!beat) {
		return { heading: 'Get ready', say: null, line: null, dots, barsDone: 0, barFraction: 0 };
	}
	if (beat.bar < 0) {
		return {
			heading: 'Count-in',
			say: null,
			line: 'Start counting on the next 1',
			dots,
			barsDone: 0,
			barFraction: 0
		};
	}
	const isSilent = silent.includes(beat.count);
	return {
		heading: `Bar ${beat.bar + 1} of ${bars}`,
		say: isSilent ? null : String(beat.count),
		line: isSilent ? `Silent on ${beat.count}` : null,
		dots,
		barsDone: beat.bar,
		barFraction: beat.count / 8
	};
}

/** The arming card's third step. */
export function silentLine(pattern: PhrasePattern): string {
	const s = silentCounts(pattern);
	return s.length === 0
		? 'Count evenly, every beat.'
		: `Count evenly and leave beats ${s.join(' and ')} silent.`;
}

/** A recording failure as a banner's title and body. */
export function voiceError(e: unknown): { title: string; body: string } {
	if (e instanceof Error && e.name === 'NotAllowedError')
		return {
			title: 'The microphone was refused',
			body: 'Allow it for this app in the phone’s settings, then try again.'
		};
	return { title: 'Recording failed', body: e instanceof Error ? e.message : 'Recording failed.' };
}
