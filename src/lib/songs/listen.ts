/**
 * PURE, client-safe: what the listening page's count card says (spec
 * 2026-11-08, "Listening"): the section's name, what comes next and how far,
 * and the quiet lines under it.
 */
import { clock } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { MUSIC_START_MIN_S } from './music-start';
import { aheadLine, aheadOf, sectionIndexAt, sectionName, type Placed } from './sections';

export interface ListenLines {
	/** The section playing, or null before the first (or with none). */
	name: string | null;
	/** "Mambo in 3 eights", or null with nothing ahead. */
	ahead: string | null;
	/** One per eight left, at most 8; none in a count-off section. */
	pips: number;
	/** A count-off section: a dash for the number. */
	off: boolean;
	/** Beats left in a count-off section, for its dots. */
	left: number;
	/** "The 1 is a guess …": no sections and no 1s set. */
	hint: boolean;
	/** "Starts at 0:18, where the music starts.", until the song has played. */
	startLine: string | null;
}

export function listenLines(input: {
	placed: Placed[];
	counts: number[];
	/** The beat playing; -1 before the song has played. */
	beat: number;
	/** How many 1s the person set. */
	anchors: number;
	startS: number;
	played: boolean;
}): ListenLines {
	const { placed, counts, anchors, startS, played } = input;
	// Before play the card reads as the start of the song.
	const beat = Math.max(0, input.beat);
	const now = sectionIndexAt(placed, beat);
	const ahead = aheadOf(placed, counts, beat);
	const off = now >= 0 && placed[now].countOff;
	return {
		name: now >= 0 ? sectionName(placed[now]) : null,
		ahead: ahead ? aheadLine(ahead) : null,
		pips: ahead && ahead.mode !== 'beats' ? Math.min(8, ahead.eightsLeft) : 0,
		off,
		left: off && ahead ? ahead.beatsLeft : 0,
		hint: placed.length === 0 && anchors === 0,
		startLine:
			!played && startS >= MUSIC_START_MIN_S ? t().songs.page.listen.starts(clock(startS)) : null
	};
}
