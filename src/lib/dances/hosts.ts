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

/** What both hosts serve as they are: the worker, the update check, the APKs, health, assets. */
const EVERY_HOST = ['/api/worker/', '/api/app-update/', '/releases/', '/_app/'];

/**
 * What a mapped host does with a request before anything else: pass it,
 * redirect it (303, a GET or HEAD only) to the host of the dance it belongs
 * to, or answer it as missing (404). Two cases move a request:
 *
 * - a signed-in account of the other dance (a session from before the split)
 *   goes to its own host, to the same path unless that path is this dance's,
 *   which would only bounce back, so to `/` there;
 * - a path under the other dance's prefix goes to that dance's host.
 *
 * Cookies are per host, so the other host never sees this session: no loop.
 * An unmapped host (dev, specs, loopback) passes everything; the wall is the
 * account's dance (`wallOf`), never the host.
 */
export function hostRedirect(i: {
	hosts: DanceHosts;
	host: string;
	path: string;
	search: string;
	method: string;
	userDance: DanceSlug | null;
}): { kind: 'pass' } | { kind: 'redirect'; to: string } | { kind: 'missing' } {
	const here = hostDance(i.hosts, i.host);
	if (here === null) return { kind: 'pass' };
	if (i.path === '/health' || EVERY_HOST.some((p) => i.path.startsWith(p))) return { kind: 'pass' };
	const readOnly = i.method === 'GET' || i.method === 'HEAD';
	const go = (dance: DanceSlug, to: string) => {
		const host = hostOf(i.hosts, dance);
		return host && readOnly && !i.path.startsWith('/api/')
			? ({ kind: 'redirect', to: `https://${host}${to}` } as const)
			: ({ kind: 'missing' } as const);
	};
	const pathDance = danceInPath(i.path);
	if (i.userDance !== null && i.userDance !== here) {
		const keep = pathDance === null || pathDance === i.userDance;
		return go(i.userDance, keep ? i.path + i.search : '/');
	}
	if (pathDance !== null && pathDance !== here) return go(pathDance, i.path + i.search);
	return { kind: 'pass' };
}
