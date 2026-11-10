/*
 * What the service worker does with a request (offline phase 2). PURE,
 * client-safe: src/service-worker.ts asks it, the spec pins it. Since device
 * first (2026-11-10) a read the device can answer goes to it first, online
 * too (`readPlan`); page loads and writes are as before.
 */
import type { DeviceState } from './protocol';
import {
	DEVICE_ENDPOINTS,
	MEDIA_ENDPOINTS,
	NETWORK_ENDPOINTS,
	deviceAnswers,
	isNetworkPage,
	routePattern
} from './routes';

/**
 * - `precached`: the build, its static files and the device bundle, from the cache;
 * - `navigate`: a page load, the network first, else the cached shell;
 * - `device-read`: the network first, else the device's copy;
 * - `network-read`: a network page's data (`NETWORK_PAGES`): the network, never
 *   timed; offline "needs a connection", which the error page draws as offline;
 * - `media`: song audio, count takes (offline phase 4a), lesson videos and
 *   recordings (4b): the phone's file first, with Range, else the network;
 * - `write`: the network only; offline it gets "Needs a connection";
 * - `pass`: the service worker stays out of it (no `respondWith`).
 */
export type SwRoute =
	'precached' | 'navigate' | 'device-read' | 'network-read' | 'media' | 'write' | 'pass';

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
const PUSH = '/api/sync/push';

/**
 * The AI connector and its sign-in (docs/superpowers/specs/2026-11-09-ai-connector-design.md):
 * never the device's, never the shell. The consent page must be the server's own answer.
 */
const CONNECTOR = (path: string) =>
	path === '/mcp' || path.startsWith('/oauth/') || path.startsWith('/.well-known/oauth-');

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
	['PUT', routePattern('/api/figures/[id]/recordings/[uploadId]')],
	['PUT', routePattern('/api/recordings/[id]/file/[uploadId]')],
	['PUT', routePattern('/api/lesson-videos/[id]/file/[uploadId]')],
	['POST', routePattern('/api/figures/[id]/recordings')],
	['POST', routePattern('/api/songs')]
];

/** A page's data (`+page.server` / `+layout.server` loads), as SvelteKit's client asks for it. */
const DATA = '/__data.json';

/** Every GET endpoint (`+server`), device or network: what a navigation there gets is not a page. */
const ENDPOINTS = [...DEVICE_ENDPOINTS, ...MEDIA_ENDPOINTS, ...NETWORK_ENDPOINTS].map(routePattern);
const MEDIA = MEDIA_ENDPOINTS.map(routePattern);

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
	if (path === PULL || path === PUSH) return 'pass';
	if (CONNECTOR(path)) return 'pass';
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
	if (method === 'GET' && MEDIA.some((re) => re.test(path))) return 'media';
	if (method === 'GET' && deviceAnswers(method, url)) return 'device-read';
	// A network page drawn by the shell offline asks for its data too: a failed
	// fetch there would be an unexpected error, and the page would draw without
	// the root layout's data. "Needs a connection" is an error page it can draw.
	if (method === 'GET' && path.endsWith(DATA)) return 'network-read';
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

/**
 * Where the service worker keeps the outbox's last word (`/__outbox-state`:
 * `{ waiting, epochs }`) across its own restarts. No `salsa-` prefix, so
 * `cachesToDelete` never takes it.
 */
export const OUTBOX_STATE_CACHE = 'outbox-state';
export const OUTBOX_STATE_KEY = '/__outbox-state';

/**
 * Whether a new build waits before taking over (offline phase 3): while the
 * outbox holds entries of an older build and the device is online, so they can
 * still be sent and land. Offline it never waits: they would wait forever.
 */
export function holdsUpdate(epochs: readonly number[], current: number, online: boolean): boolean {
	return online && epochs.some((e) => e < current);
}

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

/**
 * Marks a write the person did not ask for (`backgroundWrite`: an open, a
 * remembered practice). When it cannot reach the server it still changes
 * nothing, but the page shows no "Needs a connection" for it: the person did
 * nothing that failed.
 */
export const QUIET_HEADER = 'x-salsa-quiet';

/** Whether a write that could not reach the server is the person's, to say so (not `QUIET_HEADER`). */
export function tellsNeedsConnection(headers: Headers): boolean {
	return !headers.has(QUIET_HEADER);
}

/** A write's answer that asks the page's device to pull: the server took it (or redirected). */
export function postsChanged(res: { status: number; type: ResponseType }): boolean {
	return res.type === 'opaqueredirect' || (res.status > 0 && res.status < 400);
}

/**
 * What the service worker knows of each page's device: its state (`SwIn`), and
 * since when a save from that page is not yet in the device's copy (`dirtyAt`,
 * this worker's clock when the write's answer came, or the page's own
 * `unpulledSince`). A read is timed out only for a ready device with nothing
 * unpulled: otherwise the device would answer from before the person's own
 * save and the save would seem to vanish, online. A dirty page's reads wait
 * for the network as long as it takes; on a real failure the device may still
 * answer. Only a pull whose request left at or after `dirtyAt` clears it
 * (`pullCovers`), whatever order the messages come in. Lost when the browser
 * stops the service worker; every page then reads as unknown, untimed, until
 * its next state message, which carries its unpulled save again.
 */
export class DeviceClients {
	#states = new Map<string, DeviceState | 'off'>();
	#dirtyAt = new Map<string, number>();
	/** Outbox entries waiting, as the page's last state said (offline phase 3). */
	#waiting = new Map<string, number>();
	/** The newest outbox entry the page's last state carried. */
	#seqSeen = new Map<string, number>();
	/** The newest entry a device write of this page answered with (x-salsa-outbox). */
	#wroteSeq = new Map<string, number>();

	/** The page's state, its own note of an unpulled save (null: none it knows of), and its outbox. */
	setState(
		id: string,
		state: DeviceState | 'off',
		unpulledSince: number | null,
		waiting?: number,
		outboxSeq?: number
	): void {
		this.#states.set(id, state);
		// Never clears: a write's mark here may be newer than the page has heard of.
		if (unpulledSince !== null) this.changed(id, unpulledSince);
		if (waiting !== undefined) this.#waiting.set(id, waiting);
		if (outboxSeq !== undefined) this.#seqSeen.set(id, outboxSeq);
	}

	/** A write of this page was answered by its device, as outbox entry `seq`. */
	wrote(id: string, seq: number): void {
		this.#wroteSeq.set(id, Math.max(this.#wroteSeq.get(id) ?? 0, seq));
	}

	/**
	 * Whether this page's reads come from its device first: the server lacks the
	 * device's changes while any waits, or while a write's entry is newer than
	 * the page's last word on its outbox.
	 */
	readsFromDevice(id: string): boolean {
		if ((this.#waiting.get(id) ?? 0) > 0) return true;
		return (this.#wroteSeq.get(id) ?? 0) > (this.#seqSeen.get(id) ?? 0);
	}

	/**
	 * Whether this page's reads go to its device first (device first): its device
	 * is ready, and no save of the page went to the server since its last pull
	 * (a group's row online), or the copy would draw the page from before it.
	 */
	readsDeviceFirst(id: string, copy = false): boolean {
		if (this.#dirtyAt.has(id)) return false;
		const state = this.#states.get(id);
		if (state === 'ready') return true;
		// A page just opened (the shell drawing the first page of an open, step 2): its device is
		// still starting, and a copy is on this browser, so the read waits for it.
		return copy && state !== 'empty' && state !== 'failed';
	}

	/**
	 * Whether a write from this page tries its device first: yes unless the page
	 * said its device is anything but ready. A page the service worker knows
	 * nothing of (it was stopped and started again) is tried: the device falls
	 * back itself when it cannot take the write.
	 */
	writesToDevice(id: string): boolean {
		const state = this.#states.get(id);
		return state === undefined || state === 'ready';
	}

	/** A save from this page reached the server at `at`. The mark only moves later. */
	changed(id: string, at: number): void {
		this.#dirtyAt.set(id, unpulledAfterSave(this.#dirtyAt.get(id) ?? null, at));
	}

	/** This page's device pulled, its request having left at `startedAt`. */
	pulled(id: string, startedAt: number): void {
		const left = unpulledAfterPull(this.#dirtyAt.get(id) ?? null, startedAt);
		if (left === null) this.#dirtyAt.delete(id);
	}

	/** How long a read from this page waits for the network before the device answers; null: as long as it takes. */
	timeoutFor(id: string): number | null {
		return this.#states.get(id) === 'ready' && !this.#dirtyAt.has(id) ? NETWORK_TIMEOUT_MS : null;
	}

	/**
	 * Whether a page load could be drawn from a copy now: some open page (`open`,
	 * the window clients) has a ready device with nothing unpulled. A closed
	 * page's entry is stale, and a device still starting, or behind its page's
	 * save, would draw nothing, or the page from before it.
	 */
	anyAnswers(open: ReadonlySet<string>): boolean {
		for (const [id, state] of this.#states) {
			if (state === 'ready' && open.has(id) && !this.#dirtyAt.has(id)) return true;
		}
		return false;
	}

	/** Forget the pages that are gone. */
	sweep(open: ReadonlySet<string>): void {
		for (const map of [this.#states, this.#dirtyAt, this.#waiting, this.#seqSeen, this.#wroteSeq]) {
			for (const id of map.keys()) if (!open.has(id)) map.delete(id);
		}
	}

	get size(): number {
		return new Set([...this.#states.keys(), ...this.#dirtyAt.keys()]).size;
	}
}

/**
 * How long a page load waits for the network before the cached shell draws it
 * from the device; null: as long as it takes, as without a service worker.
 * Timed only when the shell is cached and a device could answer
 * (`DeviceClients.anyAnswers`), and never for a network page: the shell
 * cannot draw it, so a slow sign-in or admin page would be lost for an offline
 * screen. A rejection or a 502/503/504/52x still gets the shell.
 */
export function navigationTimeout(
	path: string,
	can: { device: boolean; shell: boolean }
): number | null {
	return can.shell && can.device && !isNetworkPage(path) ? NETWORK_TIMEOUT_MS : null;
}

/**
 * Which pages hear that a write reached the server (`changed`): every open
 * page, and the writer even before it is listed (a page still loading). The
 * tab whose worker holds the copy may not be the one that wrote; each page
 * asks its own worker to pull, and only the one holding the copy does.
 * `DeviceClients` marks only the writer unpulled.
 */
export function changedTo(writer: string, windows: readonly string[]): string[] {
	const to = new Set(windows);
	if (writer) to.add(writer);
	return [...to];
}

/** Since when a save is unpulled, after another save at `at`: the latest one. */
export function unpulledAfterSave(since: number | null, at: number): number {
	return since === null ? at : Math.max(since, at);
}

/** Since when a save is unpulled, after a pull that left at `startedAt`: null once it covers it. */
export function unpulledAfterPull(since: number | null, startedAt: number): number | null {
	return since === null || pullCovers(startedAt, since) ? null : since;
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

/**
 * Whether a pull holds the page's last write: its request left (`startedAt`,
 * the worker's clock, which the page shares) no earlier than the page saw that
 * write land (`changedAt`, when `changed` came). The write committed before
 * its answer came back, so the server read after it. A pull already out when
 * the write landed may not hold it, and must not clear the page's dirty mark.
 */
export function pullCovers(startedAt: number, changedAt: number): boolean {
	return startedAt >= changedAt;
}

/**
 * Where a read the device can answer goes first (device first):
 * - `device`: changes wait in the outbox, so only the device has them (phase 3);
 * - `device-then-network`: the page's device is ready with nothing unpulled:
 *   online too, the network only when the device fails (`deviceFailed`);
 * - `network-then-device`: a network-first page (`NETWORK_FIRST_PAGES`), or a
 *   device not ready or behind its page's save: phase 2's timed race.
 */
export type ReadPlan = 'device' | 'device-then-network' | 'network-then-device';

export function readPlan(a: {
	networkFirst: boolean;
	fromDevice: boolean;
	deviceFirst: boolean;
}): ReadPlan {
	if (a.fromDevice) return 'device';
	if (a.networkFirst) return 'network-then-device';
	return a.deviceFirst ? 'device-then-network' : 'network-then-device';
}

/**
 * The device could not answer, its own code failed (a 5xx), or it has no such
 * row (a 404: the copy may be behind, as for a link shared before the pull): the
 * network answers instead. A refusal (a 403) is the page's own answer and stands.
 */
export function deviceFailed(res: Response | null): boolean {
	return res === null || res.status >= 500 || res.status === 404;
}

/**
 * Where a page load goes (device first, step 2): the cached shell, which
 * draws the page from the device, when a copy is on this browser (`copy`, the
 * service worker's mark), while changes wait, or offline; the network for a
 * network page, with no copy, or with no shell cached.
 */
export function navigatePlan(a: {
	shell: boolean;
	copy: boolean;
	networkPage: boolean;
	waiting: number;
	online: boolean;
}): 'shell' | 'network' {
	if (!a.shell) return 'network';
	if (a.waiting > 0 || !a.online) return 'shell';
	return a.copy && !a.networkPage ? 'shell' : 'network';
}

const SIGNS = [/^\/login\/?$/, /^\/join\/?$/, /^\/g\/[^/]+\/?$/, /^\/logout\/?$/];

/**
 * Whether a request may change who is signed in on this browser (device first,
 * step 2): a post to sign in, join, take a group invite or sign out. The
 * service worker then forgets that a copy is here, so the next page load asks
 * the server, which says who it is, and the device follows (another person:
 * a wiped copy). Forgetting on the attempt is safe: the copy's next ready says
 * so again.
 */
export function clearsCopy(method: string, path: string): boolean {
	return method.toUpperCase() === 'POST' && SIGNS.some((re) => re.test(path));
}
