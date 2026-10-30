/**
 * PURE: searching and grouping the song popup's list (the shared picker marks
 * the matches). Client-safe.
 */
import { fold } from '$lib/fold';
import type { PickerSong } from '$lib/types';

const byTitle = (a: PickerSong, b: PickerSong) => a.title.localeCompare(b.title);

/** Songs whose title or artist holds the query, accents and case aside; A to Z. */
export function searchSongs(songs: PickerSong[], query: string): PickerSong[] {
	const q = fold(query.trim());
	const hits = q
		? songs.filter((s) => fold(s.title).includes(q) || fold(s.artist ?? '').includes(q))
		: songs.slice();
	return hits.sort(byTitle);
}

/** The recent songs by rank, then everything else A to Z. */
export function groupSongs(songs: PickerSong[]): { recent: PickerSong[]; rest: PickerSong[] } {
	const recent = songs
		.filter((s) => s.recentRank !== null)
		.sort((a, b) => (a.recentRank as number) - (b.recentRank as number));
	const rest = songs.filter((s) => s.recentRank === null).sort(byTitle);
	return { recent, rest };
}
