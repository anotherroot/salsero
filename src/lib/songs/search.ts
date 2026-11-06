/**
 * PURE: searching and grouping the song popup's list (the shared picker marks
 * the matches). Client-safe.
 */
import { fold } from '$lib/fold';
import { clock } from '$lib/format';

export const byTitle = (a: { title: string }, b: { title: string }) =>
	a.title.localeCompare(b.title);

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

type Groupable = {
	title: string;
	recentRank: number | null;
	group?: string | null;
	groupId?: number | null;
};

/**
 * The recent songs by rank (the person's own and their groups' alike), then
 * the rest of the person's own A to Z, then each group's shared songs A to Z,
 * the groups by name. A group is its id: two groups may share a name.
 */
export function groupSongs<S extends Groupable>(
	songs: S[]
): { recent: S[]; rest: S[]; groups: { id: number; name: string; songs: S[] }[] } {
	const recent = songs
		.filter((s) => s.recentRank !== null)
		.sort((a, b) => (a.recentRank as number) - (b.recentRank as number));
	const others = songs.filter((s) => s.recentRank === null);
	const rest = others.filter((s) => s.groupId == null).sort(byTitle);
	const byGroup = new Map<number, { id: number; name: string; songs: S[] }>();
	for (const s of others) {
		if (s.groupId == null) continue;
		const g = byGroup.get(s.groupId) ?? { id: s.groupId, name: s.group ?? '', songs: [] };
		g.songs.push(s);
		byGroup.set(s.groupId, g);
	}
	const groups = [...byGroup.values()]
		.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
		.map((g) => ({ ...g, songs: g.songs.sort(byTitle) }));
	return { recent, rest, groups };
}

/** Which list a section of the popup is: rows outside a group's own say which group they are. */
export type SongSectionKind = 'first' | 'recent' | 'yours' | 'group';

/**
 * The popup's sections, empty ones left out: Recent, the person's own songs
 * ("Your songs" beside groups, "All songs A–Z" after Recent alone, no heading
 * when they are all there is), then a heading per group.
 */
export function songSections<S extends Groupable & { id: number }>(
	songs: S[],
	first?: { label: string; ids: number[] } | null
): { kind: SongSectionKind; label: string | null; songs: S[] }[] {
	const { recent, rest, groups } = groupSongs(songs);
	const own = groups.length > 0 ? 'Your songs' : recent.length > 0 ? 'All songs A–Z' : null;
	// A drill's or routine's Music first (spec B), in its order; they stay in their own sections too.
	const lead = (first?.ids ?? []).flatMap((id) => songs.filter((s) => s.id === id));
	return [
		{ kind: 'first' as const, label: first?.label ?? null, songs: lead },
		{ kind: 'recent' as const, label: 'Recent', songs: recent },
		{ kind: 'yours' as const, label: own, songs: rest },
		...groups.map((g) => ({ kind: 'group' as const, label: g.name, songs: g.songs }))
	].filter((x) => x.songs.length > 0);
}

/** The song popup's count line: `8 songs`, or `1 match` while searching. */
export function pickerCount(n: number, searching: boolean): string {
	const word = searching ? 'match' : 'song';
	return n === 1 ? `1 ${word}` : `${n} ${word}${searching ? 'es' : 's'}`;
}

/**
 * A song row's line: `Style · 98 BPM · 4:12`, leaving out what is not known;
 * a group's song names its group first where no heading does (`named`).
 */
export function songMeta(
	s: {
		style: string;
		bpm: number | null;
		durationS: number | null;
		group?: string | null;
	},
	styleLabels: Record<string, string>,
	named = false
): string {
	return [
		named ? null : s.group,
		styleLabels[s.style] ?? s.style,
		s.bpm ? `${s.bpm} BPM` : null,
		s.durationS ? clock(s.durationS) : null
	]
		.filter(Boolean)
		.join(' · ');
}

/** The log popup's lead section: the songs marked as the row's own Music, in its order. */
export function musicFirst(
	songs: { id: number; music?: { label: string; rank: number } }[]
): { label: string; ids: number[] } | null {
	const marked = songs.filter((s) => s.music).sort((a, b) => a.music!.rank - b.music!.rank);
	return marked.length > 0 ? { label: marked[0].music!.label, ids: marked.map((s) => s.id) } : null;
}
