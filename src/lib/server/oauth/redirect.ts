const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function isLoopback(u: URL): boolean {
	return u.protocol === 'http:' && LOOPBACK.has(u.hostname);
}

function parse(s: string): URL | null {
	try {
		return new URL(s);
	} catch {
		return null;
	}
}

/**
 * Is `requested` one of the client's registered redirect URIs?
 *
 * Exact string match, with ONE exception (RFC 8252 §7.3): a loopback URI
 * matches ignoring the port, because local clients (Claude Code) bind an ephemeral one. The
 * comparison is on parsed parts, never a prefix test, so
 * `https://claude.ai.evil.com/…` cannot pass for `https://claude.ai/…`.
 * A fragment or userinfo is refused outright.
 */
export function redirectMatches(requested: string, registered: readonly string[]): boolean {
	const req = parse(requested);
	if (!req || req.hash || req.username || req.password) return false;
	if (req.protocol !== 'https:' && !isLoopback(req)) return false;
	for (const r of registered) {
		if (r === requested) return true;
		const reg = parse(r);
		if (
			reg &&
			isLoopback(reg) &&
			isLoopback(req) &&
			reg.hostname === req.hostname &&
			reg.pathname === req.pathname &&
			reg.search === req.search
		)
			return true;
	}
	return false;
}
