/**
 * PURE: searching and grouping the song popup's list. Client-safe.
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

/**
 * The first match of the query in the title, cut from the ORIGINAL title so
 * its accents stay. Folds per character: NFD can change a string's length, so
 * indexes into the folded whole would not line up.
 */
export function highlight(
	title: string,
	query: string
): { before: string; match: string; after: string } | null {
	const q = fold(query.trim());
	if (!q) return null;
	const chars = Array.from(title);
	let folded = '';
	const owner: number[] = []; // folded UTF-16 index -> original char index
	chars.forEach((c, i) => {
		const f = fold(c);
		for (let k = 0; k < f.length; k++) owner.push(i);
		folded += f;
	});
	const at = folded.indexOf(q);
	if (at < 0) return null;
	const from = owner[at];
	const to = owner[at + q.length - 1] + 1;
	return {
		before: chars.slice(0, from).join(''),
		match: chars.slice(from, to).join(''),
		after: chars.slice(to).join('')
	};
}
