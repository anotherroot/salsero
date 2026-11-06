/**
 * Which host serves which dance. Each dance is its own app on its own host
 * (`salsa.anotherroot.eu`, `bachata.anotherroot.eu`), one backend behind both.
 * PURE and client-safe: the map is passed in (the server reads `DANCE_HOSTS`,
 * `$lib/server/hosts.ts`). A host not in the map (dev, specs, loopback) has no
 * dance of its own and the path decides, as before the split.
 *
 * The host only picks the login, the redirects and `/`. The wall is the
 * account's dance (`wallOf`), whatever the host.
 */
import { DEFAULT_DANCE, danceInPath, isDanceSlug, type DanceSlug } from './dances';

/** host (lower case, no port) → dance. */
export type DanceHosts = ReadonlyMap<string, DanceSlug>;

/** `salsa.anotherroot.eu=salsa,bachata.anotherroot.eu=bachata`; bad entries are dropped. */
export function parseDanceHosts(raw: string | undefined): DanceHosts {
	const out = new Map<string, DanceSlug>();
	for (const entry of (raw ?? '').split(',')) {
		const [host, dance] = entry.split('=').map((s) => s.trim());
		if (host && dance && isDanceSlug(dance)) out.set(host.toLowerCase(), dance);
	}
	return out;
}

function bare(host: string): string {
	return host.toLowerCase().replace(/:\d+$/, '');
}

export function hostDance(hosts: DanceHosts, host: string): DanceSlug | null {
	return hosts.get(bare(host)) ?? null;
}

export function hostOf(hosts: DanceHosts, dance: DanceSlug): string | null {
	for (const [host, d] of hosts) if (d === dance) return host;
	return null;
}

/**
 * The dance a request belongs to: the signed-in account's, else the host's,
 * else the path's, the `next` path's, a `?dance=` query's, else the default.
 */
export function requestDance(i: {
	userDance: DanceSlug | null;
	hostDance: DanceSlug | null;
	path: string;
	next: string | null;
	query: string | null;
}): DanceSlug {
	return (
		i.userDance ??
		i.hostDance ??
		danceInPath(i.path) ??
		(i.next ? danceInPath(i.next) : null) ??
		(i.query && isDanceSlug(i.query) ? i.query : null) ??
		DEFAULT_DANCE
	);
}
