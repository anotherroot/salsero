import { describe, expect, it } from 'vitest';
import {
	extractUrls,
	parseLink,
	parseTime,
	splitLinkLines,
	textPieces,
	youtubeEmbed,
	youtubeWatch
} from './links';

const ID = 'dQw4w9WgXcQ';

describe('parseLink', () => {
	it.each([
		`https://www.youtube.com/watch?v=${ID}`,
		`https://youtube.com/watch?v=${ID}`,
		`https://m.youtube.com/watch?v=${ID}`,
		`https://music.youtube.com/watch?v=${ID}`,
		`https://youtu.be/${ID}`,
		`https://www.youtube.com/shorts/${ID}`,
		`https://www.youtube.com/embed/${ID}`,
		`https://www.youtube.com/live/${ID}`,
		`https://www.youtube-nocookie.com/embed/${ID}`,
		`http://www.youtube.com/watch?v=${ID}`
	])('finds the video id in %s', (url) => {
		expect(parseLink(url)).toEqual({ kind: 'youtube', id: ID, start: null });
	});

	it('ignores playlist and share junk around the id', () => {
		expect(parseLink(`https://www.youtube.com/watch?v=${ID}&list=PLx&index=3`)).toEqual({
			kind: 'youtube',
			id: ID,
			start: null
		});
		expect(parseLink(`https://youtu.be/${ID}?si=abcDEF123`)).toEqual({
			kind: 'youtube',
			id: ID,
			start: null
		});
	});

	it('reads the start time in seconds or h/m/s form', () => {
		expect(parseLink(`https://youtu.be/${ID}?t=90`)).toMatchObject({ start: 90 });
		expect(parseLink(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)).toMatchObject({
			start: 90
		});
		expect(parseLink(`https://www.youtube.com/embed/${ID}?start=42`)).toMatchObject({
			start: 42
		});
	});

	it('treats a YouTube URL without a valid id as an ordinary link', () => {
		expect(parseLink('https://www.youtube.com/@somechannel')).toEqual({
			kind: 'web',
			host: 'youtube.com'
		});
		expect(parseLink('https://youtu.be/short')).toEqual({ kind: 'web', host: 'youtu.be' });
	});

	it('names the host of any other link, without www', () => {
		expect(parseLink('https://www.salsa-school.si/lessons?x=1')).toEqual({
			kind: 'web',
			host: 'salsa-school.si'
		});
	});

	it.each(['javascript:alert(1)', 'data:text/html,hi', 'ftp://x.org/a', 'not a url', ''])(
		'refuses %s',
		(url) => {
			expect(parseLink(url)).toBeNull();
		}
	);
});

describe('parseTime', () => {
	it('parses plain seconds and h/m/s', () => {
		expect(parseTime('75')).toBe(75);
		expect(parseTime('2m')).toBe(120);
		expect(parseTime('1h2m3s')).toBe(3723);
		expect(parseTime('45s')).toBe(45);
	});
	it('gives null for nothing or nonsense', () => {
		expect(parseTime(null)).toBeNull();
		expect(parseTime('')).toBeNull();
		expect(parseTime('soon')).toBeNull();
	});
});

describe('extractUrls', () => {
	it('finds every URL, trims trailing punctuation, and keeps a balanced paren', () => {
		const text = `Watch this (https://youtu.be/${ID}). Also https://example.com/a, and
https://en.wikipedia.org/wiki/Salsa_(dance) — nice!`;
		expect(extractUrls(text)).toEqual([
			`https://youtu.be/${ID}`,
			'https://example.com/a',
			'https://en.wikipedia.org/wiki/Salsa_(dance)'
		]);
	});
	it('returns each URL once', () => {
		expect(extractUrls('https://a.org/x https://a.org/x')).toEqual(['https://a.org/x']);
	});
	it('finds nothing in plain text', () => {
		expect(extractUrls('no links here')).toEqual([]);
	});
});

describe('textPieces', () => {
	it('splits text around URLs and round-trips the original', () => {
		const text = 'See https://a.org/x. Then (https://b.org/y) ok';
		const pieces = textPieces(text);
		expect(pieces).toEqual([
			{ text: 'See ' },
			{ url: 'https://a.org/x' },
			{ text: '. Then (' },
			{ url: 'https://b.org/y' },
			{ text: ') ok' }
		]);
		expect(pieces.map((p) => ('url' in p ? p.url : p.text)).join('')).toBe(text);
	});
	it('is one text piece when there is no URL', () => {
		expect(textPieces('just words')).toEqual([{ text: 'just words' }]);
	});
});

describe('splitLinkLines', () => {
	it('keeps good lines, names bad ones, and skips blanks', () => {
		expect(splitLinkLines(`https://youtu.be/${ID}\n\n  javascript:x \nhttps://a.org\n`)).toEqual({
			urls: [`https://youtu.be/${ID}`, 'https://a.org'],
			bad: ['javascript:x']
		});
	});
});

describe('youtube urls', () => {
	it('builds the nocookie embed and the watch link with a start', () => {
		expect(youtubeEmbed(ID, 90)).toBe(
			`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&start=90`
		);
		expect(youtubeEmbed(ID, null)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?autoplay=1`);
		expect(youtubeWatch(ID, 90)).toBe(`https://www.youtube.com/watch?v=${ID}&t=90s`);
	});
});
