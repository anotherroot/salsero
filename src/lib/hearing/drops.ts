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

/** A spot of a round over several songs: which song (an index into the round's), and where. */
export interface MixedStart {
	song: number;
	at: number;
}

/**
 * Up to `count` spots over several songs (a hearing drill's, phase 2): each
 * spot's song at random among those with a spot left, its spots as
 * `dropStarts` picks them (far apart within the song). A song with no room
 * gives none; no song with room, no spots.
 */
export function mixStarts(
	songs: readonly { grid: Grid; quiet: readonly QuietRange[]; from: number }[],
	opts: { count: number; rand: () => number }
): MixedStart[] {
	const left = songs.map((s) =>
		dropStarts(s.grid, s.quiet, { count: opts.count, from: s.from, rand: opts.rand })
	);
	const out: MixedStart[] = [];
	while (out.length < opts.count) {
		const open = left.flatMap((starts, song) => (starts.length ? [song] : []));
		if (open.length === 0) break;
		const song = open[Math.min(open.length - 1, Math.floor(opts.rand() * open.length))];
		out.push({ song, at: left[song].shift()! });
	}
	return out;
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

/** Beats a drop runs over from its first tap: two eights. */
const DROP_BEATS = PATTERN_EIGHTS * 8;

/**
 * The expected beats of the sixteen from the first tap's beat `first`, read in
 * the person's count: each beat's count in the song's own grid, moved by `shift`,
 * so a re-anchored count (a short bar, a new 1) is followed as the music has
 * it. Beats past the song are left out.
 */
function planned(grid: Grid, positions: number[], first: number, shift: number): Planned[] {
	const out: Planned[] = [];
	const end = Math.min(grid.beats.length, first + DROP_BEATS);
	for (let j = Math.max(0, first); j < end; j++) {
		const yours = ((((grid.counts[j] - 1 - shift) % 8) + 8) % 8) + 1;
		for (const p of positions) {
			if (Math.floor(p) !== yours) continue;
			const frac = p - Math.floor(p);
			if (frac && j + 1 >= grid.beats.length) continue;
			const at = frac ? grid.beats[j] + (grid.beats[j + 1] - grid.beats[j]) * frac : grid.beats[j];
			out.push({ index: j, at, pos: grid.counts[j] + frac, yours: p, k: j - first < 8 ? 0 : 1 });
		}
	}
	return out.sort((a, b) => a.at - b.at);
}

/**
 * The drop's window from its first tap, taking the first tap as the pattern's
 * first position (the setup asks to start there; `judgeDropPattern` then tries
 * the others). It ends at the last of its sixteen beats.
 */
export function dropWindow(grid: Grid, first: number, positions: number[]): DropWindow {
	const tl = timeline(grid);
	const i = Math.max(0, nearestBeat(grid.beats, first));
	const firstPos = Math.min(...positions);
	const last = Math.min(grid.beats.length - 1, i + DROP_BEATS - 1);
	return {
		eight: Math.max(0, tl.eights[i] ?? 0),
		from: grid.beats[i],
		end: grid.beats[last],
		startIndex: i - (Math.floor(firstPos) - 1),
		shift: shiftOf(grid.counts[i], firstPos)
	};
}

export type BeatState = 'spot' | 'close' | 'miss' | 'skip';

/**
 * One target beat of a drop, as judged. `row`: the music's eight from the
 * window's first (0, 1, 2, more after a short bar); `pos`: where it sits in the music's count (drawn);
 * `yours`: the count the person meant it as.
 */
export interface DropBeat {
	row: number;
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
	const i0 = Math.max(0, nearestBeat(grid.beats, first));
	// The first tap as each of the pattern's positions, the first circle first so it wins a tie:
	// a clave tapped the other way round from its 1 still reads as 4 off, while every beat from
	// the 5 (any start fits) stays counted from the first circle.
	const firstPos = Math.min(...positions);
	const shifts = [...new Set([firstPos, ...positions].map((p) => shiftOf(grid.counts[i0], p)))];
	let beats: DropBeat[] = [];
	let shift = win.shift;
	let best = -1;
	for (const s of shifts) {
		const plan = planned(grid, positions, i0, s);
		const trial: DropBeat[] = plan.map((x) => ({
			row: Math.max(0, (tl.eights[x.index] ?? win.eight) - win.eight),
			pos: x.pos,
			yours: x.yours,
			at: x.at,
			state: 'miss',
			offset: null
		}));
		const counted: Expected[] = plan.map((x) => ({ at: x.at, eight: x.k, pos: x.yours }));
		const { matches } = matchTaps(grid, counted, sorted);
		for (const m of matches) {
			const b = trial.find((x) => x.at === m.expected.at && x.yours === m.expected.pos);
			if (!b || m.mark === 'missed') continue;
			b.state = m.mark;
			b.offset = m.offset;
		}
		const hitsHere = trial.filter((b) => b.state !== 'miss').length;
		if (hitsHere > best) {
			best = hitsHere;
			beats = trial;
			shift = s;
		}
	}
	const hitBeats = beats.filter((b) => b.state === 'spot' || b.state === 'close');
	const hits = hitBeats.length;
	return {
		start,
		tap: first,
		hit: hits > 0 && hits === beats.length,
		offset: hits ? hitBeats.reduce((s, b) => s + (b.offset ?? 0), 0) / hits : null,
		count: near < 0 ? null : grid.counts[near],
		listened: first - start,
		hits,
		of: beats.length,
		spot: beats.filter((b) => b.state === 'spot').length,
		close: beats.filter((b) => b.state === 'close').length,
		beats,
		eight: win.eight,
		taps: sorted,
		shift
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
