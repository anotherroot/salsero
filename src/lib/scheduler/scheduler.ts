/**
 * What should sound, and when, while the player runs — as pure functions.
 *
 * The scheduler answers one question: for song time in `[from, to)`, which
 * clips play at which song times, and which figures get called. It owns no
 * clock and no audio; `attach.ts` maps these song times onto the AudioContext
 * and actually makes noise. That split is what makes the hard parts — which
 * clip on which count, the count ducking under a call, the clave's off-beats,
 * no figure twice running — testable without a browser.
 *
 * All times here are SONG seconds: offsets into the music, never instants.
 */
import { beatIndexAt } from '$lib/beatgrid/beatgrid';
import type { CallEvery, ClavePattern, Clip } from '$lib/labels';

/** Which clip speaks each count. 4 and 8 are silent — the salsa pause. */
export const COUNT_CLIP: Record<number, Clip | null> = {
	1: 'uno',
	2: 'dos',
	3: 'tres',
	4: null,
	5: 'cinco',
	6: 'seis',
	7: 'siete',
	8: null
};

/**
 * Clave hits as positions in the 8-count: 1-based, fractional for an off-beat,
 * so 2.5 is the "and" of 2. The son clave spans two bars of four, which is
 * exactly one 8-count; 2-3 is 3-2 with its halves swapped.
 */
export const CLAVE_POSITIONS: Record<ClavePattern, number[]> = {
	'3-2': [1, 2.5, 4, 6, 7],
	'2-3': [2, 3, 5, 6.5, 8]
};

/** 8-counts of count-only before the first figure is called, so a run can settle. */
export const LEAD_IN_8S = 2;

export interface Timeline {
	beats: number[];
	counts: number[];
	/** The 8-count each beat belongs to. Beats before the first "1" get -1. */
	eights: number[];
	/** `starts[e]` is the beat index where 8-count `e` begins. */
	starts: number[];
}

/**
 * Index a grid for the lookups below. A new 8-count begins on every "1", which
 * is how a re-anchored count (the user tapping after a break) simply starts a
 * new 8-count rather than corrupting the ones before it.
 */
export function timeline(grid: { beats: number[]; counts: number[] }): Timeline {
	const eights = new Array<number>(grid.counts.length);
	const starts: number[] = [];
	let e = -1;
	for (let i = 0; i < grid.counts.length; i++) {
		if (grid.counts[i] === 1) starts[++e] = i;
		eights[i] = e;
	}
	return { beats: grid.beats, counts: grid.counts, eights, starts };
}

/** The beat carrying count `c` of 8-count `e`, or -1 if the bar is short there. */
function beatOfCount(t: Timeline, e: number, c: number): number {
	const s = t.starts[e];
	if (s === undefined) return -1;
	const i = s + c - 1;
	// A bar cut short by a re-anchor does not have all eight counts.
	return i < t.beats.length && t.eights[i] === e && t.counts[i] === c ? i : -1;
}

/**
 * Song time of a position in an 8-count — `timeAt(t, 3, 2.5)` is the "and" of
 * 2 in the fourth 8-count. Fractions interpolate between neighbouring beats,
 * which is right even when the tempo drifts, because the grid is real beats.
 */
export function timeAt(t: Timeline, eight: number, pos: number): number | null {
	const whole = Math.floor(pos);
	const frac = pos - whole;
	const i = beatOfCount(t, eight, whole);
	if (i < 0) return null;
	if (frac === 0) return t.beats[i];
	if (i + 1 >= t.beats.length) return null;
	return t.beats[i] + (t.beats[i + 1] - t.beats[i]) * frac;
}

export interface Cue {
	at: number;
	clip: Clip;
}

export interface Call {
	at: number;
	/** The 8-count the figure STARTS on; the call sounds in the one before. */
	eight: number;
	figureId: number;
}

export interface Toggles {
	count: boolean;
	clave: ClavePattern | null;
	callEvery: CallEvery | null;
}

/** A figure placed on an 8-count. Random drill generates these; phase 3's choreographies supply them. */
export interface PlanStep {
	eight: number;
	figureId: number;
}

/** The count a call starts on, in the 8-count before the figure. */
const CALL_POS = 5;

/**
 * Everything that should sound in `[from, to)`, sorted by time.
 *
 * A call is spoken over 5-6-7 of the preceding 8-count so the figure begins on
 * the next "1", and the spoken count gets out of its way for those three beats.
 * Suppression is decided from the whole plan, not just the window, so a count
 * near a window edge ducks the same way however the ticks happen to fall.
 */
export function cuesIn(
	t: Timeline,
	plan: PlanStep[],
	toggles: Toggles,
	from: number,
	to: number
): { cues: Cue[]; calls: Call[] } {
	const cues: Cue[] = [];
	const calls: Call[] = [];
	const talking = new Set<number>();

	if (toggles.callEvery !== null) {
		for (const step of plan) {
			const at = timeAt(t, step.eight - 1, CALL_POS);
			if (at === null) continue;
			talking.add(step.eight - 1);
			if (at >= from && at < to) calls.push({ at, eight: step.eight, figureId: step.figureId });
		}
	}

	// Start one beat BEFORE the window: a fractional clave position can fall
	// inside it while the beat it hangs off sits just outside. Binary-searching
	// the start also keeps a tick O(window) rather than O(song), which matters
	// at 40 ticks a second against a grid of thousands of beats.
	const first = Math.max(0, beatIndexAt(t.beats, from));
	const bars = new Set<number>();
	for (let i = first; i < t.beats.length; i++) {
		if (t.beats[i] >= to) break;
		bars.add(t.eights[i]);
		if (t.beats[i] < from) continue;
		const clip = toggles.count ? COUNT_CLIP[t.counts[i]] : null;
		const ducked = talking.has(t.eights[i]) && t.counts[i] >= CALL_POS && t.counts[i] <= 7;
		if (clip && !ducked) cues.push({ at: t.beats[i], clip });
	}

	if (toggles.clave) {
		for (const e of bars) {
			for (const pos of CLAVE_POSITIONS[toggles.clave]) {
				const at = timeAt(t, e, pos);
				if (at !== null && at >= from && at < to) cues.push({ at, clip: 'clave' });
			}
		}
	}

	cues.sort((a, b) => a.at - b.at);
	calls.sort((a, b) => a.at - b.at);
	return { cues, calls };
}

/**
 * A figure from the pool, never the one just called — hearing the same name
 * twice running reads as a bug, not as randomness. `r` is in `[0, 1)`.
 */
export function pickFigure(pool: number[], last: number | null, r: number): number | null {
	if (pool.length === 0) return null;
	const choices = last === null || pool.length === 1 ? pool : pool.filter((id) => id !== last);
	return choices[Math.min(choices.length - 1, Math.floor(r * choices.length))];
}

/**
 * Grow a plan so it reaches `throughEight`, deciding only the new steps —
 * a figure already announced never changes under the player's feet.
 */
export function extendPlan(
	plan: PlanStep[],
	pool: number[],
	every: CallEvery,
	throughEight: number,
	rand: () => number
): PlanStep[] {
	const out = [...plan];
	let eight = out.length === 0 ? LEAD_IN_8S : out[out.length - 1].eight + every;
	while (eight <= throughEight) {
		const last = out.length === 0 ? null : out[out.length - 1].figureId;
		const figureId = pickFigure(pool, last, rand());
		if (figureId === null) break;
		out.push({ eight, figureId });
		eight += every;
	}
	return out;
}

/** A plain metronome grid for count-only practice: `bars` 8-counts at `bpm`. */
export function syntheticGrid(bpm: number, bars: number): { beats: number[]; counts: number[] } {
	const step = 60 / bpm;
	const n = bars * 8;
	return {
		beats: Array.from({ length: n }, (_, i) => i * step),
		counts: Array.from({ length: n }, (_, i) => (i % 8) + 1)
	};
}
