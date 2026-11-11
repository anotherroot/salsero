/**
 * How a tap-along round went. PURE and client-safe; every time is an argument
 * (song seconds), never a clock read here.
 *
 * The expected taps come from the song's own count (the grid a person set),
 * so a tap is judged against the music the person heard. Spec:
 * docs/superpowers/specs/2026-11-10-hearing-drills-design.md, "How a tap is judged".
 */
import { nearestBeat } from '$lib/beatgrid/beatgrid';
import { isQuiet, type QuietRange } from '$lib/scheduler/quiet';
import { timeAt, timeline, type Timeline } from '$lib/scheduler/scheduler';
import type { Placed } from '$lib/songs/sections';

export interface Grid {
	beats: number[];
	counts: number[];
}

export interface Expected {
	at: number;
	eight: number;
	pos: number;
}

/** Within this, a tap is spot on. */
export const SPOT_ON_S = 0.06;
/** The farthest a tap may sit from its beat and still count. */
export const WIN_S = 0.15;

/** How far from a target a tap still counts: 150 ms, or under half a beat when beats are short. */
export function windowS(beatS: number): number {
	return Math.min(WIN_S, 0.45 * beatS);
}

/** Every position of the target in every eight whose time falls in [from, to), outside the quiet parts. */
export function expectedTaps(
	grid: Grid,
	positions: number[],
	from: number,
	to: number,
	quiet: readonly QuietRange[]
): Expected[] {
	const tl = timeline(grid);
	const out: Expected[] = [];
	for (let e = 0; e < tl.starts.length; e++) {
		for (const pos of positions) {
			const at = timeAt(tl, e, pos);
			if (at === null || at < from || at >= to || isQuiet(quiet, at)) continue;
			out.push({ at, eight: e, pos });
		}
	}
	return out.sort((a, b) => a.at - b.at);
}

export type Mark = 'spot' | 'close' | 'missed';

export interface Match {
	expected: Expected;
	tap: number | null;
	/** Seconds, + = late. */
	offset: number | null;
	mark: Mark;
}

/** A tap that answered no expected tap: the count of the beat nearest it. */
export interface Extra {
	at: number;
	eight: number;
	count: number;
	offset: number;
}

/** The beat length around a time: the gap to the next beat (or the one before at the end). */
function beatLengthAt(beats: number[], i: number): number {
	if (i + 1 < beats.length) return beats[i + 1] - beats[i];
	if (i > 0) return beats[i] - beats[i - 1];
	return 0.5;
}

export function matchTaps(
	grid: Grid,
	expected: Expected[],
	taps: number[]
): { matches: Match[]; extras: Extra[] } {
	const tl = timeline(grid);
	const sorted = [...taps].sort((a, b) => a - b);
	const used = new Array<boolean>(sorted.length).fill(false);
	const matches: Match[] = [];
	let low = 0;
	for (const ex of expected) {
		const w = windowS(beatLengthAt(grid.beats, nearestBeat(grid.beats, ex.at)));
		while (low < sorted.length && sorted[low] < ex.at - w) low++;
		let best = -1;
		for (let j = low; j < sorted.length && sorted[j] <= ex.at + w; j++) {
			if (used[j]) continue;
			if (best < 0 || Math.abs(sorted[j] - ex.at) < Math.abs(sorted[best] - ex.at)) best = j;
		}
		if (best < 0) {
			matches.push({ expected: ex, tap: null, offset: null, mark: 'missed' });
			continue;
		}
		used[best] = true;
		const offset = sorted[best] - ex.at;
		matches.push({
			expected: ex,
			tap: sorted[best],
			offset,
			mark: Math.abs(offset) <= SPOT_ON_S + 1e-9 ? 'spot' : 'close'
		});
	}
	const extras: Extra[] = [];
	sorted.forEach((tap, j) => {
		if (used[j]) return;
		const i = nearestBeat(grid.beats, tap);
		if (i < 0) return;
		extras.push({
			at: tap,
			eight: tl.eights[i],
			count: grid.counts[i],
			offset: tap - grid.beats[i]
		});
	});
	return { matches, extras };
}

export interface EightRow {
	eight: number;
	matches: Match[];
	extras: Extra[];
	/** Every tap of this eight sat on this other count (the 5 for the 1), or null. */
	otherCount: number | null;
}

export type Verdict = 'on' | 'late' | 'early' | 'other' | 'missed';

export interface SectionLine {
	/** The section's name as stored ('' unnamed, or no sections). */
	name: string;
	from: number;
	verdict: Verdict;
	meanMs: number | null;
	otherCount: number | null;
}

export interface TapAlongResult {
	hit: number;
	of: number;
	meanMs: number | null;
	rows: EightRow[];
	sections: SectionLine[];
}

const isHit = (m: Match) => m.mark !== 'missed';

function meanMs(matches: Match[]): number | null {
	const hits = matches.filter(isHit);
	if (hits.length === 0) return null;
	return Math.round((hits.reduce((s, m) => s + (m.offset ?? 0), 0) / hits.length) * 1000);
}

function mostCommon(xs: number[]): { value: number; n: number } | null {
	const tally = new Map<number, number>();
	for (const x of xs) tally.set(x, (tally.get(x) ?? 0) + 1);
	let best: { value: number; n: number } | null = null;
	for (const [value, n] of tally) if (!best || n > best.n) best = { value, n };
	return best;
}

function otherCountOf(row: Omit<EightRow, 'otherCount'>, positions: number[]): number | null {
	if (row.matches.some(isHit)) return null;
	const top = mostCommon(row.extras.map((x) => x.count).filter((c) => !positions.includes(c)));
	if (!top) return null;
	return top.n >= Math.max(1, Math.ceil(row.matches.length / 2)) ? top.value : null;
}

/** On time when the hits average within this. */
const ON_TIME_MS = 60;

function lineOf(name: string, from: number, rows: EightRow[]): SectionLine {
	const others = rows.map((r) => r.otherCount).filter((c): c is number => c !== null);
	if (others.length * 2 > rows.length) {
		return { name, from, verdict: 'other', meanMs: null, otherCount: mostCommon(others)!.value };
	}
	const mean = meanMs(rows.flatMap((r) => r.matches));
	const verdict: Verdict =
		mean === null ? 'missed' : Math.abs(mean) <= ON_TIME_MS ? 'on' : mean > 0 ? 'late' : 'early';
	return { name, from, verdict, meanMs: mean, otherCount: null };
}

function sectionLines(tl: Timeline, rows: EightRow[], sections: Placed[]): SectionLine[] {
	const placed = [...sections].sort((a, b) => a.beat - b.beat);
	// Rows come in time order, so a section's rows are a run: a new owner starts a new group.
	const groups: { owner: Placed | null; rows: EightRow[] }[] = [];
	for (const row of rows) {
		const first = tl.starts[row.eight];
		const owner = placed.findLast((s) => s.beat <= first) ?? null;
		const last = groups.at(-1);
		if (last && last.owner === owner) last.rows.push(row);
		else groups.push({ owner, rows: [row] });
	}
	return groups.map((g) => lineOf(g.owner?.name ?? '', g.owner?.t ?? 0, g.rows));
}

export function judgeTapAlong(input: {
	grid: Grid;
	positions: number[];
	from: number;
	to: number;
	quiet: readonly QuietRange[];
	sections: Placed[];
	taps: number[];
}): TapAlongResult {
	const tl = timeline(input.grid);
	const expected = expectedTaps(input.grid, input.positions, input.from, input.to, input.quiet);
	const { matches, extras } = matchTaps(input.grid, expected, input.taps);
	const byEight = new Map<number, Omit<EightRow, 'otherCount'>>();
	for (const m of matches) {
		const row = byEight.get(m.expected.eight) ?? {
			eight: m.expected.eight,
			matches: [],
			extras: []
		};
		row.matches.push(m);
		byEight.set(row.eight, row);
	}
	for (const x of extras) byEight.get(x.eight)?.extras.push(x);
	const rows: EightRow[] = [...byEight.values()]
		.sort((a, b) => a.eight - b.eight)
		.map((r) => ({ ...r, otherCount: otherCountOf(r, input.positions) }));
	return {
		hit: matches.filter(isHit).length,
		of: matches.length,
		meanMs: meanMs(matches),
		rows,
		sections: sectionLines(tl, rows, input.sections)
	};
}
