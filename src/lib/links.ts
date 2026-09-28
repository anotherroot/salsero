/**
 * Links attached to lessons, figures and drills. PURE and client-safe: the
 * server validates with it before storing, and the page renders with it.
 *
 * Only `http:` and `https:` survive `parseLink`. That is the whole defence
 * against a `javascript:` URL: nothing that fails here is stored, and nothing
 * rendered as a link comes from anywhere else.
 */

export type ParsedLink =
	{ kind: 'youtube'; id: string; start: number | null } | { kind: 'web'; host: string };

const YOUTUBE_HOSTS = new Set([
	'youtube.com',
	'www.youtube.com',
	'm.youtube.com',
	'music.youtube.com',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com'
]);

/** A YouTube video id is exactly 11 of these. Anything else is not a video. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** `90`, `90s`, `1m30s`, `1h2m3s` → seconds; null for nothing or nonsense. */
export function parseTime(raw: string | null): number | null {
	if (!raw) return null;
	if (/^\d+$/.test(raw)) return Number(raw);
	const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
	if (!m || (!m[1] && !m[2] && !m[3])) return null;
	return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function parseLink(raw: string): ParsedLink | null {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

	const host = url.hostname.toLowerCase();
	let id: string | null = null;
	if (host === 'youtu.be') {
		id = url.pathname.slice(1).split('/')[0] ?? null;
	} else if (YOUTUBE_HOSTS.has(host)) {
		if (url.pathname === '/watch') id = url.searchParams.get('v');
		else id = /^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname)?.[1] ?? null;
	}
	if (id !== null && VIDEO_ID.test(id)) {
		return {
			kind: 'youtube',
			id,
			start: parseTime(url.searchParams.get('t') ?? url.searchParams.get('start'))
		};
	}
	return { kind: 'web', host: host.replace(/^www\./, '') };
}

/** A URL candidate in free text: up to the next space, quote or angle bracket. */
const URL_IN_TEXT = /https?:\/\/[^\s<>"]+/g;

const count = (s: string, ch: string) => s.split(ch).length - 1;

/**
 * Drop what a sentence puts after a URL: `.`, `,`, `)` and friends. A closing
 * paren is only dropped while it is unbalanced, so `…/Salsa_(dance)` keeps its
 * own while `(see https://x.org/a)` loses the sentence's.
 */
function trimUrl(candidate: string): string {
	let out = candidate;
	for (;;) {
		const last = out.at(-1);
		if (last !== undefined && `.,;:!?'"`.includes(last)) out = out.slice(0, -1);
		else if (last === ')' && count(out, '(') < count(out, ')')) out = out.slice(0, -1);
		else return out;
	}
}

/** The links in free text, in order, each once. Used by the notes import. */
export function extractUrls(text: string): string[] {
	const out: string[] = [];
	for (const m of text.matchAll(URL_IN_TEXT)) {
		const url = trimUrl(m[0]);
		if (parseLink(url) !== null && !out.includes(url)) out.push(url);
	}
	return out;
}

export type TextPiece = { text: string } | { url: string };

/**
 * Notes as runs of text and URLs, so a component can render the URLs as links
 * without `{@html}`. Joining every piece back gives the original text exactly.
 */
export function textPieces(text: string): TextPiece[] {
	const out: TextPiece[] = [];
	let at = 0;
	for (const m of text.matchAll(URL_IN_TEXT)) {
		const url = trimUrl(m[0]);
		const start = m.index ?? 0;
		if (parseLink(url) === null) continue;
		if (start > at) out.push({ text: text.slice(at, start) });
		out.push({ url });
		at = start + url.length;
	}
	if (at < text.length) out.push({ text: text.slice(at) });
	return out;
}

/** The "Add link" box: one URL per line. Blank lines are skipped, bad ones named. */
export function splitLinkLines(text: string): { urls: string[]; bad: string[] } {
	const urls: string[] = [];
	const bad: string[] = [];
	for (const line of text.split('\n').map((l) => l.trim())) {
		if (line === '') continue;
		if (parseLink(line) === null) bad.push(line);
		else urls.push(line);
	}
	return { urls, bad };
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** The nocookie host: no tracking cookie until the viewer actually presses play. */
export const youtubeEmbed = (id: string, start: number | null) =>
	`https://www.youtube-nocookie.com/embed/${id}?autoplay=1${start ? `&start=${start}` : ''}`;

export const youtubeWatch = (id: string, start: number | null) =>
	`https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`;
