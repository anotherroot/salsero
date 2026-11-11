/**
 * Dropped in: the song starts at a random beat with no count, and the person
 * taps the next target beat. PURE and client-safe; `rand` and every time are
 * arguments. Spec: docs/superpowers/specs/2026-11-10-hearing-drills-design.md,
 * "How a tap is judged" (Dropped in).
 */
import { nearestBeat } from '$lib/beatgrid/beatgrid';
import { isQuiet, type QuietRange } from '$lib/scheduler/quiet';
import { timeline } from '$lib/scheduler/scheduler';
import { expectedTaps, matchTaps, windowS, type Grid } from './judge';

/** Drops in a round. */
export const DROPS = 10;
/** Beats of song a drop needs after its start: 8 eights. */
const ROOM_BEATS = 64;
/** Beats between two drops: 2 eights, so no two drops land in the same spot. */
const GAP_BEATS = 16;

/** Up to `count` drop starts (beat times), in the order they will play; fewer when the song has less room. */
export function dropStarts(
	grid: Grid,
	quiet: readonly QuietRange[],
	opts: { count: number; from: number; rand: () => number }
): number[] {
	const tl = timeline(grid);
	const n = grid.beats.length;
	const eligible: number[] = [];
	for (let i = 0; i + ROOM_BEATS < n; i++) {
		const at = grid.beats[i];
		if (at >= opts.from && tl.eights[i] >= 0 && !isQuiet(quiet, at)) eligible.push(i);
	}
	for (let i = eligible.length - 1; i > 0; i--) {
		const j = Math.floor(opts.rand() * (i + 1));
		[eligible[i], eligible[j]] = [eligible[j], eligible[i]];
	}
	const picked: number[] = [];
	for (const i of eligible) {
		if (picked.length >= opts.count) break;
		if (picked.every((p) => Math.abs(p - i) >= GAP_BEATS)) picked.push(i);
	}
	return picked.map((i) => grid.beats[i]);
}

export interface DropAnswer {
	start: number;
	tap: number | null;
	hit: boolean;
	/** Seconds from the nearest target beat, + = late. */
	offset: number | null;
	/** The count of the beat nearest the tap. */
	count: number | null;
	/** Seconds from the drop's start to the tap. */
	listened: number | null;
	/** Target beats hit, of those the drop judged: 1 of 1 for a one-beat target, up to two eights of a pattern. */
	hits: number;
	of: number;
}

export function judgeDrop(
	grid: Grid,
	positions: number[],
	start: number,
	tap: number | null
): DropAnswer {
	if (tap === null) {
		return { start, tap, hit: false, offset: null, count: null, listened: null, hits: 0, of: 1 };
	}
	const i = nearestBeat(grid.beats, tap);
	const count = i < 0 ? null : grid.counts[i];
	const near = expectedTaps(grid, positions, start, tap + 2, []);
	let offset: number | null = null;
	for (const e of near) {
		if (offset === null || Math.abs(tap - e.at) < Math.abs(offset)) offset = tap - e.at;
	}
	const beat = i >= 0 && i + 1 < grid.beats.length ? grid.beats[i + 1] - grid.beats[i] : 0.5;
	const hit = offset !== null && Math.abs(offset) <= windowS(beat) + 1e-9;
	return { start, tap, hit, offset, count, listened: tap - start, hits: hit ? 1 : 0, of: 1 };
}

/** Eights a pattern drop is tapped for, from the first tap. */
export const PATTERN_EIGHTS = 2;

/**
 * A drop for a target of several beats (the clave, 1 3 5 7, your own counts):
 * one tap cannot answer it, so the drop runs two eights from the first tap and
 * every target beat in them is judged, as in a tap-along round. No tap: all of
 * them missed.
 */
export function judgeDropPattern(
	grid: Grid,
	positions: number[],
	start: number,
	taps: number[]
): DropAnswer {
	const sorted = [...taps].sort((a, b) => a - b);
	const first = sorted[0];
	const of0 = PATTERN_EIGHTS * positions.length;
	if (first === undefined) {
		return {
			start,
			tap: null,
			hit: false,
			offset: null,
			count: null,
			listened: null,
			hits: 0,
			of: of0
		};
	}
	const i = nearestBeat(grid.beats, first);
	const beat = i >= 0 && i + 1 < grid.beats.length ? grid.beats[i + 1] - grid.beats[i] : 0.5;
	const expected = expectedTaps(
		grid,
		positions,
		first - windowS(beat),
		// Two eights from the first tap, not the 1 that starts a third.
		first + PATTERN_EIGHTS * 8 * beat - windowS(beat),
		[]
	);
	const { matches } = matchTaps(grid, expected, sorted);
	const hitOffsets = matches.flatMap((m) =>
		m.mark === 'missed' || m.offset === null ? [] : [m.offset]
	);
	const hits = hitOffsets.length;
	return {
		start,
		tap: first,
		hit: hits > 0 && hits === matches.length,
		offset: hits ? hitOffsets.reduce((s, x) => s + x, 0) / hits : null,
		count: i < 0 ? null : grid.counts[i],
		listened: first - start,
		hits,
		of: matches.length
	};
}

export interface DropsResult {
	hit: number;
	of: number;
	/** The found drops' average, ms, + = late. */
	meanMs: number | null;
	/** Seconds listened before tapping, over the drops that got a tap. */
	meanListened: number | null;
	drops: DropAnswer[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function judgeDrops(drops: DropAnswer[]): DropsResult {
	// Every judged beat counts: a one-beat drop is 1 of 1, a pattern drop up to two eights of beats.
	const m = mean(drops.flatMap((d) => (d.hits > 0 && d.offset !== null ? [d.offset] : [])));
	return {
		hit: drops.reduce((s, d) => s + d.hits, 0),
		of: drops.reduce((s, d) => s + d.of, 0),
		meanMs: m === null ? null : Math.round(m * 1000),
		meanListened: mean(drops.flatMap((d) => (d.listened === null ? [] : [d.listened]))),
		drops
	};
}
