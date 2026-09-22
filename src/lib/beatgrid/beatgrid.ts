/**
 * Beat times → the dance count, as pure functions.
 *
 * Measured on real salsa and son (spec, "Beat grid"): Beat This!'s BEATS are
 * reliable, its DOWNBEATS are not, and one constant-tempo line drifts at
 * breaks. So the grid is the detected beats themselves (gaps filled), and the
 * count comes from anchors — beat indices the user tapped as "1" — with the
 * model's downbeats only as a starting suggestion.
 */
import type { TempoFactor } from '$lib/labels';

/** How late a human tap lands after the beat it means. Subtracted before snapping. */
export const TAP_LATENCY_S = 0.08;

const mod = (a: number, n: number) => ((a % n) + n) % n;

export function median(xs: number[]): number {
	if (xs.length === 0) return NaN;
	const s = [...xs].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const intervals = (beats: number[]) => beats.slice(1).map((t, i) => t - beats[i]);

/**
 * Sort, drop beats closer than half an interval to the previous one, and fill
 * gaps (breaks, stops) with evenly spaced beats so the count runs straight
 * through them instead of losing its place.
 */
export function cleanBeats(beats: number[]): number[] {
	const sorted = [...beats].sort((a, b) => a - b);
	if (sorted.length < 3) return sorted;
	const med = median(intervals(sorted));
	const out = [sorted[0]];
	for (const t of sorted.slice(1)) {
		const prev = out[out.length - 1];
		const gap = t - prev;
		if (gap < med * 0.5) continue;
		const n = Math.round(gap / med);
		for (let k = 1; k < n; k++) out.push(prev + (gap * k) / n);
		out.push(t);
	}
	return out;
}

/** ×2 inserts a midpoint between neighbours; ×½ keeps every other beat. */
export function scaleBeats(beats: number[], factor: TempoFactor): number[] {
	if (factor === 1) return [...beats];
	if (factor === 0.5) return beats.filter((_, i) => i % 2 === 0);
	const out: number[] = [];
	beats.forEach((t, i) => {
		out.push(t);
		if (i + 1 < beats.length) out.push((t + beats[i + 1]) / 2);
	});
	return out;
}

export function bpmOf(beats: number[]): number | null {
	if (beats.length < 2) return null;
	return 60 / median(intervals(beats));
}

/** Last beat at or before `t`, or -1 before the first. Binary search. */
export function beatIndexAt(beats: number[], t: number): number {
	let lo = 0;
	let hi = beats.length - 1;
	let ans = -1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		if (beats[mid] <= t) {
			ans = mid;
			lo = mid + 1;
		} else hi = mid - 1;
	}
	return ans;
}

export function nearestBeat(beats: number[], t: number): number {
	if (beats.length === 0) return -1;
	const i = beatIndexAt(beats, t);
	if (i < 0) return 0;
	if (i + 1 < beats.length && beats[i + 1] - t < t - beats[i]) return i + 1;
	return i;
}

/**
 * Which beat index (0–3) the model's downbeats most often land on. Only a
 * suggestion: on salsa the votes are close, and 1 vs 5 cannot be told apart.
 */
export function suggestOne(beats: number[], downbeats: number[]): number | null {
	if (beats.length < 2 || downbeats.length === 0) return null;
	const tol = median(intervals(beats)) * 0.25;
	const votes = [0, 0, 0, 0];
	for (const d of downbeats) {
		const i = nearestBeat(beats, d);
		if (Math.abs(beats[i] - d) <= tol) votes[i % 4]++;
	}
	const best = votes.indexOf(Math.max(...votes));
	return votes[best] > 0 ? best : null;
}

/**
 * The count (1–8) of every beat. Each anchor is a "1" and holds until the next
 * anchor; before the first anchor the count runs backwards from it.
 */
export function countsFor(n: number, anchors: number[], fallback: number): number[] {
	const a = anchors.filter((x) => x >= 0 && x < n).sort((x, y) => x - y);
	const out: number[] = new Array(n);
	let k = 0;
	for (let i = 0; i < n; i++) {
		while (k + 1 < a.length && a[k + 1] <= i) k++;
		const anchor = a.length > 0 ? a[k] : fallback;
		out[i] = mod(i - anchor, 8) + 1;
	}
	return out;
}

/** Add a tapped "1". An anchor that agrees with the one before it adds nothing and is dropped. */
export function addAnchor(anchors: number[], i: number): number[] {
	const sorted = [...new Set([...anchors, i])].sort((x, y) => x - y);
	const out: number[] = [];
	for (const a of sorted) {
		const prev = out[out.length - 1];
		if (prev === undefined || mod(a - prev, 8) !== 0) out.push(a);
	}
	return out;
}

export function removeAnchor(anchors: number[], i: number): number[] {
	return anchors.filter((a) => a !== i);
}

export interface Grid {
	beats: number[];
	counts: number[];
	bpm: number | null;
	/** True while the count is the model's guess rather than the user's taps. */
	suggested: boolean;
}

export function buildGrid(input: {
	beats: number[];
	downbeats: number[];
	anchors: number[];
	tempoFactor: TempoFactor;
}): Grid {
	const beats = scaleBeats(input.beats, input.tempoFactor);
	const suggested = input.anchors.length === 0;
	const fallback = suggested ? (suggestOne(beats, input.downbeats) ?? 0) : 0;
	return {
		beats,
		counts: countsFor(beats.length, input.anchors, fallback),
		bpm: bpmOf(beats),
		suggested
	};
}
