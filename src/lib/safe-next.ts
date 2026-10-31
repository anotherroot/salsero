/**
 * Only same-origin paths, so `?next=` cannot become an open redirect. Browsers
 * treat `\` as `/` and drop tabs and newlines, so `/\evil.example` means
 * another host. Anything with a backslash or a control character is refused
 * outright; the rest is parsed the way a browser does and the origin compared.
 * An encoded slash, backslash or tab right after the first `/` is refused too:
 * harmless to a browser, but never a path the app links to.
 */
export function safeNext(raw: string | null): string {
	if (!raw || !raw.startsWith('/')) return '/';
	// eslint-disable-next-line no-control-regex -- control characters are the point
	if (/[\\\u0000-\u001f\u007f]/.test(raw)) return '/';
	if (/^\/(?:[/\\]|%(?:09|0a|0d|5c|2f))/i.test(raw)) return '/';
	try {
		const u = new URL(raw, 'http://x');
		return u.origin === 'http://x' ? u.pathname + u.search + u.hash : '/';
	} catch {
		return '/';
	}
}
