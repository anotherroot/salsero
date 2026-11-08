/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/*
 * The service worker (offline phase 2). Online nothing changes: every page,
 * read and write goes to the network first. Only when the network fails does
 * a page load get the cached shell (`/shell`), a read the device's copy (via
 * the page that sent it, which relays to its device worker), and a write
 * "Needs a connection". What goes where is `swRoute` ($lib/offline/sw-route).
 *
 * Registered by the page (`$lib/offline/device.svelte.ts`), never in dev
 * (`serviceWorker.register: false` in vite.config.ts).
 */
import { build, files, prerendered, version } from '$service-worker';
import { offlineRead, offlineWrite, type OfflineAnswer } from '$lib/offline/needs-connection';
import type { SwIn, SwOut, WireFallback, WireRequest, WireResponse } from '$lib/offline/protocol';
import {
	CACHE_PREFIX,
	DeviceClients,
	NETWORK_TIMEOUT_MS,
	SHELL,
	cachesToDelete,
	installOrClean,
	isNetworkFailure,
	postsChanged,
	tellsNeedsConnection,
	swRoute,
	type SwRoute
} from '$lib/offline/sw-route';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `${CACHE_PREFIX}${version}`;
const PRECACHED: ReadonlySet<string> = new Set([...build, ...files, ...prerendered]);
/** How long a read waits for its page's device (which may still be starting: its own limit is 10 s). */
const DEVICE_REPLY_LIMIT_MS = 15_000;
const NULL_BODY = new Set([101, 204, 205, 304]);

/**
 * Each page's device, as it last told us (`SwIn`), and whether it has pulled
 * since that page's last write (`DeviceClients`). Lost when the browser stops
 * this worker; a page not in it reads as no device, so its reads wait for the
 * network as long as it takes, as they would without a service worker.
 */
const devices = new DeviceClients();

sw.addEventListener('install', (event) => {
	// A failed install deletes its half-filled cache (`installOrClean`).
	event.waitUntil(
		installOrClean(
			CACHE,
			(name) => caches.delete(name),
			async () => {
				const cache = await caches.open(CACHE);
				// Hashed names: the HTTP cache may serve them. Static files keep their
				// names across builds, so they are revalidated.
				await cache.addAll(build);
				await cache.addAll(
					[...files, ...prerendered].map((f) => new Request(f, { cache: 'no-cache' }))
				);
				// The device worker's bundle, so an offline reload can still start it.
				const list = await fetch(`/_device/${version}/files.json`, { cache: 'no-store' });
				if (!list.ok) throw new Error(`device files: ${list.status}`);
				await cache.addAll((await list.json()) as string[]);
				// The shell, signed out (no cookie, so no hook sends it elsewhere): the
				// same page at any path. A redirect would cache the wrong page.
				const shell = await fetch(SHELL, {
					redirect: 'error',
					credentials: 'omit',
					cache: 'no-store'
				});
				if (!shell.ok) throw new Error(`shell: ${shell.status}`);
				await cache.put(SHELL, shell);
				// Phase 2 queues nothing, so a new build takes over at once.
				await sw.skipWaiting();
			}
		)
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			try {
				await sw.registration.navigationPreload?.enable();
			} catch (e) {
				console.warn('[sw] no navigation preload', e);
			}
			const keys = await caches.keys();
			await Promise.all(cachesToDelete(keys, CACHE).map((k) => caches.delete(k)));
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('message', (event) => {
	const data = event.data as SwIn | undefined;
	const source = event.source as Client | null;
	if (!source) return;
	if (data?.type === 'device-state')
		devices.setState(source.id, data.state, data.unpulledSince ?? null);
	else if (data?.type === 'device-pulled') devices.pulled(source.id, data.startedAt);
	else return;
	// Closed pages leave their entries behind; sweep now and then.
	if (devices.size > 20) {
		event.waitUntil(
			sw.clients
				.matchAll({ includeUncontrolled: true })
				.then((open) => devices.sweep(new Set(open.map((c) => c.id))))
		);
	}
});

sw.addEventListener('fetch', (event) => {
	const request = event.request;
	let route: SwRoute;
	try {
		route = swRoute(
			request.method,
			new URL(request.url),
			request.mode,
			sw.location.origin,
			PRECACHED
		);
	} catch (e) {
		console.error('[sw] routing failed', e);
		return;
	}
	if (route === 'pass') return;
	event.respondWith(
		answer(route, event).catch((e) => {
			// Never worse than no service worker.
			console.error('[sw]', route, request.url, e);
			return fetch(request);
		})
	);
});

function answer(route: Exclude<SwRoute, 'pass'>, event: FetchEvent): Promise<Response> {
	switch (route) {
		case 'precached':
			return precached(event.request);
		case 'navigate':
			return navigate(event);
		case 'device-read':
			return deviceRead(event);
		case 'network-read':
			return networkRead(event.request);
		case 'write':
			return write(event);
	}
}

/** This build's copy first (a static file may differ from the build before), then any, then the network. */
async function precached(request: Request): Promise<Response> {
	const own = await (await caches.open(CACHE)).match(request);
	return own ?? (await caches.match(request)) ?? fetch(request);
}

async function cachedShell(): Promise<Response | undefined> {
	return (await (await caches.open(CACHE)).match(SHELL)) ?? (await caches.match(SHELL));
}

/** The network took too long; unlike a rejection, it may still answer. */
class TooSlow extends Error {}

/** `promise`, or `TooSlow` after `ms`; `null` waits as long as it takes. */
function within<T>(promise: Promise<T>, ms: number | null): Promise<T> {
	if (ms === null) return promise;
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new TooSlow(`no answer in ${ms} ms`)), ms);
		promise.then(
			(v) => (clearTimeout(timer), resolve(v)),
			(e) => (clearTimeout(timer), reject(e))
		);
	});
}

/**
 * A page load: the network (the navigation preload when there is one), else
 * the shell, which draws the page from the device. With no shell cached the
 * network has all the time it needs, as without a service worker.
 */
async function navigate(event: FetchEvent): Promise<Response> {
	const shell = await cachedShell();
	const preload = event.preloadResponse as Promise<Response | undefined> | undefined;
	if (navigator.onLine || !shell) {
		const network = (async () => (await preload) ?? fetch(event.request))();
		try {
			const res = await within(network, shell ? NETWORK_TIMEOUT_MS : null);
			if (!shell || !isNetworkFailure(res)) return res;
		} catch (e) {
			if (!shell) {
				console.warn('[sw] offline, and no shell cached', e);
				return new Response('Offline', {
					status: 503,
					headers: { 'content-type': 'text/plain; charset=utf-8' }
				});
			}
		}
	} else {
		// Unused: settle it so the browser does not warn of a cancelled preload.
		event.waitUntil(Promise.resolve(preload).catch(() => undefined));
	}
	return shell;
}

/**
 * A read the device can answer: the network first. When its page's device is
 * ready, with every write of that page pulled (`DeviceClients`), the network
 * gets NETWORK_TIMEOUT_MS; then whichever answers first, the
 * device or a late network, wins. A network that fails outright goes to the
 * device alone (it may still be starting). Neither: "needs a connection".
 */
async function deviceRead(event: FetchEvent): Promise<Response> {
	const request = event.request;
	const network = fetch(request);
	let late: Promise<Response> | null = null;
	try {
		const res = await within(network, devices.timeoutFor(event.clientId));
		if (!isNetworkFailure(res)) return res;
	} catch (e) {
		if (e instanceof TooSlow) {
			late = network.then((res) => (isNetworkFailure(res) ? Promise.reject(res) : res));
		}
	}
	const device = viaDevice(request, event.clientId).then((res) => res ?? Promise.reject());
	try {
		return await Promise.any(late ? [device, late] : [device]);
	} catch {
		return offline(offlineRead());
	}
}

/**
 * A network page's data: the network, as long as it takes; when it cannot be
 * reached, "needs a connection", which the error page draws as offline.
 */
async function networkRead(request: Request): Promise<Response> {
	try {
		return await fetch(request);
	} catch (e) {
		console.warn('[sw] a network page could not reach the server', request.url, e);
		return offline(offlineRead());
	}
}

/** Ask the page that sent this request to have its device answer it; null when it cannot. */
async function viaDevice(request: Request, clientId: string): Promise<Response | null> {
	const client = clientId ? await sw.clients.get(clientId) : undefined;
	// Only a page relays to a device. The device worker's own requests never come
	// here (swRoute: its pull passes, its files are precached), and must not.
	if (!client || client.type !== 'window') return null;
	const channel = new MessageChannel();
	const reply = new Promise<WireResponse | WireFallback | null>((resolve) => {
		const timer = setTimeout(() => resolve(null), DEVICE_REPLY_LIMIT_MS);
		channel.port1.onmessage = (e: MessageEvent<WireResponse | WireFallback>) => {
			clearTimeout(timer);
			resolve(e.data);
		};
	});
	const wire: WireRequest = {
		url: request.url,
		method: request.method,
		headers: [...request.headers],
		body: null
	};
	client.postMessage({ type: 'device-fetch', request: wire } satisfies SwOut, [channel.port2]);
	const r = await reply;
	channel.port1.close();
	if (!r || 'fallback' in r) return null;
	return new Response(NULL_BODY.has(r.status) ? null : r.body, {
		status: r.status,
		headers: r.headers
	});
}

/**
 * A write: the network, never timed out. Reaching the server asks the page's
 * device to pull soon; not reaching it changes nothing and says so (the page's
 * toast, in the person's language: this worker has none).
 */
async function write(event: FetchEvent): Promise<Response> {
	const request = event.request;
	const isAction = request.headers.has('x-sveltekit-action');
	const to = event.clientId || event.resultingClientId;
	let res: Response;
	try {
		res = await fetch(request);
	} catch (e) {
		console.warn('[sw] a write could not reach the server', request.url, e);
		if (tellsNeedsConnection(request.headers)) tell(to, { type: 'needs-connection' });
		return offline(offlineWrite(isAction, 'Needs a connection.'));
	}
	if (postsChanged(res)) {
		// Before the answer reaches the page: the reads its save sets off (the
		// action's invalidation) must not be timed out onto a copy without it.
		if (to) devices.changed(to, Date.now());
		tell(to, { type: 'changed' });
	}
	return res;
}

function tell(clientId: string, message: SwOut): void {
	if (!clientId) return;
	sw.clients
		.get(clientId)
		.then((client) => client?.postMessage(message))
		.catch((e) => console.warn('[sw] could not tell the page', e));
}

function offline(a: OfflineAnswer): Response {
	return new Response(a.body, { status: a.status, headers: a.headers });
}
