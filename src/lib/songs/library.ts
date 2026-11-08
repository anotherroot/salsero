/**
 * PURE: the Music tab's library — what the list shows, and the words on each
 * row. Client-safe; imports nothing from `$lib/server`.
 */
import { clock } from '$lib/format';
import { t } from '$lib/i18n/catalog';
import { MAX_RECORDING_BYTES, MAX_RECORDING_LABEL } from '$lib/limits';
import type { SongItem } from '$lib/types';
import { byTitle, groupSongs, searchSongs } from './search';
import { sourceOf } from './song-page';

/** A song's name: its title, else where it came from, else a placeholder. */
export function songName(s: { title: string; sourceUrl: string | null }): string {
	return s.title || s.sourceUrl || t().songs.list.untitled;
}

export type LibraryView<S> =
	| { kind: 'empty' }
	| { kind: 'search'; hits: S[]; heading: string }
	| {
			kind: 'list';
			adding: S[];
			addingHeading: string;
			recent: S[];
			rest: S[];
			restHeading: string;
			worker: boolean;
	  };

/**
 * What the library shows. A blank query is the list (Being added, Recent,
 * All songs A–Z); anything typed is a flat search over every song of any state.
 * `songs` arrive newest first, which is the order Being added keeps.
 */
export function libraryView<S extends SongItem>(
	songs: S[],
	query: string,
	uploading: boolean,
	/** Pasted playlists in Music (To pick and Being added): the list is not empty while one is there. */
	imports = 0,
	/** Of those, the ones in Being added (reading or failed): they count in its heading. */
	importsAdding = imports
): LibraryView<S> {
	if (query.trim()) {
		const hits = searchSongs(songs, query);
		return {
			kind: 'search',
			hits,
			heading: t().songs.list.searchHeading(hits.length)
		};
	}
	if (songs.length === 0 && !uploading && imports === 0) return { kind: 'empty' };
	const adding = songs.filter((s) => s.status !== 'ready');
	const { recent, rest } = groupSongs(songs.filter((s) => s.status === 'ready'));
	return {
		kind: 'list',
		adding,
		addingHeading: t().songs.list.beingAdded(adding.length + (uploading ? 1 : 0) + importsAdding),
		recent,
		rest,
		restHeading: t().songs.list.allAZ(rest.length),
		worker: adding.some((s) => s.status.startsWith('waiting_'))
	};
}

/** "Salsa · 192 BPM · 5:23", missing parts dropped. */
export function readyMeta(s: SongItem, styleLabel: Record<string, string>): string {
	return [
		styleLabel[s.style] ?? s.style,
		s.bpm ? `${Math.round(s.bpm * s.tempoFactor)} BPM` : null,
		s.durationS ? clock(s.durationS) : null
	]
		.filter(Boolean)
		.join(' · ');
}

export function songState(
	s: SongItem,
	styleLabel: Record<string, string>
): {
	meta: string;
	tone: 'danger' | null;
	badge: { text: string; tone: 'neutral' | 'accent'; icon: 'clock' | 'metronome' } | null;
} {
	const style = styleLabel[s.style] ?? s.style;
	switch (s.status) {
		case 'waiting_download': {
			// A Spotify song is found on YouTube before it downloads.
			const spotify = sourceOf(s.sourceUrl) === 'spotify';
			return {
				meta: spotify ? [s.artist, style].filter(Boolean).join(' · ') : style,
				tone: null,
				badge: {
					text: spotify ? t().songs.source.findingIt : t().songs.list.waitingDownload,
					tone: 'neutral',
					icon: 'clock'
				}
			};
		}
		case 'waiting_analysis':
			return {
				meta: style,
				tone: null,
				badge: { text: t().songs.list.findingBeat, tone: 'accent', icon: 'metronome' }
			};
		case 'failed':
			return {
				meta: s.error ? t().songs.list.failedWith(s.error) : t().songs.list.failed,
				tone: 'danger',
				badge: null
			};
		default:
			return { meta: readyMeta(s, styleLabel), tone: null, badge: null };
	}
}

export function countOnlyMeta(clave: boolean): string {
	return clave ? t().songs.list.countOnlyClave : t().songs.list.countOnlyPlain;
}

/** Why a picked file cannot be added, or null. Size first, then type. */
export function audioFileProblem(file: { size: number; type: string }): string | null {
	if (file.size > MAX_RECORDING_BYTES) {
		return t().songs.add.tooLarge(String(Math.round(file.size / 1024 / 1024)), MAX_RECORDING_LABEL);
	}
	if (!/^audio\//.test(file.type)) return t().songs.add.audioOnly;
	return null;
}

/** Megabytes with one decimal under 10 (".0" dropped), whole above. */
export function megabytes(bytes: number): string {
	const mb = bytes / 1024 / 1024;
	if (mb >= 10) return String(Math.round(mb));
	return t()
		.common.decimal(mb, 1)
		.replace(/[.,]0$/, '');
}

export function uploadMeta(loaded: number, total: number): string {
	return t().songs.add.progress(megabytes(loaded), megabytes(total));
}

export type ClassLibraryView<S> =
	| { kind: 'empty' }
	| { kind: 'search'; hits: S[]; heading: string }
	| {
			kind: 'class';
			adding: S[];
			addingHeading: string;
			drafts: S[];
			draftsHeading: string;
			shared: S[];
			sharedHeading: string;
			worker: boolean;
	  };

/**
 * Music in group mode: the group's songs. Being added (only editors see a
 * group's songs being added, and none of them is shared yet), the ready
 * drafts, then the ones shared with the class, each A–Z. A search is the
 * same flat search as a person's Music.
 */
export function classLibraryView<S extends SongItem>(
	songs: S[],
	query: string,
	uploading: boolean,
	imports = 0,
	importsAdding = imports
): ClassLibraryView<S> {
	const view = libraryView(songs, query, uploading, imports, importsAdding);
	if (view.kind !== 'list') return view;
	const ready = songs.filter((s) => s.status === 'ready');
	const az = (xs: S[]) => [...xs].sort(byTitle);
	const drafts = az(ready.filter((s) => s.sharedAt === null));
	const shared = az(ready.filter((s) => s.sharedAt !== null));
	return {
		kind: 'class',
		adding: view.adding,
		addingHeading: view.addingHeading,
		drafts,
		draftsHeading: t().songs.list.drafts(drafts.length),
		shared,
		sharedHeading: t().songs.list.sharedWithClass(shared.length),
		worker: view.worker
	};
}

/** A shared song's meta in group mode: "Salsa · 192 BPM · 5:23 · used by 4". */
export function sharedMeta(s: SongItem, styleLabel: Record<string, string>, users: number): string {
	const meta = readyMeta(s, styleLabel);
	return users > 0 ? `${meta} · ${t().songs.list.usedBy(users)}` : meta;
}

/** A group's section in a person's Music: "Salsa Tuesdays · 6". */
export function groupSectionHeading(name: string, n: number): string {
	return `${name} · ${n}`;
}

/** Above a group song's page for those who only read it. */
export function classSongNote(group: string): string {
	return t().songs.share.classSongNote(group);
}

/** Stop sharing's warning, when members' practice uses the song. */
export function songUseWarning(n: number): string {
	return `${t().songs.share.usedIn(n)} ${t().songs.share.untilShared}`;
}

/** Delete's warning, when members' practice uses the song: Restore brings it back. */
export function songDeleteWarning(n: number): string {
	return `${t().songs.share.usedIn(n)} ${t().songs.share.untilRestored}`;
}

export function stopSharingTitle(name: string): string {
	return t().songs.share.stopTitle(name);
}

export function deleteSongTitle(name: string): string {
	return t().songs.share.deleteTitle(name);
}

/**
 * A person's Music below their own songs: a section per group with its shared
 * songs, A–Z. A search keeps only the matches, and a group without one goes.
 */
export function groupSections<S extends SongItem>(
	groups: { team: { id: number; name: string }; songs: S[] }[],
	query: string
): { team: { id: number; name: string }; songs: S[]; heading: string }[] {
	return groups
		.map((g) => ({ team: g.team, songs: searchSongs(g.songs, query) }))
		.filter((g) => g.songs.length > 0)
		.map((g) => ({ ...g, heading: groupSectionHeading(g.team.name, g.songs.length) }));
}

/** Stop sharing's question under its title; the warning when members use it. */
export function stopSharingBody(users: number): string {
	const lead = t().songs.share.stopLead;
	return users > 0 ? `${lead} ${songUseWarning(users)}` : lead;
}

/** Delete's question under its title; the warning when members use it. */
export function deleteSongBody(users: number): string {
	const lead = t().songs.share.deleteLead;
	return users > 0 ? `${lead} ${songDeleteWarning(users)}` : lead;
}
