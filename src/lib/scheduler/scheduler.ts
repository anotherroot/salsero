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
import type { CallEvery, ClavePattern, Clip, CountPattern } from '$lib/labels';

/** Which clip speaks each count. Every count has one; the PATTERN decides. */
export const COUNT_CLIP: Record<number, Clip> = {
	1: 'uno',
	2: 'dos',
	3: 'tres',
	4: 'cuatro',
	5: 'cinco',
	6: 'seis',
	7: 'siete',
	8: 'ocho'
};

/**
 * Which counts each pattern speaks. `salsa` steps 1-2-3 and 5-6-7 with the
 * pause on 4 and 8; `son` is the same shape one beat later, stepping 2-3-4 and
 * 6-7-8 and resting on 1 and 5. The rest thin the count out, which is what
 * makes a fast song sayable at all — see `COUNT_PATTERNS` in `$lib/labels`.
 */
export const COUNT_POSITIONS: Record<CountPattern, number[]> = {
	salsa: [1, 2, 3, 5, 6, 7],
	son: [2, 3, 4, 6, 7, 8],
	all: [1, 2, 3, 4, 5, 6, 7, 8],
	odd: [1, 3, 5, 7],
	ones: [1, 5],
	one: [1],
	off: []
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

/**
 * The counts a recorded half-bar covers. Derived from the pattern rather than
 * listed again, so a pattern can never disagree with its own phrases: `a` is
 * everything in the first half of the bar, `b` everything in the second.
 *
 * salsa → [1,2,3] and [5,6,7]; son → [2,3,4] and [6,7,8].
 */
export function phraseCounts(pattern: CountPattern, half: 'a' | 'b'): number[] {
	return COUNT_POSITIONS[pattern].filter((c) => (half === 'a' ? c <= 4 : c > 4));
}

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

/**
 * One recorded half-bar to play. `endsAt` is the song time the phrase's last
 * beat ends, which is what lets `attach.ts` work out the playback rate without
 * this module knowing anything about tempo, buffers or takes.
 */
export interface Phrase {
	at: number;
	endsAt: number;
	half: 'a' | 'b';
}

export interface Toggles {
	count: CountPattern;
	clave: ClavePattern | null;
	callEvery: CallEvery | null;
	/**
	 * True when the run has the user's recorded phrases for this pattern. The
	 * count then comes back as `phrases` rather than per-beat `cues`; the clave
	 * is unaffected either way.
	 */
	phrases?: boolean;
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
): { cues: Cue[]; phrases: Phrase[]; calls: Call[] } {
	const cues: Cue[] = [];
	const phrases: Phrase[] = [];
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
	const spoken = new Set(COUNT_POSITIONS[toggles.count]);
	const first = Math.max(0, beatIndexAt(t.beats, from));
	const bars = new Set<number>();
	for (let i = first; i < t.beats.length; i++) {
		if (t.beats[i] >= to) break;
		bars.add(t.eights[i]);
		if (t.beats[i] < from) continue;
		if (toggles.phrases) continue;
		const ducked = talking.has(t.eights[i]) && t.counts[i] >= CALL_POS && t.counts[i] <= 7;
		if (spoken.has(t.counts[i]) && !ducked) {
			cues.push({ at: t.beats[i], clip: COUNT_CLIP[t.counts[i]] });
		}
	}

	// Recorded halves replace the per-beat count. The duck becomes coarser and
	// simpler: a call takes 5-6-7, which is all of phrase B, so the whole phrase
	// is dropped rather than individual counts being suppressed inside it.
	if (toggles.phrases && spoken.size > 0) {
		for (const e of bars) {
			for (const half of ['a', 'b'] as const) {
				const counts = phraseCounts(toggles.count, half);
				if (counts.length === 0) continue;
				if (half === 'b' && talking.has(e)) continue;
				const at = timeAt(t, e, counts[0]);
				// The beat after the phrase's last count. For son's 6-7-8 and for
				// every-count's 5-6-7-8 that is 9, which is the NEXT bar's "1" — this
				// bar has no such count and `timeAt` rightly refuses it.
				const after = counts[counts.length - 1] + 1;
				const endsAt = after <= 8 ? timeAt(t, e, after) : timeAt(t, e + 1, 1);
				if (at !== null && endsAt !== null && at >= from && at < to) {
					phrases.push({ at, endsAt, half });
				}
			}
		}
		phrases.sort((a, b) => a.at - b.at);
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
	return { cues, phrases, calls };
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
 * How the drill chooses its next figure and how long that figure takes.
 *
 * An interface rather than a flag because there are two real implementations:
 * the uniform pick this player shipped with, and the position-graph walk in
 * `src/lib/graph/flow.ts`. The scheduler DECLARES this and the graph implements
 * it — `src/lib/scheduler/` must not import `src/lib/graph/`, so that the
 * module deciding what sounds and when never learns what a handhold is.
 */
export interface Flow {
	/** `last` is the figure just called, or null at the start of a run. */
	pick(pool: number[], last: number | null, r: number): number | null;
	eights(figureId: number): number;
}

/**
 * The pre-graph behaviour: any figure but the last one, every figure one
 * 8-count long. The default, so an untagged repertoire plays exactly as it did
 * before positions existed.
 */
export const UNIFORM_FLOW: Flow = {
	pick: pickFigure,
	eights: () => 1
};

/**
 * Grow a plan so it reaches `throughEight`, deciding only the new steps —
 * a figure already announced never changes under the player's feet.
 *
 * Spacing is `max(every, eights)`: calling the next figure one 8-count after a
 * figure that takes three would be undanceable, and with the uniform flow's
 * length of 1 this is the interval exactly, as before.
 */
export function extendPlan(
	plan: PlanStep[],
	pool: number[],
	every: CallEvery,
	throughEight: number,
	rand: () => number,
	flow: Flow = UNIFORM_FLOW
): PlanStep[] {
	const out = [...plan];
	let eight =
		out.length === 0
			? LEAD_IN_8S
			: out[out.length - 1].eight + Math.max(every, flow.eights(out[out.length - 1].figureId));
	while (eight <= throughEight) {
		const last = out.length === 0 ? null : out[out.length - 1].figureId;
		const figureId = flow.pick(pool, last, rand());
		if (figureId === null) break;
		out.push({ eight, figureId });
		eight += Math.max(every, flow.eights(figureId));
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
