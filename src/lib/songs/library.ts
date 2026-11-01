/**
 * PURE: the Music tab's library — what the list shows, and the words on each
 * row. Client-safe; imports nothing from `$lib/server`.
 */
import { clock } from '$lib/format';
import { MAX_RECORDING_BYTES, MAX_RECORDING_LABEL } from '$lib/limits';
import type { SongItem } from '$lib/types';
import { groupSongs, searchSongs } from './search';

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
