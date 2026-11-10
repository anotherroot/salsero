/**
 * PURE: the parts of a song the player keeps quiet: a section with its count
 * off (the song page's Count off), from its 1 to the next section's 1, and the
 * song before its first section when that one is counted (a lead: it counts in
 * on the coming tempo instead, `$lib/songs/count-in`). Song seconds, as the
 * scheduler's cues are.
 */
import { leadRanges, leadsOf } from '$lib/songs/count-in';
import { placeSections, type Placed, type Section } from '$lib/songs/sections';

export interface QuietRange {
	from: number;
	/** The next section's 1, or Infinity for a quiet last section. */
	to: number;
}

/** The quiet ranges of sections already placed on the grid. */
export function quietOf(placed: Placed[], beats: number[]): QuietRange[] {
	const off = placed.flatMap((s, k) =>
		s.countOff ? [{ from: s.t, to: placed[k + 1]?.t ?? Infinity }] : []
	);
	// A lead after a count-off section is that section's own range.
	const leads = leadRanges(leadsOf(placed, beats)).filter(
		(l) => !off.some((r) => r.from === l.from && r.to === l.to)
	);
	return [...leads, ...off].sort((a, b) => a.from - b.from);
}

export function quietRanges(sections: Section[], beats: number[], counts: number[]): QuietRange[] {
	return quietOf(placeSections(sections, beats, counts), beats);
}

export function isQuiet(ranges: readonly QuietRange[], t: number): boolean {
	return ranges.some((r) => t >= r.from && t < r.to);
}
