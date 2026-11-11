/**
 * The pieces of a round the page needs that are not judging. PURE and client-safe.
 */
import type { Placed } from '$lib/songs/sections';

export type RoundKind = 'tapAlong' | 'dropped';

/** A counted part of the song a tap-along round can be played on. */
export interface Part {
	name: string;
	from: number;
	to: number;
}

/** The song's counted sections, each up to the next section (count-offs are left out: nothing to tap there). */
export function songParts(placed: Placed[]): Part[] {
	const sorted = [...placed].sort((a, b) => a.t - b.t);
	return sorted.flatMap((s, i) =>
		s.countOff ? [] : [{ name: s.name, from: s.t, to: sorted[i + 1]?.t ?? Infinity }]
	);
}

/** Eights of music a round plays before the first beat it judges: nobody can tap a 1 they have not heard coming. */
const LEAD_IN_EIGHTS = 1;

/**
 * Where a tap-along round plays from, where its judging starts, and where it
 * ends. A part plays from an eight before its 1 (never before the music
 * starts); the judged stretch starts no sooner than an eight into what plays.
 */
export function roundSpan(
	part: Part | null,
	musicStart: number,
	beatS: number
): { play: number; judgeFrom: number; to: number } {
	const lead = LEAD_IN_EIGHTS * 8 * beatS;
	const from = part ? part.from : musicStart;
	const play = Math.max(musicStart, from - lead);
	return { play, judgeFrom: Math.max(from, play + lead), to: part ? part.to : Infinity };
}

/**
 * A target circle on screen. While tapping only future, next and filled are
 * used: how close a tap was shows only when the drop ends (spot, close, miss,
 * and skip for the first eight's beats before the first tap).
 */
export type CircleState = 'future' | 'next' | 'filled' | 'skip' | 'spot' | 'close' | 'miss';

/** A drop (or, in a tap-along round, a part of the song) as the result shows it. */
export interface FinishedDrop {
	answer: import('./drops').DropAnswer;
	restarts: number;
	skipped: boolean;
	/** Eights listened before the first tap of the last attempt. */
	listenEights: number;
	/** The song's section the drop was in ('' when the song has none). */
	section: string;
}

/**
 * A tap-along round's one row: filled in order, the next circle marked. A row
 * just finished (`full`) shows full for a moment before it empties.
 */
export function tapRow(
	positions: number[],
	fill: number,
	full: boolean
): Record<number, CircleState> {
	const n = positions.length;
	const k = full && fill > 0 && fill % n === 0 ? n : fill % n;
	return Object.fromEntries(
		positions.map((p, i): [number, CircleState] => [
			p,
			i < k ? 'filled' : i === k ? 'next' : 'future'
		])
	);
}
