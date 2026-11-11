/**
 * Dropped in: the song starts at a random beat with no count, and the person
 * finds the target and taps it for two eights. PURE and client-safe; `rand`
 * and every time are arguments. Spec:
 * docs/superpowers/specs/2026-11-10-hearing-drills-design.md, "How a tap is
 * judged" and "Phase 1b".
 */
import { nearestBeat } from '$lib/beatgrid/beatgrid';
import { isQuiet, type QuietRange } from '$lib/scheduler/quiet';
import { timeline } from '$lib/scheduler/scheduler';
import { matchTaps, type Expected, type Grid } from './judge';

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

/**
 * How far, in counts, the person's count sits from the music's: the first tap
 * fills the pattern's first circle (`firstPos`), and it landed on `musicCount`.
 */
export function shiftOf(musicCount: number, firstPos: number): number {
	return (((musicCount - Math.floor(firstPos)) % 8) + 8) % 8;
}

/**
 * What a drop keeps when the count was off (spec 1c.3): 4 off happens (the two
 * halves of an eight sound alike), 2 off is worse, odd and even swapped worst.
 */
export function countKeep(shift: number): number {
	const s = ((shift % 8) + 8) % 8;
	if (s === 0) return 1;
	if (s === 4) return 0.5;
	if (s % 2 === 0) return 0.25;
	return 0.1;
}

/**
 * The two eights a drop judges, in the person's count: `startIndex` is the beat
 * the person counted as 1, `shift` how far that is from the music's 1, `from`
 * the first tap's beat, `end` the last expected beat, `eight` the music's eight
 * of the first expected beat (the rows are drawn from there).
 */
export interface DropWindow {
	eight: number;
	from: number;
	end: number;
	startIndex: number;
	shift: number;
}

interface Planned {
	index: number;
	at: number;
	pos: number;
	yours: number;
	k: number;
}

/** The expected beats of two person-eights from `startIndex`; beats past the song are left out. */
function planned(grid: Grid, positions: number[], startIndex: number): Planned[] {
	const out: Planned[] = [];
	const sorted = [...positions].sort((a, b) => a - b);
	for (let k = 0; k < PATTERN_EIGHTS; k++) {
		for (const p of sorted) {
			const whole = Math.floor(p);
			const frac = p - whole;
			const index = startIndex + 8 * k + whole - 1;
			if (index < 0 || index >= grid.beats.length) continue;
			if (frac && index + 1 >= grid.beats.length) continue;
			const at = frac
				? grid.beats[index] + (grid.beats[index + 1] - grid.beats[index]) * frac
				: grid.beats[index];
			out.push({ index, at, pos: grid.counts[index] + frac, yours: p, k });
		}
	}
	return out;
}

/** The drop's window from its first tap: the beat nearest it is the pattern's first position. */
export function dropWindow(grid: Grid, first: number, positions: number[]): DropWindow {
	const tl = timeline(grid);
	const i = Math.max(0, nearestBeat(grid.beats, first));
	const firstPos = Math.min(...positions);
	const startIndex = i - (Math.floor(firstPos) - 1);
	const plan = planned(grid, positions, startIndex);
	const eight = plan.length
		? Math.max(0, tl.eights[plan[0].index] ?? 0)
		: Math.max(0, tl.eights[i] ?? 0);
	return {
		eight,
		from: grid.beats[i],
		end: plan.length ? Math.max(...plan.map((x) => x.at)) : grid.beats[i],
		startIndex,
		shift: shiftOf(grid.counts[i], firstPos)
	};
}

export type BeatState = 'spot' | 'close' | 'miss' | 'skip';

/**
 * One target beat of a drop, as judged. `row`: the music's eight from the
 * window's first (0–2); `pos`: where it sits in the music's count (drawn);
 * `yours`: the count the person meant it as.
 */
export interface DropBeat {
	row: 0 | 1 | 2;
	pos: number;
	yours: number;
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
	/** How many counts the person's count was off (0 without a tap). */
	shift: number;
}

/**
 * A drop, judged in the person's count (spec 1c.3): two eights of the target from
 * the first tap, the first tap being the pattern's first position; each expected
 * beat takes the nearest tap within the window, as in a tap-along round, so one
 * forgotten tap misses one circle. No tap: all of them missed.
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
			taps: [],
			shift: 0
		};
	}
	const tl = timeline(grid);
	const near = nearestBeat(grid.beats, first);
	const win = dropWindow(grid, first, positions);
	const plan = planned(grid, positions, win.startIndex);
	const beats: DropBeat[] = plan.map((x) => ({
		row: Math.min(2, Math.max(0, (tl.eights[x.index] ?? win.eight) - win.eight)) as 0 | 1 | 2,
		pos: x.pos,
		yours: x.yours,
		at: x.at,
		state: 'miss',
		offset: null
	}));
	const counted: Expected[] = plan.map((x) => ({ at: x.at, eight: x.k, pos: x.yours }));
	const { matches } = matchTaps(grid, counted, sorted);
	for (const m of matches) {
		const b = beats.find((x) => x.at === m.expected.at && x.yours === m.expected.pos);
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
		taps: sorted,
		shift: win.shift
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
