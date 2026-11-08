import { t } from '$lib/i18n/catalog';
import { BPM, type SongStatus } from '$lib/labels';

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

/** The rows of a song still being added; an upload has no Download. Empty once ready or failed. */
export function songSteps(status: SongStatus, fromUpload: boolean): SongStep[] {
	if (status !== 'waiting_download' && status !== 'waiting_analysis') return [];
	const w = t().songs.page.steps;
	const added: SongStep = {
		state: 'done',
		title: w.added,
		meta: fromUpload ? w.uploaded : w.fromYouTube
	};
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
