/*
 * What the service worker does with a request (offline phase 2). PURE,
 * client-safe: src/service-worker.ts asks it, the spec pins it. Online
 * nothing changes: every answer is the network's first, and the cache or the
 * device answers only when the network fails.
 */
import type { DeviceState } from './protocol';
import { DEVICE_ENDPOINTS, NETWORK_ENDPOINTS, deviceAnswers, routePattern } from './routes';

/**
 * - `precached`: the build, its static files and the device bundle, from the cache;
 * - `navigate`: a page load, the network first, else the cached shell;
 * - `device-read`: the network first, else the device's copy;
 * - `write`: the network only; offline it gets "Needs a connection";
 * - `pass`: the service worker stays out of it (no `respondWith`).
 */
export type SwRoute = 'precached' | 'navigate' | 'device-read' | 'write' | 'pass';

/** How long a read waits for the network when the device could answer it instead. */
export const NETWORK_TIMEOUT_MS = 4000;

/** The client-rendered page every offline page load gets (`src/routes/shell`). */
export const SHELL = '/shell';

/**
 * SvelteKit polls it to see a deploy (`updated`); a cached copy would hide
 * every new build. It is not in the build's list, so only the prefix rule
 * below could catch it.
 */
const VERSION_JSON = '/_app/version.json';

/**
 * The device worker's pull. Never the device's (it is how the copy fills),
 * never a `write`: a write posts `changed`, which asks for a pull (a loop),
 * and offline `needs-connection` (a toast on every pull).
 */
const PULL = '/api/sync/pull';

/**
 * Raw-body uploads (XHR with upload progress). Through a `respondWith` the
 * browser hands the body to the service worker at once and the bar jumps to
 * the end, then sits: the progress the components promise (an 8 MiB chunk on
 * mobile data takes tens of seconds) and a 95 MiB body through the worker's
 * memory are both lost. Offline they fail as they always have ("Upload failed
 * — check the connection").
 */
const UPLOADS: [method: string, pattern: RegExp][] = [
	['PUT', routePattern('/api/lessons/[id]/videos/[uploadId]')],
	['POST', routePattern('/api/figures/[id]/recordings')],
	['POST', routePattern('/api/songs')]
];

/** Every GET endpoint (`+server`), device or network: what a navigation there gets is not a page. */
const ENDPOINTS = [...DEVICE_ENDPOINTS, ...NETWORK_ENDPOINTS].map(routePattern);

export function swRoute(
	method: string,
	url: URL,
	mode: RequestMode,
	origin: string,
	precached: ReadonlySet<string>
): SwRoute {
	if (url.origin !== origin) return 'pass';
	const path = url.pathname;
	const read = method === 'GET' || method === 'HEAD';
	if (path === VERSION_JSON) return 'pass';
	if (path === PULL) return 'pass';
	if (UPLOADS.some(([m, re]) => m === method && re.test(path))) return 'pass';
	if (
		method === 'GET' &&
		(precached.has(path) || path.startsWith('/_app/') || path.startsWith('/_device/'))
	) {
		return 'precached';
	}
	if (mode === 'navigate') {
		// A page load gets the network, then the shell. A form posted without
		// JavaScript (sign in, /logout) and an endpoint opened in a tab (an APK, a
		// video, /health) are no page: the shell would be the wrong answer, so the
		// browser has them as without a service worker.
		if (method !== 'GET' || ENDPOINTS.some((re) => re.test(path))) return 'pass';
		return 'navigate';
	}
	if (method === 'GET' && deviceAnswers(method, url)) return 'device-read';
	if (read) return 'pass';
	return 'write';
}

/** An answer that is the network failing, not the server: a bad gateway, a timeout, Cloudflare's 52x. */
export function isNetworkFailure(res: Response): boolean {
	const s = res.status;
	return s === 502 || s === 503 || s === 504 || (s >= 520 && s <= 530);
}

/** The prefix of every cache this app's service worker makes: `salsa-<version>`. */
export const CACHE_PREFIX = 'salsa-';

const versionOf = (key: string): number => Number(key.slice(CACHE_PREFIX.length));

/**
 * The caches to delete once a build takes over: every `salsa-*` but this
 * build's and the newest other one. The build before stays, so a page still
 * open on it finds its chunks offline; after a rollback that is the newer one.
 * Versions are SvelteKit's build times, compared as numbers.
 */
export function cachesToDelete(keys: readonly string[], current: string): string[] {
	const others = keys
		.filter((k) => k.startsWith(CACHE_PREFIX) && k !== current)
		.sort((a, b) => versionOf(b) - versionOf(a) || (a < b ? 1 : -1));
	return others.slice(1);
}

/** A write's answer that asks the page's device to pull: the server took it (or redirected). */
export function postsChanged(res: { status: number; type: ResponseType }): boolean {
	return res.type === 'opaqueredirect' || (res.status > 0 && res.status < 400);
}

/**
 * What the service worker knows of each page's device: its state (`SwIn`), and
 * whether a write from that page has reached the server since the device last
 * pulled (`dirty`). A read is timed out only for a ready device with nothing
 * unpulled: otherwise the device would answer from before the person's own
 * save and the save would seem to vanish, online. A dirty page's reads wait
 * for the network as long as it takes; on a real failure the device may still
 * answer. Lost when the browser stops the service worker: every page then
 * reads as unknown, untimed, until it says its state again.
 */
export class DeviceClients {
	#states = new Map<string, DeviceState | 'off'>();
	#dirty = new Set<string>();

	setState(id: string, state: DeviceState | 'off'): void {
		this.#states.set(id, state);
	}

	/** A write from this page reached the server. */
	changed(id: string): void {
		this.#dirty.add(id);
	}

	/** This page's device has pulled since its last write. */
	pulled(id: string): void {
		this.#dirty.delete(id);
	}

	/** How long a read from this page waits for the network before the device answers; null: as long as it takes. */
	timeoutFor(id: string): number | null {
		return this.#states.get(id) === 'ready' && !this.#dirty.has(id) ? NETWORK_TIMEOUT_MS : null;
	}

	/** Forget the pages that are gone. */
	sweep(open: ReadonlySet<string>): void {
		for (const id of this.#states.keys()) if (!open.has(id)) this.#states.delete(id);
		for (const id of this.#dirty) if (!open.has(id)) this.#dirty.delete(id);
	}

	get size(): number {
		return new Set([...this.#states.keys(), ...this.#dirty]).size;
	}
}

/**
 * The install's work, and on any failure this build's cache deleted before
 * the failure goes on: a half-filled `salsa-<version>` would otherwise be kept
 * by a later build as the newest other (`cachesToDelete`), deleting the cache
 * of the build open pages run.
 */
export async function installOrClean(
	cache: string,
	remove: (name: string) => Promise<boolean>,
	work: () => Promise<void>
): Promise<void> {
	try {
		await work();
	} catch (e) {
		await remove(cache).catch(() => false);
		throw e;
	}
}
