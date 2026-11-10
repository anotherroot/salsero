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
	| { kind: 'missed' };

/** What the stage says after a drop's tap. */
export function revealOf(a: DropAnswer, positions: number[]): Reveal {
	if (a.hit && a.offset !== null) {
		if (Math.abs(a.offset) <= SPOT_ON_S + 1e-9) return { kind: 'spot' };
		const ms = Math.round(Math.abs(a.offset) * 1000);
		return { kind: a.offset > 0 ? 'late' : 'early', ms };
	}
	if (a.count !== null && !positions.includes(a.count)) return { kind: 'other', count: a.count };
	return { kind: 'missed' };
}
