/**
 * The pieces of a round the page needs that are not judging. PURE and client-safe.
 */
import type { Placed } from '$lib/songs/sections';
import { SPOT_ON_S } from './judge';
import type { DropAnswer } from './drops';

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

export type Reveal =
	| { kind: 'spot' }
	| { kind: 'late' | 'early'; ms: number }
	| { kind: 'other'; count: number }
	| { kind: 'missed' }
	| { kind: 'none' }
	| { kind: 'pattern'; hits: number; of: number };

/** What the stage says after a drop's tap. */
export function revealOf(a: DropAnswer, positions: number[]): Reveal {
	if (a.tap === null) return { kind: 'none' };
	if (a.of > 1) return { kind: 'pattern', hits: a.hits, of: a.of };
	if (a.hit && a.offset !== null) {
		if (Math.abs(a.offset) <= SPOT_ON_S + 1e-9) return { kind: 'spot' };
		const ms = Math.round(Math.abs(a.offset) * 1000);
		return { kind: a.offset > 0 ? 'late' : 'early', ms };
	}
	if (a.count !== null && !positions.includes(a.count)) return { kind: 'other', count: a.count };
	return { kind: 'missed' };
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
