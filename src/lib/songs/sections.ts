/**
 * PURE, client-safe: a song's sections. Stored as raw seconds
 * (`songs.sections_json`), snapped to a 1 of the current count on read, so a
 * change of the count moves them without rewriting them (spec 2026-11-08,
 * "Sections: data and rules").
 */

import { t } from '$lib/i18n/catalog';
import { MUSIC_START_MIN_S } from './music-start';

export const SECTION_NAME_MAX = 40;

export interface Section {
	/** Raw seconds: where the person put it, before snapping to a 1. */
	at: number;
	/** As picked or typed; '' is unnamed. */
	name: string;
	countOff: boolean;
}

const byTime = (a: Section, b: Section) => a.at - b.at;

function readOne(v: unknown): Section | null {
	if (typeof v !== 'object' || v === null) return null;
	const o = v as Record<string, unknown>;
	if (typeof o.at !== 'number' || !Number.isFinite(o.at) || o.at < 0) return null;
	if (typeof o.name !== 'string' || typeof o.countOff !== 'boolean') return null;
	return { at: o.at, name: o.name.trim().slice(0, SECTION_NAME_MAX), countOff: o.countOff };
}

/** The stored list, sorted by time. Anything unreadable reads as no sections; never throws. */
export function parseSections(json: string | null | undefined): Section[] {
	if (!json) return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	return parsed
		.map(readOne)
		.filter((s): s is Section => s !== null)
		.sort(byTime);
}

/** The canonical JSON of a list: sorted, with only the three fields. */
export function sectionsJson(list: Section[]): string {
	return JSON.stringify(
		[...list].sort(byTime).map(({ at, name, countOff }) => ({ at, name, countOff }))
	);
}

/** A section as drawn: on a 1 of the current count. `index` is its place in the stored list. */
export interface Placed extends Section {
	index: number;
	/** The beat index (in the scaled beats) it starts on: always a 1. */
	beat: number;
	/** That beat's time. */
	t: number;
}

/** A section's name as drawn; an unnamed one in the reader's language. */
export function sectionName(s: { name: string }): string {
	return s.name || t().songs.page.section.unnamed;
}

/**
 * Each section on the 1 nearest its time, in time order, among the 1s after
 * the previous section's: two never share a 1, and when a count change
 * crowds them the later one moves on. A section with no 1 left is not drawn.
 */
export function placeSections(list: Section[], beats: number[], counts: number[]): Placed[] {
	const ones: number[] = [];
	for (let i = 0; i < Math.min(beats.length, counts.length); i++) if (counts[i] === 1) ones.push(i);
	const out: Placed[] = [];
	let from = 0;
	list.forEach((s, index) => {
		let best = -1;
		for (let k = from; k < ones.length; k++) {
			const d = Math.abs(beats[ones[k]] - s.at);
			if (best < 0 || d < Math.abs(beats[ones[best]] - s.at)) best = k;
			else break; // the 1s are in time order: once it grows, it only grows
		}
		if (best < 0) return;
		out.push({ ...s, index, beat: ones[best], t: beats[ones[best]] });
		from = best + 1;
	});
	return out;
}

export interface Row {
	/** Beat indices [start, end). */
	start: number;
	end: number;
	/** The start's time. */
	t: number;
	/** The part before the first 1. */
	lead: boolean;
	/** Its length when under 8 beats and neither the lead nor the last row: where the 1 moved. */
	short: number | null;
	/** Index into the placed sections, on the row a section starts on. */
	section: number | null;
	/** Wholly before the music start (only when that is MUSIC_START_MIN_S or later). */
	quiet: boolean;
}

/** The grid's rows: one from beat 0, and one from every 1. */
export function gridRows(
	beats: number[],
	counts: number[],
	placed: Placed[],
	musicStartS: number
): Row[] {
	const n = Math.min(beats.length, counts.length);
	const starts: number[] = [];
	for (let i = 0; i < n; i++) if (i === 0 || counts[i] === 1) starts.push(i);
	const sectionOn = new Map(placed.map((p, k) => [p.beat, k]));
	const folds = musicStartS >= MUSIC_START_MIN_S;
	return starts.map((start, k) => {
		const end = k + 1 < starts.length ? starts[k + 1] : n;
		const lead = start === 0 && counts[0] !== 1;
		const last = k === starts.length - 1;
		const len = end - start;
		return {
			start,
			end,
			t: beats[start],
			lead,
			short: len < 8 && !lead && !last ? len : null,
			section: sectionOn.get(start) ?? null,
			quiet: folds && end < n && beats[end] <= musicStartS
		};
	});
}

/** Which placed section `beat` is in; -1 before the first (or with none). */
export function sectionIndexAt(placed: Placed[], beat: number): number {
	let at = -1;
	for (let k = 0; k < placed.length && placed[k].beat <= beat; k++) at = k;
	return at;
}

export interface Ahead {
	next: Placed;
	beatsLeft: number;
	/** The 1s in (beat, next.beat]. */
	eightsLeft: number;
	mode: 'eights' | 'last' | 'beats';
}

/**
 * What comes next from `beat`: a counted section reads in eights, its last
 * eight "after this eight"; a count-off section reads in beats.
 */
export function aheadOf(placed: Placed[], counts: number[], beat: number): Ahead | null {
	const now = sectionIndexAt(placed, beat);
	const next = placed[now + 1];
	if (!next) return null;
	let eightsLeft = 0;
	for (let i = Math.max(0, beat + 1); i <= next.beat; i++) if (counts[i] === 1) eightsLeft++;
	const beatsLeft = next.beat - beat;
	const off = now >= 0 && placed[now].countOff;
	const mode = off ? 'beats' : eightsLeft <= 1 ? 'last' : 'eights';
	return { next, beatsLeft, eightsLeft, mode };
}

/** "Mambo in 3 eights", "Mambo after this eight", "Montuno in 2 beats". */
export function aheadLine(a: Ahead): string {
	const words = t().songs.page.ahead;
	const name = sectionName(a.next);
	if (a.mode === 'beats') return words.beats(name, a.beatsLeft);
	if (a.mode === 'last') return words.last(name);
	return words.eights(name, a.eightsLeft);
}

export type SectionRefusal = 'taken' | 'ends' | 'missing';

/** A new unnamed section on `beat` (a 1), unless one already starts there. */
export function addSectionAt(
	list: Section[],
	placed: Placed[],
	beats: number[],
	beat: number
): Section[] | 'taken' {
	if (placed.some((p) => p.beat === beat)) return 'taken';
	return [...list, { at: beats[beat], name: '', countOff: false }].sort(byTime);
}

/**
 * An eight earlier or later: to the neighbouring 1 that way. Refused past the
 * song's ends, and onto or past the next section.
 */
export function moveSection(
	list: Section[],
	placed: Placed[],
	beats: number[],
	counts: number[],
	index: number,
	dir: -1 | 1
): Section[] | SectionRefusal {
	const k = placed.findIndex((p) => p.index === index);
	if (k < 0) return 'missing';
	const n = Math.min(beats.length, counts.length);
	let to = placed[k].beat + dir;
	while (to >= 0 && to < n && counts[to] !== 1) to += dir;
	if (to < 0 || to >= n) return 'ends';
	const neighbour = placed[k + dir];
	if (neighbour && (dir === 1 ? to >= neighbour.beat : to <= neighbour.beat)) return 'taken';
	return list.map((s, i) => (i === index ? { ...s, at: beats[to] } : s)).sort(byTime);
}

/** A new name (trimmed, at most 40 characters) or count setting for one section. */
export function editSection(
	list: Section[],
	index: number,
	patch: { name?: string; countOff?: boolean }
): Section[] | 'missing' {
	if (!list[index]) return 'missing';
	return list.map((s, i) =>
		i !== index
			? s
			: {
					...s,
					...(patch.name !== undefined
						? { name: patch.name.trim().slice(0, SECTION_NAME_MAX) }
						: {}),
					...(patch.countOff !== undefined ? { countOff: patch.countOff } : {})
				}
	);
}

export function removeSection(list: Section[], index: number): Section[] | 'missing' {
	if (!list[index]) return 'missing';
	return list.filter((_, i) => i !== index);
}
