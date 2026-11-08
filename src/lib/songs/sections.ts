/**
 * PURE, client-safe: a song's sections. Stored as raw seconds
 * (`songs.sections_json`), snapped to a 1 of the current count on read, so a
 * change of the count moves them without rewriting them (spec 2026-11-08,
 * "Sections: data and rules").
 */

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
