import { describe, expect, it } from 'vitest';
import {
	sampleLabels,
	songSteps,
	songSubtitle,
	sourceOf,
	sourceRows,
	tapProblem
} from './song-page';

describe('tapProblem', () => {
	it('refuses a tap before the song has ever played', () => {
		expect(tapProblem(null)).toBe('Play the song first.');
		expect(tapProblem({ paused: true, currentTime: 0 })).toBe('Play the song first.');
	});

	it('lets a pause mid-song tap, as today', () => {
		expect(tapProblem({ paused: true, currentTime: 42.5 })).toBeNull();
	});

	it('lets a playing song tap, even at 0:00', () => {
		expect(tapProblem({ paused: false, currentTime: 0 })).toBeNull();
	});
});

describe('songSubtitle', () => {
	it('joins artist, style and a rounded BPM', () => {
		expect(songSubtitle({ artist: 'Marc Anthony', style: 'Salsa', bpm: 191.6 })).toBe(
			'Marc Anthony · Salsa · 192 BPM'
		);
	});

	it('leaves out what is not known', () => {
		expect(songSubtitle({ artist: null, style: 'Son', bpm: null })).toBe('Son');
		expect(songSubtitle({ artist: '', style: 'Sensual', bpm: 128 })).toBe('Sensual · 128 BPM');
	});
});

describe('sampleLabels', () => {
	it('says whose start the sample has', () => {
		expect(sampleLabels(true)).toEqual({ badge: 'Yours', tone: 'accent', meta: 'Set by you' });
		expect(sampleLabels(false)).toEqual({
			badge: 'Automatic',
			tone: 'neutral',
			meta: 'A third of the way in, on a 1'
		});
	});
});

describe('songSteps', () => {
	it('walks a link through download and the beat', () => {
		expect(songSteps('waiting_download', 'youtube', null)).toEqual([
			{ state: 'done', title: 'Added', meta: 'From YouTube' },
			{ state: 'now', title: 'Download', meta: 'Waiting for the home fetcher' },
			{ state: 'todo', title: 'Find the beat', meta: 'Beat analysis on the laptop' }
		]);
		expect(songSteps('waiting_analysis', 'youtube', null)).toEqual([
			{ state: 'done', title: 'Added', meta: 'From YouTube' },
			{ state: 'done', title: 'Download', meta: 'Downloaded' },
			{ state: 'now', title: 'Find the beat', meta: 'Waiting for beat analysis' }
		]);
	});

	it('skips Download for an upload', () => {
		expect(songSteps('waiting_analysis', 'upload', null)).toEqual([
			{ state: 'done', title: 'Added', meta: 'Uploaded' },
			{ state: 'now', title: 'Find the beat', meta: 'Waiting for beat analysis' }
		]);
	});

	it('has none once ready or failed', () => {
		expect(songSteps('ready', 'youtube', null)).toEqual([]);
		expect(songSteps('failed', 'upload', null)).toEqual([]);
	});
});

const SP = 'https://open.spotify.com/track/0wDEs6WvqDHq4XJZC0dHhO';
const YT = 'https://www.youtube.com/watch?v=hoja';

describe('songSteps for a Spotify song', () => {
	it('finds it on YouTube before the download', () => {
		expect(songSteps('waiting_download', 'spotify', null)).toEqual([
			{ state: 'done', title: 'Added', meta: 'From Spotify' },
			{ state: 'now', title: 'Find it on YouTube', meta: 'Waiting for the home fetcher' },
			{ state: 'todo', title: 'Download', meta: 'From the video it finds' },
			{ state: 'todo', title: 'Find the beat', meta: 'Beat analysis on the laptop' }
		]);
	});

	it('names the video it found once downloaded', () => {
		expect(songSteps('waiting_analysis', 'spotify', 'Hoja En Blanco (Audio)')).toEqual([
			{ state: 'done', title: 'Added', meta: 'From Spotify' },
			{ state: 'done', title: 'Find it on YouTube', meta: 'Hoja En Blanco (Audio)' },
			{ state: 'done', title: 'Download', meta: 'Downloaded' },
			{ state: 'now', title: 'Find the beat', meta: 'Waiting for beat analysis' }
		]);
	});
});

describe('sourceOf', () => {
	it('tells an upload, a Spotify song and a YouTube one apart', () => {
		expect(sourceOf(null)).toBe('upload');
		expect(sourceOf(SP)).toBe('spotify');
		expect(sourceOf(YT)).toBe('youtube');
	});
});

describe('sourceRows', () => {
	const base = { title: 'Hoja En Blanco', artist: 'Monchy & Alexandra' };

	it('gives a Spotify song both rows: Spotify, then the video it plays', () => {
		expect(
			sourceRows({
				...base,
				sourceUrl: SP,
				audioUrl: null,
				fetchedUrl: YT,
				fetchedTitle: 'Hoja (Audio)'
			})
		).toEqual([
			{ kind: 'spotify', href: SP, title: 'Spotify', meta: 'Hoja En Blanco · Monchy & Alexandra' },
			{ kind: 'youtube', href: YT, title: 'YouTube · the audio', meta: 'Hoja (Audio)' }
		]);
	});

	it('points the video row at the chosen link before the fetched one', () => {
		const rows = sourceRows({
			...base,
			sourceUrl: SP,
			audioUrl: 'https://youtu.be/mine',
			fetchedUrl: YT,
			fetchedTitle: null
		});
		expect(rows[1]).toMatchObject({ href: 'https://youtu.be/mine', meta: 'https://youtu.be/mine' });
	});

	it('has no video row for a Spotify song not yet found', () => {
		expect(
			sourceRows({ ...base, sourceUrl: SP, audioUrl: null, fetchedUrl: null, fetchedTitle: null })
		).toHaveLength(1);
	});

	it('gives a YouTube song one row, and an upload none', () => {
		expect(
			sourceRows({ ...base, sourceUrl: YT, audioUrl: null, fetchedUrl: YT, fetchedTitle: 'Hoja' })
		).toEqual([{ kind: 'youtube', href: YT, title: 'YouTube · the audio', meta: 'Hoja' }]);
		expect(
			sourceRows({ ...base, sourceUrl: null, audioUrl: null, fetchedUrl: null, fetchedTitle: null })
		).toEqual([]);
	});

	it('never draws a link that is not a web link', () => {
		expect(
			sourceRows({
				...base,
				sourceUrl: SP,
				audioUrl: null,
				fetchedUrl: 'javascript:alert(1)',
				fetchedTitle: 'x'
			})
		).toEqual([expect.objectContaining({ kind: 'spotify' })]);
	});
});
