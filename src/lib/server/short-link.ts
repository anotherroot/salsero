/**
 * A `spotify.link` short link: where it leads, so the box can tell a song
 * from a playlist. The one outbound request the server makes for Spotify:
 * headers only, one hop, 5 s. It reads nothing from Spotify itself; the
 * worker does that (worker/salsa_worker/spotify.py).
 */
const TIMEOUT_MS = 5000;

export async function resolveShortLink(
	url: string,
	fetchFn: typeof fetch = fetch
): Promise<string | null> {
	try {
		const res = await fetchFn(url, {
			method: 'HEAD',
			redirect: 'manual',
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (res.status < 300 || res.status >= 400) return null;
		const to = res.headers.get('location');
		if (!to) return null;
		const u = new URL(to, url);
		return u.protocol === 'https:' && u.hostname === 'open.spotify.com' ? u.toString() : null;
	} catch {
		return null;
	}
}
