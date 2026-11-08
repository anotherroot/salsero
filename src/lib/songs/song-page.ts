import { t } from '$lib/i18n/catalog';
import { BPM, type SongStatus } from '$lib/labels';
import { classifyLink } from './source';

/**
 * PURE: the song page's words and its one rule about taps. Client-safe;
 * imports nothing from `$lib/server`.
 */

/** Under the song's name: who, which style, how fast — whatever is known. */
export function songSubtitle(p: {
	artist: string | null;
	style: string;
	bpm: number | null;
}): string {
	return [p.artist || null, p.style, p.bpm ? `${Math.round(p.bpm)} ${BPM}` : null]
		.filter((part): part is string => part !== null)
		.join(' · ');
}

/**
 * Why a tap on the 1 cannot be filed yet, or null when it can. A tap marks the
 * beat at the playhead, so a song that has never played (paused at 0:00, or no
 * audio element yet) would file an anchor at the very start. A pause mid-song
 * still taps, as it always has: the playhead is where the user stopped.
 */
export function tapProblem(audio: { paused: boolean; currentTime: number } | null): string | null {
	if (!audio || (audio.paused && audio.currentTime === 0)) return t().songs.page.playFirst;
	return null;
}

/** The sample row's badge and meta: the user's own start, or the automatic one. */
export function sampleLabels(custom: boolean): {
	badge: string;
	tone: 'accent' | 'neutral';
	meta: string;
} {
	const w = t().songs.page;
	return custom
		? { badge: w.sampleYours, tone: 'accent', meta: w.sampleSetByYou }
		: { badge: w.sampleAutomatic, tone: 'neutral', meta: w.sampleAutomaticMeta };
}

export type SongStep = { state: 'done' | 'now' | 'todo'; title: string; meta: string };

/** Names, never translated. */
export const BRAND = { spotify: 'Spotify', youtube: 'YouTube' } as const;

/** Where a song came from: an upload has no link; a Spotify song is found on YouTube. */
export type SongSource = 'upload' | 'youtube' | 'spotify';

export function sourceOf(sourceUrl: string | null): SongSource {
	if (!sourceUrl) return 'upload';
	return classifyLink(sourceUrl).kind === 'spotify-track' ? 'spotify' : 'youtube';
}

/**
 * The rows of a song still being added; an upload has no Download, a Spotify
 * song is found on YouTube first (`fetchedTitle` names the video once it is
 * downloaded). Empty once ready or failed.
 */
export function songSteps(
	status: SongStatus,
	source: SongSource,
	fetchedTitle: string | null
): SongStep[] {
	if (status !== 'waiting_download' && status !== 'waiting_analysis') return [];
	const w = t().songs.page.steps;
	const s = t().songs.source;
	const fromUpload = source === 'upload';
	const added: SongStep = {
		state: 'done',
		title: w.added,
		meta: fromUpload ? w.uploaded : source === 'spotify' ? s.fromSpotify : w.fromYouTube
	};
	if (source === 'spotify') {
		if (status === 'waiting_download')
			return [
				added,
				{ state: 'now', title: s.findOnYouTube, meta: w.waitingFetcher },
				{ state: 'todo', title: w.download, meta: s.fromVideo },
				{ state: 'todo', title: w.findBeat, meta: w.onLaptop }
			];
		return [
			added,
			{ state: 'done', title: s.findOnYouTube, meta: fetchedTitle ?? BRAND.youtube },
			{ state: 'done', title: w.download, meta: w.downloaded },
			{ state: 'now', title: w.findBeat, meta: w.waitingAnalysis }
		];
	}
	if (status === 'waiting_download')
		return [
			added,
			{ state: 'now', title: w.download, meta: w.waitingFetcher },
			{ state: 'todo', title: w.findBeat, meta: w.onLaptop }
		];
	const download: SongStep[] = fromUpload
		? []
		: [{ state: 'done', title: w.download, meta: w.downloaded }];
	return [added, ...download, { state: 'now', title: w.findBeat, meta: w.waitingAnalysis }];
}

/** Only http(s) is ever drawn as a link: the worker's report is not trusted to be one. */
function isWebLink(url: string): boolean {
	return /^https?:\/\//i.test(url);
}

/** A row of the "Audio from" card: where the song came from, and the video it plays. */
export type SourceRow = { kind: 'spotify' | 'youtube'; href: string; title: string; meta: string };

export function sourceRows(song: {
	sourceUrl: string | null;
	audioUrl: string | null;
	fetchedUrl: string | null;
	fetchedTitle: string | null;
	title: string;
	artist: string | null;
}): SourceRow[] {
	if (!song.sourceUrl) return [];
	const w = t().songs.source;
	const rows: SourceRow[] = [];
	if (sourceOf(song.sourceUrl) === 'spotify')
		rows.push({
			kind: 'spotify',
			href: song.sourceUrl,
			title: BRAND.spotify,
			meta: [song.title, song.artist].filter(Boolean).join(' · ')
		});
	// The person's own link wins: it is what the next download plays.
	const video =
		song.audioUrl ??
		song.fetchedUrl ??
		(sourceOf(song.sourceUrl) === 'youtube' ? song.sourceUrl : null);
	if (video && isWebLink(video))
		rows.push({
			kind: 'youtube',
			href: video,
			title: w.youtubeAudio,
			meta: video === song.fetchedUrl && song.fetchedTitle ? song.fetchedTitle : video
		});
	return rows;
}
