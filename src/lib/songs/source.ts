/**
 * PURE, client-safe: what a link pasted into Add a song is. A Spotify track is
 * one song (the worker finds it on YouTube); a playlist or album is a pick
 * list; a YouTube `watch` link stays one song even when it carries a `list`.
 * See docs/superpowers/specs/2026-11-08-spotify-and-playlists-design.md.
 */

export type LinkKind =
	| { kind: 'youtube-video'; id: string }
	| { kind: 'youtube-list'; id: string }
	| { kind: 'spotify-track'; id: string }
	| { kind: 'spotify-list'; id: string; list: 'playlist' | 'album' }
	| { kind: 'spotify-short' }
	| { kind: 'spotify-other' }
	| { kind: 'other' };

const OTHER: LinkKind = { kind: 'other' };

function spotifyPath(parts: string[]): LinkKind {
	// `/intl-de/track/<id>`: the language prefix is not part of the link.
	const rest = parts[0]?.startsWith('intl-') ? parts.slice(1) : parts;
	const [type, id] = rest;
	if (!id) return { kind: 'spotify-other' };
	if (type === 'track') return { kind: 'spotify-track', id };
	if (type === 'playlist' || type === 'album') return { kind: 'spotify-list', id, list: type };
	return { kind: 'spotify-other' };
}

export function classifyLink(url: string): LinkKind {
	const raw = url.trim();
	if (raw.startsWith('spotify:')) return spotifyPath(raw.split(':').slice(1));
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		return OTHER;
	}
	if (u.protocol !== 'https:' && u.protocol !== 'http:') return OTHER;
	const host = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
	const parts = u.pathname.split('/').filter(Boolean);
	if (host === 'open.spotify.com') return spotifyPath(parts);
	if (host === 'spotify.link' || host === 'spotify.app.link') return { kind: 'spotify-short' };
	if (host === 'youtu.be') return parts[0] ? { kind: 'youtube-video', id: parts[0] } : OTHER;
	if (host === 'youtube.com' || host === 'music.youtube.com') {
		const v = u.searchParams.get('v');
		if (parts[0] === 'watch' && v) return { kind: 'youtube-video', id: v };
		if ((parts[0] === 'shorts' || parts[0] === 'live') && parts[1])
			return { kind: 'youtube-video', id: parts[1] };
		const list = u.searchParams.get('list');
		if (parts[0] === 'playlist' && list) return { kind: 'youtube-list', id: list };
	}
	return OTHER;
}

/** 'yt:<id>' or 'sp:<id>': two songs with the same key are the same song. */
export function songKeyOf(url: string | null): string | null {
	if (!url) return null;
	const k = classifyLink(url);
	if (k.kind === 'youtube-video') return `yt:${k.id}`;
	if (k.kind === 'spotify-track') return `sp:${k.id}`;
	return null;
}

export function isYouTubeVideo(url: string): boolean {
	return classifyLink(url).kind === 'youtube-video';
}
