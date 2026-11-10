/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/*
 * The service worker. A read the device can answer goes to the device's copy
 * first, online too (device first, 2026-11-10), via the page that sent it,
 * which relays to its device worker; the network answers when the device is
 * not ready, fails, or is behind a save the page sent to the server, and for
 * the network-first pages (Settings). A page load gets the network, and the
 * cached shell (`/shell`) when the network fails. Since offline phase 3 a write the device can make goes to it first,
 * online too, and its outbox carries it to the server; while the outbox
 * waits, reads come from the device, which has what the server does not yet.
 * Anything else goes to the network, and offline says "Needs a connection".
 * What goes where is `swRoute` ($lib/offline/sw-route).
 *
 * Registered by the page (`$lib/offline/device.svelte.ts`), never in dev
 * (`serviceWorker.register: false` in vite.config.ts).
 */
import { build, files, prerendered, version } from '$service-worker';
import { offlineRead, offlineWrite, type OfflineAnswer } from '$lib/offline/needs-connection';
import type { SwIn, SwOut, WireFallback, WireRequest, WireResponse } from '$lib/offline/protocol';
import { PAGE_EPOCH } from '$lib/epoch';
import { isNetworkFirstPage, isNetworkPage, writeClass } from '$lib/offline/routes';
import { FROM_HEADER, rangeResponse } from '$lib/offline/media-range';
import { mediaOf, opfsMediaStore, type MediaStore } from '$lib/offline/media-store';
import { OUTBOX_HEADER } from '$lib/sync/outbox';
import {
	CACHE_PREFIX,
	DeviceClients,
	OUTBOX_STATE_CACHE,
	OUTBOX_STATE_KEY,
	holdsUpdate,
	SHELL,
	cachesToDelete,
	changedTo,
	clearsCopy,
	deviceFailed,
	navigatePlan,
	readPlan,
	installOrClean,
	isNetworkFailure,
	navigationTimeout,
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
/** A write commits on the device by this long before the limit, or not at all (then the network has it). */
const DEVICE_COMMIT_MARGIN_MS = 3_000;
const NULL_BODY = new Set([101, 204, 205, 304]);

/**
 * Each page's device, as it last told us (`SwIn`), and whether it has pulled
 * since that page's last write (`DeviceClients`). Lost when the browser stops
 * this worker; a page not in it reads as no device, so its reads wait for the
 * network as long as it takes, as they would without a service worker.
 */
const devices = new DeviceClients();

/** `copy`: this browser holds a copy (device first, step 2); absent before a page said. */
type OutboxState = { waiting: number; epochs: number[]; copy?: boolean };

/** The outbox's last word, kept across this worker's restarts. */
async function outboxState(): Promise<OutboxState> {
	try {
		const cache = await caches.open(OUTBOX_STATE_CACHE);
		const res = await cache.match(OUTBOX_STATE_KEY);
		return res ? ((await res.json()) as OutboxState) : { waiting: 0, epochs: [] };
	} catch {
		return { waiting: 0, epochs: [] };
	}
}

/** Writes one after another: two read-modify-writes at once would lose one (a sign-out's `copy: false`). */
let stateWrites: Promise<unknown> = Promise.resolve();

function keepOutboxState(next: Partial<OutboxState>): Promise<void> {
	const run = stateWrites.then(() => writeOutboxState(next));
	stateWrites = run.catch(() => {});
	return run;
}

async function writeOutboxState(next: Partial<OutboxState>): Promise<void> {
	const cache = await caches.open(OUTBOX_STATE_CACHE);
	const state = { ...(await outboxState()), ...next };
	await cache.put(OUTBOX_STATE_KEY, Response.json(state));
	// A new build that waited for older entries to be sent takes over once they are.
	if (heldInstall && !holdsUpdate(state.epochs, PAGE_EPOCH, navigator.onLine)) {
		heldInstall = false;
		await sw.skipWaiting();
	}
}

/** This build installed while the outbox held older entries, and waits for them. */
let heldInstall = false;

/** Whether this browser holds a copy, as the pages last said (null: not read from the cache yet). */
let copyKnown: boolean | null = null;

async function hasCopy(): Promise<boolean> {
	if (copyKnown === null) copyKnown = (await outboxState()).copy ?? false;
	return copyKnown;
}

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
				// A new build takes over at once, unless entries of an older one are still to
				// be sent while online: they would be refused as made by another build.
				const { epochs } = await outboxState();
				if (holdsUpdate(epochs, PAGE_EPOCH, navigator.onLine)) heldInstall = true;
				else await sw.skipWaiting();
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
	if (data?.type === 'device-state') {
		devices.setState(
			source.id,
			data.state,
			data.unpulledSince ?? null,
			data.waiting,
			data.outboxSeq
		);
		if (data.waiting !== undefined) event.waitUntil(keepOutboxState({ waiting: data.waiting }));
	} else if (data?.type === 'device-pulled') devices.pulled(source.id, data.startedAt);
	else if (data?.type === 'copy') {
		copyKnown = data.has;
		event.waitUntil(keepOutboxState({ copy: data.has }));
	} else if (data?.type === 'outbox') {
		event.waitUntil(keepOutboxState({ waiting: data.waiting, epochs: data.epochs }));
	} else return;
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
	// Who is signed in may change: the next page load asks the server (device first, step 2).
	if (clearsCopy(request.method, new URL(request.url).pathname)) {
		copyKnown = false;
		event.waitUntil(keepOutboxState({ copy: false }).catch(() => {}));
	}
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
		case 'media':
			return media(event.request);
		case 'write':
			return write(event);
	}
}

/** The media store, opened once; null where this browser has none. */
let mediaStore: Promise<MediaStore | null> | undefined;

/**
 * Song audio and count takes (offline phase 4a): the phone's file first, with
 * Range, online too (no data, no wait); else the network as before. A store
 * that fails is never worse than no store.
 */
async function media(request: Request): Promise<Response> {
	const want = mediaOf(new URL(request.url).pathname);
	if (want) {
		try {
			const store = await (mediaStore ??= opfsMediaStore());
			const held = await store?.read(want.kind, want.file);
			if (held) {
				const res = rangeResponse(held.body, request.headers.get('range'), held.mime);
				res.headers.set(FROM_HEADER, 'device');
				return res;
			}
		} catch (e) {
			console.warn('[sw] media store', e);
		}
	}
	return fetch(request);
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

/** Whether some open page's device could draw a page load now (`DeviceClients.anyAnswers`). */
async function aDeviceAnswers(): Promise<boolean> {
	try {
		const open = await sw.clients.matchAll({ type: 'window' });
		return devices.anyAnswers(new Set(open.map((c) => c.id)));
	} catch (e) {
		// Not knowing is no device: the network gets all the time it needs.
		console.warn('[sw] could not list the pages', e);
		return false;
	}
}

/**
 * A page load: the network (the navigation preload when there is one), else
 * the shell, which draws the page from the device. Timed out only when a
 * device could draw it (`navigationTimeout`); otherwise the network has all
 * the time it needs, as without a service worker, and only a failure gets
 * the shell.
 */
async function navigate(event: FetchEvent): Promise<Response> {
	const shell = await cachedShell();
	const preload = event.preloadResponse as Promise<Response | undefined> | undefined;
	// Device first (step 2): a copy on this browser draws the page, online too; so do changes
	// still on their way (the server does not have them yet), and offline.
	const plan = navigatePlan({
		shell: !!shell,
		copy: await hasCopy(),
		networkPage: isNetworkPage(new URL(event.request.url).pathname),
		waiting: (await outboxState()).waiting,
		online: navigator.onLine
	});
	if (shell && plan === 'shell') {
		event.waitUntil(Promise.resolve(preload).catch(() => undefined));
		return shell;
	}
	if (navigator.onLine || !shell) {
		const ms = navigationTimeout(new URL(event.request.url).pathname, {
			device: shell ? await aDeviceAnswers() : false,
			shell: !!shell
		});
		const network = (async () => (await preload) ?? fetch(event.request))();
		try {
			const res = await within(network, ms);
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
 * A read the device can answer, in `readPlan`'s order. Device first: the
 * page's ready device answers, and the network only when it fails. Otherwise
 * (a network-first page, a device not ready or behind its page's save) the
 * network first: when the page's device is ready with every write pulled, the
 * network gets NETWORK_TIMEOUT_MS; then whichever answers first, the device or
 * a late network, wins. A network that fails outright goes to the
 * device alone (it may still be starting). Neither: "needs a connection".
 */
async function deviceRead(event: FetchEvent): Promise<Response> {
	const request = event.request;
	const plan = readPlan({
		networkFirst: isNetworkFirstPage(new URL(request.url).pathname),
		fromDevice: devices.readsFromDevice(event.clientId),
		deviceFirst: devices.readsDeviceFirst(event.clientId, await hasCopy())
	});
	if (plan === 'device-then-network') {
		// Device first: the copy answers, online too; the network only when the device fails.
		const mine = await viaDevice(request, event.clientId);
		if (mine && !deviceFailed(mine)) return mine;
		try {
			const res = await fetch(request);
			if (!isNetworkFailure(res)) return res;
		} catch (e) {
			console.warn('[sw] the device failed and the network cannot be reached', request.url, e);
		}
		return offline(offlineRead());
	}
	// The server lacks this page's device's changes yet: the device first.
	if (plan === 'device') {
		const mine = await viaDevice(request, event.clientId);
		if (mine) return mine;
	}
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
	const method = request.method.toUpperCase();
	const wire: WireRequest = {
		url: request.url,
		method: request.method,
		headers: [...request.headers],
		// A write carries its body, and the moment after which it must not commit (offline phase 3).
		body: method === 'GET' || method === 'HEAD' ? null : await request.arrayBuffer(),
		...(method === 'GET' || method === 'HEAD'
			? {}
			: { deadline: Date.now() + DEVICE_REPLY_LIMIT_MS - DEVICE_COMMIT_MARGIN_MS })
	};
	client.postMessage({ type: 'device-fetch', request: wire } satisfies SwOut, [channel.port2]);
	const r = await reply;
	channel.port1.close();
	if (!r || 'fallback' in r) return null;
	const res = new Response(NULL_BODY.has(r.status) ? null : r.body, {
		status: r.status,
		headers: r.headers
	});
	// Who answered, for the walk and for debugging (device first): the phone's copy.
	res.headers.set(FROM_HEADER, 'device');
	return res;
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
	// A write the device can make goes to it first, online too: its outbox sends it on.
	const cls = writeClass(request.method, new URL(request.url));
	if (
		(cls === 'device' || cls === 'queued') &&
		event.clientId &&
		devices.writesToDevice(event.clientId)
	) {
		const mine = await viaDevice(request.clone(), event.clientId);
		if (mine) {
			const seq = Number(mine.headers.get(OUTBOX_HEADER));
			if (seq > 0) devices.wrote(event.clientId, seq);
			return mine;
		}
	}
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
		event.waitUntil(tellEveryPage(to, { type: 'changed' }));
	}
	return res;
}

/** `changedTo`: every open page, the writer too. */
async function tellEveryPage(writer: string, message: SwOut): Promise<void> {
	try {
		const open = await sw.clients.matchAll({ type: 'window' });
		const ids = changedTo(
			writer,
			open.map((c) => c.id)
		);
		for (const id of ids) tell(id, message);
	} catch (e) {
		console.warn('[sw] could not tell the pages', e);
		tell(writer, message);
	}
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
