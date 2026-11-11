/**
 * What a drop's replay plays: from two beats before its first 1 to just after
 * its two eights (never past the song's end), with a cue for every counted
 * target beat (a knock) and every tap (a tick). PURE. Spec: "Phase 1b", 7.
 */
import { beatIndexAt } from '$lib/beatgrid/beatgrid';
import { timeline } from '$lib/scheduler/scheduler';
import { PATTERN_EIGHTS, type DropAnswer } from './drops';
import type { Grid } from './judge';

/** Beats played before the drop's first 1. */
const LEAD_BEATS = 2;
/** Seconds played after its two eights. */
const TAIL_S = 0.5;

export interface ReplayCue {
	at: number;
	kind: 'tap' | 'beat';
}

export interface ReplayPlan {
	from: number;
	to: number;
	cues: ReplayCue[];
}

export function replayPlan(
	grid: Grid,
	drop: Pick<DropAnswer, 'eight' | 'beats' | 'taps'>,
	songEnd: number
): ReplayPlan | null {
	if (drop.eight === null) return null;
	const tl = timeline(grid);
	const startIdx = tl.starts[drop.eight];
	if (startIdx === undefined) return null;
	const from = grid.beats[Math.max(0, startIdx - LEAD_BEATS)];
	const endIdx = tl.starts[drop.eight + PATTERN_EIGHTS];
	const end = endIdx !== undefined ? grid.beats[endIdx] : grid.beats[grid.beats.length - 1];
	const to = Math.min(end + TAIL_S, songEnd);
	const cues: ReplayCue[] = [
		...drop.beats
			.filter((b) => b.state !== 'skip')
			.map((b) => ({ at: b.at, kind: 'beat' as const })),
		...drop.taps.map((at) => ({ at, kind: 'tap' as const }))
	]
		.filter((c) => c.at >= from && c.at < to)
		.sort((a, b) => a.at - b.at);
	return { from, to, cues };
}

/** The cues with `a ≤ at < b`. */
export function cuesBetween(plan: ReplayPlan, a: number, b: number): ReplayCue[] {
	return plan.cues.filter((c) => c.at >= a && c.at < b);
}

/** The next (1) or previous (−1) beat from `t`: ‹ › in the replay. */
export function stepBeat(grid: Grid, t: number, dir: -1 | 1): number {
	const i = beatIndexAt(grid.beats, t + 1e-9);
	if (dir === 1) return grid.beats[Math.min(grid.beats.length - 1, i + 1)];
	const onBeat = i >= 0 && Math.abs(grid.beats[i] - t) < 1e-9;
	return grid.beats[Math.max(0, onBeat ? i - 1 : i)];
}
