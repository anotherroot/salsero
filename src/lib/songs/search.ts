/**
 * PURE: searching and grouping the song popup's list (the shared picker marks
 * the matches). Client-safe.
 */
import { fold } from '$lib/fold';

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

/** Songs whose title or artist holds the query, accents and case aside; A to Z. */
export function searchSongs<S extends { title: string; artist: string | null }>(
	songs: S[],
	query: string
): S[] {
	const q = fold(query.trim());
	const hits = q
		? songs.filter((s) => fold(s.title).includes(q) || fold(s.artist ?? '').includes(q))
		: songs.slice();
	return hits.sort(byTitle);
}

/** The recent songs by rank, then everything else A to Z. */
export function groupSongs<S extends { title: string; recentRank: number | null }>(
	songs: S[]
): { recent: S[]; rest: S[] } {
	const recent = songs
		.filter((s) => s.recentRank !== null)
		.sort((a, b) => (a.recentRank as number) - (b.recentRank as number));
	const rest = songs.filter((s) => s.recentRank === null).sort(byTitle);
	return { recent, rest };
}
/** The song popup's count line: `8 songs`, or `1 match` while searching. */
export function pickerCount(n: number, searching: boolean): string {
	const word = searching ? 'match' : 'song';
	return n === 1 ? `1 ${word}` : `${n} ${word}${searching ? 'es' : 's'}`;
}
