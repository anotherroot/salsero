/**
 * PURE, client-safe: where the detected downbeats say the 1 moves (spec
 * 2026-11-08, "Suggestions: the rule"). Never stored and never applied by
 * itself: the count is the user's. Beat This! counts bars of 4 of the stored
 * beats, so it catches a 1 moving by a beat or two and can't tell a 1 from a 5.
 */
import { median, nearestBeat } from '$lib/beatgrid/beatgrid';
import type { TempoFactor } from '$lib/labels';
import { sectionIndexAt, type Placed } from './sections';

/** Downbeats in a row that must hold a new phase before it is a suggestion, not noise. */
export const SUGGEST_MIN_RUN = 4;

export interface Suggestion {
	/** In the scaled beats: where the 1 would go. */
	beat: number;
	t: number;
	/** In counted beats, signed: + the 1 moves later. */
	shift: number;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

interface Run {
	/** The first downbeat's stored beat. */
	j: number;
	phase: number;
	length: number;
}

/** Same-phase runs of downbeats, the noise (runs under `minRun`) dropped and neighbours of one phase merged. */
function runsOf(raw: number[], downbeats: number[], tol: number, minRun: number): Run[] {
	const runs: Run[] = [];
	let last = -1;
	for (const d of downbeats) {
		const j = nearestBeat(raw, d);
		if (j < 0 || j === last || Math.abs(raw[j] - d) > tol) continue;
		last = j;
		const phase = j % 4;
		const run = runs.at(-1);
		if (run && run.phase === phase) run.length++;
		else runs.push({ j, phase, length: 1 });
	}
	const kept: Run[] = [];
	for (const r of runs) {
		if (r.length < minRun) continue;
		const prev = kept.at(-1);
		if (prev && prev.phase === r.phase) prev.length += r.length;
		else kept.push({ ...r });
	}
	return kept;
}

export function suggestions(input: {
	raw: number[];
	downbeats: number[];
	beats: number[];
	counts: number[];
	anchors: number[];
	placed: Placed[];
	tempoFactor: TempoFactor;
	minRun?: number;
}): Suggestion[] {
	const { raw, downbeats, beats, counts, anchors, placed, tempoFactor } = input;
	const n = Math.min(beats.length, counts.length);
	if (raw.length < 4 || downbeats.length === 0 || n === 0) return [];
	const tol = median(raw.slice(1).map((t, i) => t - raw[i])) * 0.25;

	/** A scaled beat's stored beat, or null when it sits between two (a ×2 midpoint). */
	const toRaw = (i: number): number | null => {
		const k = nearestBeat(raw, beats[i]);
		return Math.abs(raw[k] - beats[i]) <= tol ? k : null;
	};
	const ones: number[] = [];
	for (let i = 0; i < n; i++) if (counts[i] === 1) ones.push(i);
	if (ones.length === 0) return [];

	/** The count's bar phase at stored beat j: from its last 1 at or before it, else its first. */
	const countPhase = (j: number): number | null => {
		let one = ones[0];
		for (const i of ones) {
			if (beats[i] > raw[j] + tol) break;
			one = i;
		}
		const k = toRaw(one);
		return k === null ? null : k % 4;
	};

	const out: Suggestion[] = [];
	for (const run of runsOf(raw, downbeats, tol, input.minRun ?? SUGGEST_MIN_RUN)) {
		const cp = countPhase(run.j);
		if (cp === null || cp === run.phase) continue;
		const i = nearestBeat(beats, raw[run.j]);
		if (i < 0 || i >= n || Math.abs(beats[i] - raw[run.j]) > tol) continue;
		if (anchors.some((a) => Math.abs(a - i) < 8)) continue;
		const s = sectionIndexAt(placed, i);
		if (s >= 0 && placed[s].countOff) continue;
		const d = mod(run.phase - cp, 4); // 1, 2 or 3 stored beats later
		const shift = (d === 3 ? -1 : d) * tempoFactor;
		if (!Number.isInteger(shift)) continue;
		out.push({ beat: i, t: beats[i], shift });
	}
	return out;
}
