/**
 * Dropped in: the song starts at a random beat with no count, and the person
 * finds the target and taps it for two eights. PURE and client-safe; `rand`
 * and every time are arguments. Spec:
 * docs/superpowers/specs/2026-11-10-hearing-drills-design.md, "How a tap is
 * judged" and "Phase 1b".
 */
import { nearestBeat } from '$lib/beatgrid/beatgrid';
import { isQuiet, type QuietRange } from '$lib/scheduler/quiet';
import { timeAt, timeline } from '$lib/scheduler/scheduler';
import { matchTaps, windowS, type Expected, type Grid } from './judge';

/** Drops in a round. */
export const DROPS = 10;
/** Beats of song a drop needs after its start: four eights to listen, two to tap, one spare. */
export const ROOM_BEATS = 56;
/** Beats between two drops: 2 eights, so no two drops land in the same spot. */
const GAP_BEATS = 16;
/** Eights a drop is tapped for: the first tap's eight and the next. */
export const PATTERN_EIGHTS = 2;

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

const beatLength = (grid: Grid, i: number) =>
	i >= 0 && i + 1 < grid.beats.length ? grid.beats[i + 1] - grid.beats[i] : 0.5;

/** The two eights a drop judges: `eight` (the music's eight index), its 1, and the 1 two eights on. */
export interface DropWindow {
	eight: number;
	from: number;
	end: number;
}

/**
 * The eight the first tap falls in, and the next. A tap up to the tap window
 * before a 1 belongs to that 1's eight: it was meant for it.
 */
export function dropWindow(grid: Grid, first: number): DropWindow {
	const tl = timeline(grid);
	const near = nearestBeat(grid.beats, first);
	const i = nearestBeat(grid.beats, first + windowS(beatLength(grid, near)));
	const eight = Math.max(0, tl.eights[i] ?? 0);
	const from = grid.beats[tl.starts[eight]] ?? grid.beats[0];
	const next = tl.starts[eight + PATTERN_EIGHTS];
	const last = grid.beats.length - 1;
	const end = next !== undefined ? grid.beats[next] : grid.beats[last] + beatLength(grid, last - 1);
	return { eight, from, end };
}

export type BeatState = 'spot' | 'close' | 'miss' | 'skip';

/** One target beat of a drop, as judged: `row` 0 is the first tap's eight. */
export interface DropBeat {
	row: 0 | 1;
	pos: number;
	at: number;
	state: BeatState;
	offset: number | null;
}

export interface DropAnswer {
	start: number;
	/** The first tap, or null. */
	tap: number | null;
	/** Every counted beat hit. */
	hit: boolean;
	/** The hits' average, seconds, + = late. */
	offset: number | null;
	/** The count of the beat nearest the first tap. */
	count: number | null;
	/** Seconds from the drop's start to the first tap. */
	listened: number | null;
	hits: number;
	/** Counted beats: the two eights' target beats, less those before the first tap. */
	of: number;
	spot: number;
	close: number;
	beats: DropBeat[];
	eight: number | null;
	taps: number[];
}

/**
 * A drop, judged: every target beat of the first tap's eight (from the first
 * tap on) and of the next eight, matched with the taps as in a tap-along
 * round. No tap: all of them missed.
 */
export function judgeDropPattern(
	grid: Grid,
	positions: number[],
	start: number,
	taps: number[]
): DropAnswer {
	const sorted = [...taps].sort((a, b) => a - b);
	const first = sorted[0];
	if (first === undefined) {
		return {
			start,
			tap: null,
			hit: false,
			offset: null,
			count: null,
			listened: null,
			hits: 0,
			of: PATTERN_EIGHTS * positions.length,
			spot: 0,
			close: 0,
			beats: [],
			eight: null,
			taps: []
		};
	}
	const tl = timeline(grid);
	const near = nearestBeat(grid.beats, first);
	const w = windowS(beatLength(grid, near));
	const win = dropWindow(grid, first);
	const beats: DropBeat[] = [];
	const counted: Expected[] = [];
	for (let row = 0; row < PATTERN_EIGHTS; row++) {
		for (const pos of positions) {
			const at = timeAt(tl, win.eight + row, pos);
			if (at === null) continue;
			const skip = row === 0 && at < first - w;
			beats.push({ row: row as 0 | 1, pos, at, state: skip ? 'skip' : 'miss', offset: null });
			if (!skip) counted.push({ at, eight: win.eight + row, pos });
		}
	}
	const { matches } = matchTaps(grid, counted, sorted);
	for (const m of matches) {
		const b = beats.find((x) => x.at === m.expected.at && x.pos === m.expected.pos);
		if (!b || m.mark === 'missed') continue;
		b.state = m.mark;
		b.offset = m.offset;
	}
	const hitBeats = beats.filter((b) => b.state === 'spot' || b.state === 'close');
	const hits = hitBeats.length;
	return {
		start,
		tap: first,
		hit: hits > 0 && hits === counted.length,
		offset: hits ? hitBeats.reduce((s, b) => s + (b.offset ?? 0), 0) / hits : null,
		count: near < 0 ? null : grid.counts[near],
		listened: first - start,
		hits,
		of: counted.length,
		spot: beats.filter((b) => b.state === 'spot').length,
		close: beats.filter((b) => b.state === 'close').length,
		beats,
		eight: win.eight,
		taps: sorted
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
	const m = mean(drops.flatMap((d) => (d.hits > 0 && d.offset !== null ? [d.offset] : [])));
	return {
		hit: drops.reduce((s, d) => s + d.hits, 0),
		of: drops.reduce((s, d) => s + d.of, 0),
		meanMs: m === null ? null : Math.round(m * 1000),
		meanListened: mean(drops.flatMap((d) => (d.listened === null ? [] : [d.listened]))),
		drops
	};
}
