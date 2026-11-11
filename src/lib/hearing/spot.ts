/**
 * One spot of a Dropped in round: when it starts over, when it ends, and when
 * it can be skipped. PURE: every time is song time, passed in. Spec:
 * docs/superpowers/specs/2026-11-10-hearing-drills-design.md, "Phase 1b", 3.
 */
import type { DropWindow } from './drops';

/** No first tap in this many eights: the spot starts over. */
export const LISTEN_EIGHTS = 4;
/** Skip shows once a spot has started over this many times. */
export const SKIP_AFTER = 3;

/** The longest wait between two target beats, in beats, round the eight (the 1: 8). */
export function longestGapBeats(positions: number[]): number {
	const s = [...positions].sort((a, b) => a - b);
	if (s.length === 0) return 8;
	let gap = s[0] + 8 - s[s.length - 1];
	for (let i = 1; i < s.length; i++) gap = Math.max(gap, s[i] - s[i - 1]);
	return gap;
}

export type SpotPhase = 'listening' | 'tapping' | 'over';

export interface Spot {
	/** Where the spot's music starts (song time); a start-over goes back here. */
	start: number;
	/** Where this attempt started: listening is measured from here. */
	attemptStart: number;
	restarts: number;
	first: number | null;
	lastTap: number | null;
	taps: number[];
	/** Circles filled: one per tap, in order, up to the circles there are. */
	fill: number;
	window: DropWindow | null;
	phase: SpotPhase;
	skipped: boolean;
}

export function newSpot(start: number): Spot {
	return {
		start,
		attemptStart: start,
		restarts: 0,
		first: null,
		lastTap: null,
		taps: [],
		fill: 0,
		window: null,
		phase: 'listening',
		skipped: false
	};
}

/** A tap at song time `at`. `window` is the drop's (`dropWindow`) when this is the first tap. */
export function tapSpot(s: Spot, at: number, window: DropWindow | null, circles: number): Spot {
	if (s.phase === 'over') return s;
	const first = s.first === null;
	return {
		...s,
		first: first ? at : s.first,
		window: first ? window : s.window,
		lastTap: at,
		taps: [...s.taps, at],
		fill: Math.min(s.fill + 1, circles),
		phase: 'tapping'
	};
}

export type SpotStep = 'keep' | 'restart' | 'end';

/**
 * What happens at song time `now`. `gapS`: the longest gap between two target
 * beats in seconds; the person has stopped once a whole eight and a beat more
 * than that pass without a tap (the beat: a first tap just before a 1 opens
 * that 1's eight, so the drop may end a moment after the gap).
 */
export function stepSpot(
	s: Spot,
	now: number,
	rules: { eightS: number; gapS: number; winS: number; beatS: number }
): SpotStep {
	if (s.phase === 'listening') {
		return now - s.attemptStart > LISTEN_EIGHTS * rules.eightS ? 'restart' : 'keep';
	}
	if (s.phase === 'tapping' && s.window && s.lastTap !== null) {
		if (now > s.window.end + rules.winS) return 'end';
		if (now < s.window.end && now - s.lastTap > rules.eightS + rules.gapS + rules.beatS)
			return 'restart';
	}
	return 'keep';
}

/** From the start again: the music back at `start`, nothing tapped, one more restart. */
export function restartSpot(s: Spot): Spot {
	if (s.phase === 'over') return s;
	return { ...newSpot(s.start), restarts: s.restarts + 1 };
}

export function skipSpot(s: Spot): Spot {
	return { ...s, phase: 'over', skipped: true };
}

export function endSpot(s: Spot): Spot {
	return { ...s, phase: 'over' };
}

export const canSkip = (s: Spot): boolean => s.restarts >= SKIP_AFTER && s.phase !== 'over';
