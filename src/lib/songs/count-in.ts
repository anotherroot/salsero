/**
 * PURE, client-safe: the count-in before a song's main beat (2026-11-10).
 *
 * A lead is the part before a counted section that is not counted itself: the
 * song before its first section, or a section with the count off. Its own
 * beats are often loose (a rubato intro), so it is not counted on them. It is
 * quiet, with a dash, and counts down to the section's 1 in the tempo of the
 * section's first eight. Its last four beats are 5 6 7 8, drawn as "not there
 * yet" and spoken, as a teacher counts a class in.
 */
import { median } from '$lib/beatgrid/beatgrid';
import type { Ahead, Placed } from './sections';
import type { QuietRange } from '$lib/scheduler/quiet';

/** The counts of the count-in, on the four beats before the 1. */
export const COUNT_IN = [5, 6, 7, 8] as const;

export interface Lead {
	/** Where the lead starts: the song's start, or the count-off section's 1. */
	from: number;
	/** The section's 1 it leads to. */
	one: number;
	/** One beat of that section, in song seconds: the median step of its first eight. */
	step: number;
	next: Placed;
}

/** The steady step from beat `b` on: the median of its first eight steps, else of the whole grid. */
function stepFrom(beats: number[], b: number): number {
	const steps = (from: number, to: number) => {
		const out: number[] = [];
		for (let i = Math.max(1, from); i < Math.min(beats.length, to); i++)
			out.push(beats[i] - beats[i - 1]);
		return out;
	};
	const near = steps(b + 1, b + 9);
	return median(near.length > 0 ? near : steps(1, beats.length));
}

/** Every lead in the song, in time order. */
export function leadsOf(placed: Placed[], beats: number[]): Lead[] {
	const out: Lead[] = [];
	placed.forEach((next, k) => {
		if (next.countOff) return;
		const before = placed[k - 1];
		if (before && !before.countOff) return;
		const from = before ? before.t : 0;
		const step = stepFrom(beats, next.beat);
		if (!(next.t > from) || !(step > 0)) return;
		out.push({ from, one: next.t, step, next });
	});
	return out;
}

export interface CountIn {
	lead: Lead;
	/** Beats left to the 1 at the coming tempo, this one included (1 on the 8). */
	beatsLeft: number;
	/** The coming tempo's 1s still ahead, the section's own included. */
	eightsLeft: number;
	/** The count-in's count on this beat (5–8), or null before it. */
	n: number | null;
	/**
	 * This beat as a beat index on the song's grid, counting back from the
	 * section's 1: the 8 is the 1's index less one, so the 1 follows it as the
	 * next beat (the count's push needs that).
	 */
	index: number;
}

/** Where `t` is in a lead, or null outside every lead. */
export function countInAt(leads: readonly Lead[], t: number): CountIn | null {
	const lead = leads.find((l) => t >= l.from && t < l.one);
	if (!lead) return null;
	// The beat t is in: [one - k·step, one - (k-1)·step) is the k-th beat back.
	const beatsLeft = Math.max(1, Math.ceil((lead.one - t) / lead.step - 1e-9));
	return {
		lead,
		beatsLeft,
		eightsLeft: Math.ceil(beatsLeft / 8),
		n: beatsLeft <= COUNT_IN.length ? 9 - beatsLeft : null,
		index: lead.next.beat - beatsLeft
	};
}

/** What comes next in a lead: the section, counted down in its own tempo; "on the 1" in the count-in. */
export function leadAhead(leads: readonly Lead[], t: number): Ahead | null {
	const c = countInAt(leads, t);
	if (!c) return null;
	return {
		next: c.lead.next,
		beatsLeft: c.beatsLeft,
		eightsLeft: c.eightsLeft,
		mode: c.n === null ? 'eights' : 'one'
	};
}

export interface CountInCue {
	/** Song seconds. */
	at: number;
	/** 5–8. */
	n: number;
}

/** The voice of every count-in: 5 6 7 8 at the coming tempo, those inside the lead. */
export function countInCues(leads: readonly Lead[]): CountInCue[] {
	return leads.flatMap((l) =>
		COUNT_IN.map((n) => ({ at: l.one - (9 - n) * l.step, n })).filter((c) => c.at >= l.from)
	);
}

/** The cues in `[from, to)`, as the scheduler's window asks. */
export function countInCuesIn(cues: readonly CountInCue[], from: number, to: number): CountInCue[] {
	return cues.filter((c) => c.at >= from && c.at < to);
}

/** The leads as quiet ranges: the song's own count and clave rest there. */
export function leadRanges(leads: readonly Lead[]): QuietRange[] {
	return leads.map((l) => ({ from: l.from, to: l.one }));
}

/** The count-in's sizes: each count larger than the last, the 1 full (the user's pick, B2). */
export const COUNT_IN_SCALE: Record<number, number> = { 5: 0.5, 6: 0.62, 7: 0.74, 8: 0.86 };

/** How many beats before the 5 the dash starts to push and shrink. */
export const DASH_BEATS = 8;

/**
 * How a lead's digit looks on its beat: `scale`, its size; `push`, how hard it
 * pushes, as a share of a count's push (0: still). The dash pushes harder and
 * shrinks a step on each of the last eight beats before the 5, down to near
 * the 5's size, getting it ready; then 5 6 7 8 grow, each pushing a little
 * harder than a count. Null outside a lead: a count's own look.
 */
export function leadLook(c: CountIn | null): { scale: number; push: number } | null {
	if (!c) return null;
	if (c.n !== null) return { scale: COUNT_IN_SCALE[c.n], push: 1.3 };
	const step = COUNT_IN.length + DASH_BEATS + 1 - c.beatsLeft;
	if (step < 1) return { scale: 1, push: 0 };
	const p = step / DASH_BEATS;
	return { scale: 1 - 0.45 * p, push: 1.2 * p };
}
