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

type Groupable = { title: string; recentRank: number | null; group?: string | null };

/**
 * The recent songs by rank (the person's own and their groups' alike), then
 * the rest of the person's own A to Z, then each group's shared songs A to Z,
 * the groups by name.
 */
export function groupSongs<S extends Groupable>(
	songs: S[]
): { recent: S[]; rest: S[]; groups: { name: string; songs: S[] }[] } {
	const recent = songs
		.filter((s) => s.recentRank !== null)
		.sort((a, b) => (a.recentRank as number) - (b.recentRank as number));
	const others = songs.filter((s) => s.recentRank === null);
	const rest = others.filter((s) => !s.group).sort(byTitle);
	const byGroup = new Map<string, S[]>();
	for (const s of others) {
		if (s.group) byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s]);
	}
	const groups = [...byGroup]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, list]) => ({ name, songs: list.sort(byTitle) }));
	return { recent, rest, groups };
}

/**
 * The popup's sections, empty ones left out: Recent, the person's own songs
 * ("Your songs" beside groups, "All songs A–Z" after Recent alone, no heading
 * when they are all there is), then a heading per group.
 */
export function songSections<S extends Groupable>(
	songs: S[]
): { label: string | null; songs: S[] }[] {
	const { recent, rest, groups } = groupSongs(songs);
	const own = groups.length > 0 ? 'Your songs' : recent.length > 0 ? 'All songs A–Z' : null;
	return [
		{ label: 'Recent', songs: recent },
		{ label: own, songs: rest },
		...groups.map((g) => ({ label: g.name, songs: g.songs }))
	].filter((x) => x.songs.length > 0);
}

/** The song popup's count line: `8 songs`, or `1 match` while searching. */
export function pickerCount(n: number, searching: boolean): string {
	const word = searching ? 'match' : 'song';
	return n === 1 ? `1 ${word}` : `${n} ${word}${searching ? 'es' : 's'}`;
}
