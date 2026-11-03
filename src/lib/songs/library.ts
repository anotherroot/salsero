/**
 * PURE: the Music tab's library — what the list shows, and the words on each
 * row. Client-safe; imports nothing from `$lib/server`.
 */
import { clock } from '$lib/format';
import { MAX_RECORDING_BYTES, MAX_RECORDING_LABEL } from '$lib/limits';
import type { SongItem } from '$lib/types';
import { byTitle, groupSongs, searchSongs } from './search';

/** A song's name: its title, else where it came from, else a placeholder. */
export function songName(s: { title: string; sourceUrl: string | null }): string {
	return s.title || s.sourceUrl || 'Untitled song';
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
	uploading: boolean
): LibraryView<S> {
	if (query.trim()) {
		const hits = searchSongs(songs, query);
		return {
			kind: 'search',
			hits,
			heading: `${hits.length} ${hits.length === 1 ? 'match' : 'matches'} · title or artist`
		};
	}
	if (songs.length === 0 && !uploading) return { kind: 'empty' };
	const adding = songs.filter((s) => s.status !== 'ready');
	const { recent, rest } = groupSongs(songs.filter((s) => s.status === 'ready'));
	return {
		kind: 'list',
		adding,
		addingHeading: `Being added · ${adding.length + (uploading ? 1 : 0)}`,
		recent,
		rest,
		restHeading: `All songs A–Z · ${rest.length}`,
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
		case 'waiting_download':
			return {
				meta: style,
				tone: null,
				badge: { text: 'Waiting to download', tone: 'neutral', icon: 'clock' }
			};
		case 'waiting_analysis':
			return {
				meta: style,
				tone: null,
				badge: { text: 'Finding the beat', tone: 'accent', icon: 'metronome' }
			};
		case 'failed':
			return { meta: s.error ? `Failed: ${s.error}` : 'Failed', tone: 'danger', badge: null };
		default:
			return { meta: readyMeta(s, styleLabel), tone: null, badge: null };
	}
}

export function countOnlyMeta(clave: boolean): string {
	return clave ? 'The count and clave, no song' : 'The count, no song';
}

/** Why a picked file cannot be added, or null. Size first, then type. */
export function audioFileProblem(file: { size: number; type: string }): string | null {
	if (file.size > MAX_RECORDING_BYTES) {
		return `That file is ${Math.round(file.size / 1024 / 1024)} MB; the limit is ${MAX_RECORDING_LABEL}.`;
	}
	if (!/^audio\//.test(file.type)) return 'Only audio files can be added.';
	return null;
}

/** Megabytes with one decimal under 10 (".0" dropped), whole above. */
export function megabytes(bytes: number): string {
	const mb = bytes / 1024 / 1024;
	if (mb >= 10) return String(Math.round(mb));
	return mb.toFixed(1).replace(/\.0$/, '');
}

export function uploadMeta(loaded: number, total: number): string {
	return `Uploading · ${megabytes(loaded)} of ${megabytes(total)} MB · keep the app open`;
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
	uploading: boolean
): ClassLibraryView<S> {
	const view = libraryView(songs, query, uploading);
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
		draftsHeading: `Drafts · ${drafts.length}`,
		shared,
		sharedHeading: `Shared with the class · ${shared.length}`,
		worker: view.worker
	};
}

/** A shared song's meta in group mode: "Salsa · 192 BPM · 5:23 · used by 4". */
export function sharedMeta(s: SongItem, styleLabel: Record<string, string>, users: number): string {
	const meta = readyMeta(s, styleLabel);
	return users > 0 ? `${meta} · used by ${users}` : meta;
}

/** A group's section in a person's Music: "Salsa Tuesdays · 6". */
export function groupSectionHeading(name: string, n: number): string {
	return `${name} · ${n}`;
}

/** Above a group song's page for those who only read it. */
export function classSongNote(group: string): string {
	return `${group}'s song. The count is the teacher's.`;
}

const usedIn = (n: number) => `Used in ${n === 1 ? '1 person' : `${n} people`}'s practice.`;

/** Stop sharing's warning, when members' practice uses the song. */
export function songUseWarning(n: number): string {
	return `${usedIn(n)} They'll switch to count only until you share it again.`;
}

/** Delete's warning, when members' practice uses the song: Restore brings it back. */
export function songDeleteWarning(n: number): string {
	return `${usedIn(n)} They'll switch to count only until you restore it.`;
}

export function stopSharingTitle(name: string): string {
	return `Stop sharing ${name}?`;
}

export function deleteSongTitle(name: string): string {
	return `Delete ${name}?`;
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
	const lead = 'Members no longer see it, and it is a draft again.';
	return users > 0 ? `${lead} ${songUseWarning(users)}` : lead;
}

/** Delete's question under its title; the warning when members use it. */
export function deleteSongBody(users: number): string {
	const lead = 'It goes to Recently deleted for 30 days.';
	return users > 0 ? `${lead} ${songDeleteWarning(users)}` : lead;
}

/** What Make my own copy of a class song brings. */
export const SONG_COPY_ITEMS = ['The song', 'The teacher’s count and sample'];

export const SONG_COPY_NOTE =
	'Yours to re-tap your way, and it stays if the group deletes the song.';
