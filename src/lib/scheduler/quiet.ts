/**
 * PURE: the parts of a song the player keeps quiet — a section with its count
 * off (the song page's Count off) plays with no count and no clave, from its
 * 1 to the next section's 1. Song seconds, as the scheduler's cues are.
 */
import { placeSections, type Section } from '$lib/songs/sections';

export interface QuietRange {
	from: number;
	/** The next section's 1, or Infinity for a quiet last section. */
	to: number;
}

export function quietRanges(sections: Section[], beats: number[], counts: number[]): QuietRange[] {
	const placed = placeSections(sections, beats, counts);
	return placed.flatMap((s, k) =>
		s.countOff ? [{ from: s.t, to: placed[k + 1]?.t ?? Infinity }] : []
	);
}

export function isQuiet(ranges: readonly QuietRange[], t: number): boolean {
	return ranges.some((r) => t >= r.from && t < r.to);
}
