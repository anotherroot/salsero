import { describe, expect, it } from 'vitest';
import { classifyLink, isYouTubeVideo, songKeyOf, type LinkKind } from './source';

const TRACK = '0wDEs6WvqDHq4XJZC0dHhO';
const VIDEO = 'Fd8nEwF3hHk';

describe('classifyLink', () => {
	const cases: [string, LinkKind][] = [
		[
			`https://open.spotify.com/track/${TRACK}?si=7ijevtD4QBSS07u37hj8kw&utm_source=copy-link`,
			{ kind: 'spotify-track', id: TRACK }
		],
		[`https://open.spotify.com/intl-de/track/${TRACK}`, { kind: 'spotify-track', id: TRACK }],
		[`spotify:track:${TRACK}`, { kind: 'spotify-track', id: TRACK }],
		[
			'https://open.spotify.com/playlist/37i9dQZF1DX4OzrY981I1W?si=x',
			{ kind: 'spotify-list', id: '37i9dQZF1DX4OzrY981I1W', list: 'playlist' }
		],
		[
			'https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX',
			{ kind: 'spotify-list', id: '1ATL5GLyefJaxhQzSPVrLX', list: 'album' }
		],
		['https://spotify.link/AbCdE', { kind: 'spotify-short' }],
		['https://open.spotify.com/episode/x1', { kind: 'spotify-other' }],
		['https://open.spotify.com/artist/x1', { kind: 'spotify-other' }],
		['https://open.spotify.com/show/x1', { kind: 'spotify-other' }],
		[
			'https://m.youtube.com/watch?v=QH0zo6AcP6g&list=PLo1L&index=4',
			{ kind: 'youtube-video', id: 'QH0zo6AcP6g' }
		],
		[`https://youtu.be/${VIDEO}?t=3`, { kind: 'youtube-video', id: VIDEO }],
		[`https://www.youtube.com/shorts/${VIDEO}`, { kind: 'youtube-video', id: VIDEO }],
		[`https://music.youtube.com/watch?v=${VIDEO}`, { kind: 'youtube-video', id: VIDEO }],
		['https://www.youtube.com/playlist?list=PLo1L1g', { kind: 'youtube-list', id: 'PLo1L1g' }],
		['https://music.youtube.com/playlist?list=PLo1L1g', { kind: 'youtube-list', id: 'PLo1L1g' }],
		['https://vimeo.com/1', { kind: 'other' }],
		['not a url', { kind: 'other' }]
	];
	it.each(cases)('%s', (url, expected) => {
		expect(classifyLink(url)).toEqual(expected);
	});
});

describe('songKeyOf', () => {
	it('names one YouTube video the same however it is linked', () => {
		for (const url of [
			`https://youtu.be/${VIDEO}?t=3`,
			`https://www.youtube.com/shorts/${VIDEO}`,
			`https://music.youtube.com/watch?v=${VIDEO}`
		])
			expect(songKeyOf(url)).toBe(`yt:${VIDEO}`);
	});
	it('names one Spotify track the same however it is linked', () => {
		for (const url of [
			`https://open.spotify.com/track/${TRACK}?si=1`,
			`https://open.spotify.com/intl-de/track/${TRACK}`,
			`spotify:track:${TRACK}`
		])
			expect(songKeyOf(url)).toBe(`sp:${TRACK}`);
	});
	it('has no key for nothing, a list or another site', () => {
		expect(songKeyOf(null)).toBeNull();
		expect(songKeyOf('https://www.youtube.com/playlist?list=PL1')).toBeNull();
		expect(songKeyOf('https://vimeo.com/1')).toBeNull();
	});
});

describe('isYouTubeVideo', () => {
	it('is true only for one YouTube video', () => {
		expect(isYouTubeVideo(`https://youtu.be/${VIDEO}`)).toBe(true);
		expect(isYouTubeVideo('https://www.youtube.com/playlist?list=PL1')).toBe(false);
		expect(isYouTubeVideo(`https://open.spotify.com/track/${TRACK}`)).toBe(false);
	});
});
