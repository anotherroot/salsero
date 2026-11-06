/**
 * The host map from the environment (`DANCE_HOSTS`, e.g.
 * `salsa.anotherroot.eu=salsa,bachata.anotherroot.eu=bachata`), and the
 * dance a request belongs to. The pure parts are `$lib/dances/hosts.ts`.
 */
import { env } from '$env/dynamic/private';
import { hostDance, parseDanceHosts, requestDance, type DanceHosts } from '$lib/dances/hosts';
import type { DanceSlug } from '$lib/dances/dances';

let cached: { raw: string | undefined; hosts: DanceHosts } | undefined;

export function danceHosts(): DanceHosts {
	const raw = env.DANCE_HOSTS;
	if (!cached || cached.raw !== raw) cached = { raw, hosts: parseDanceHosts(raw) };
	return cached.hosts;
}

/**
 * The dance of this request: the signed-in account's, else the host's, else
 * (dev, an unmapped host) the path's, the `next` path's or `?dance=`.
 */
export function requestDanceOf(
	url: URL,
	user: { dance: DanceSlug } | null,
	next: string | null = url.searchParams.get('next')
): DanceSlug {
	return requestDance({
		userDance: user?.dance ?? null,
		hostDance: hostDance(danceHosts(), url.host),
		path: url.pathname,
		next,
		query: url.searchParams.get('dance')
	});
}
