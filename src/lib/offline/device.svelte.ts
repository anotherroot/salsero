/*
 * The page side of the device (offline phase 2): registers the service
 * worker, starts the device worker (`/_device/<version>/worker.js`), relays the
 * service worker's `device-fetch` to it, and asks it to pull. A build only:
 * in dev there is no service worker and no device.
 *
 * The service worker cannot reach a dedicated worker, so every request the
 * device answers comes through the page that owns it, with a reply port the
 * worker answers on.
 *
 * Offline phase 3: the page also knows the device's outbox (`sync`), tells the
 * service worker when changes wait, and serves the Sync page's calls. A tab
 * whose worker waits for the lock reaches the owning tab's device through a
 * BroadcastChannel relay, and shows the owner's state.
 */
import { dev, version } from '$app/environment';
import type {
	DeviceIn,
	DeviceOut,
	DeviceState,
	OutboxItem,
	OutboxSummary,
	SwIn,
	SwOut,
	WireFallback,
	WireResponse
} from './protocol';
import { unpulledAfterPull, unpulledAfterSave } from './sw-route';
import { createRelay } from './relay';
import { graceEndsAt } from '$lib/sync/status';
import { refreshWhenSettled } from '$lib/sheets/history.svelte';

/** How long a relayed read waits, from the worker's start, for the device to be ready. */
export const DEVICE_START_LIMIT_MS = 10_000;
/** A pull this often while the page is open. */
export const PULL_EVERY_MS = 300_000;
/** A write reached the server: pull this long after the last one. */
const PULL_AFTER_WRITE_MS = 1000;

declare global {
	interface Window {
		/** The device's state and how many pulls have landed, for the browser walk (scripts/offline). */
		__device?: { state: DeviceState | 'off'; pulls: number; outbox: OutboxSummary | null };
	}
}

/** The device's state on this page; `off` until its worker starts (and for good in dev). */
export const device = $state<{ state: DeviceState | 'off' }>({ state: 'off' });

/**
 * The outbox as this page knows it (its own device's, or the owning tab's), and
 * a clock the band reads: `now` moves when a waiting change's grace ends.
 */
export const sync = $state<{ summary: OutboxSummary | null; now: number }>({
	summary: null,
	now: 0
});

/** Whether the device answers reads on this page now. */
export function deviceReady(): boolean {
	return device.state === 'ready';
}

let started = false;
let worker: Worker | null = null;
/** This page's own worker's state; `device.state` shows the owning tab's while it waits. */
let own: DeviceState | 'off' = 'off';
let relayTo: ReturnType<typeof createRelay> | null = null;
let graceTimer: ReturnType<typeof setTimeout> | undefined;
/** Who the server says is signed in on this page (`setPerson`); undefined: not known yet. */
let person: string | null | undefined = undefined;
let workerStartedAt = 0;
let pullTimer: ReturnType<typeof setTimeout> | undefined;
/** Pulls landed on this page (`window.__device`). */
let pulls = 0;
/**
 * When this page last saved something its device has not pulled yet (a write
 * the service worker said reached the server, or an upload, `noteSaved`);
 * null: nothing. Sent with every state message, so a service worker that
 * restarted or was replaced since still keeps this page's reads untimed.
 */
let unpulledSince: number | null = null;
/** Relayed reads waiting for the device's state to settle. */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- callbacks, never drawn
const waiting = new Set<() => void>();

function setState(state: DeviceState | 'off'): void {
	own = state;
	showState();
	if (state !== 'waiting') relayTo?.announce(state as DeviceState, sync.summary);
}

/** What this page shows: its own state, or the owning tab's while its own waits for the lock. */
function showState(): void {
	const owner = own === 'waiting' ? relayTo?.owner() : null;
	device.state = owner ? owner.state : own;
	if (owner) setSummary(owner.summary);
	window.__device = { state: device.state, pulls, outbox: sync.summary };
	tellServiceWorker();
	for (const wake of [...waiting]) wake();
}

/** The service worker keeps each page's state: a read waits for the network less when the device is ready. */
function tellServiceWorker(): void {
	const message: SwIn = {
		type: 'device-state',
		state: device.state,
		unpulledSince,
		waiting: sync.summary?.waiting ?? 0,
		outboxSeq: sync.summary?.seq ?? 0
	};
	navigator.serviceWorker.controller?.postMessage(message);
}

/** The outbox's newest word: drawn, sent to the service worker, and the band's clock set for the grace. */
function setSummary(summary: OutboxSummary | null): void {
	sync.summary = summary;
	sync.now = Date.now();
	if (window.__device) window.__device.outbox = summary;
	clearTimeout(graceTimer);
	const at = graceEndsAt(summary, sync.now);
	if (at !== null) graceTimer = setTimeout(() => (sync.now = Date.now()), at - sync.now + 10);
}

function onOutbox(summary: OutboxSummary): void {
	setSummary(summary);
	relayTo?.announce(own as DeviceState, summary);
	const message: SwIn = { type: 'outbox', waiting: summary.waiting, epochs: summary.epochs };
	navigator.serviceWorker.controller?.postMessage(message);
	void navigator.serviceWorker
		.getRegistration()
		.then((r) => r?.waiting?.postMessage(message))
		.catch(() => {});
	tellServiceWorker();
}

/** Asks this page's own worker on a reply port; null without one. */
function askWorker(message: DeviceIn): Promise<unknown> | null {
	if (!worker || own !== 'ready') return null;
	const w = worker;
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = (e) => {
			channel.port1.close();
			resolve(e.data);
		};
		w.postMessage(message, [channel.port2]);
	});
}

/** The device's answer to a Sync-page call: this page's own worker, or the owning tab's through the relay. */
function ask(message: DeviceIn): Promise<unknown> {
	return askWorker(message) ?? relayTo?.ask(message) ?? Promise.resolve(null);
}

function startWorker(): Worker | null {
	if (worker || device.state === 'failed') return worker;
	workerStartedAt = Date.now();
	try {
		worker = new Worker(`/_device/${version}/worker.js`, { type: 'module' });
	} catch (e) {
		console.error('[device] the worker would not start', e);
		setState('failed');
		return null;
	}
	worker.addEventListener('message', (e: MessageEvent<DeviceOut>) => {
		if (e.data?.type === 'state') setState(e.data.state);
		else if (e.data?.type === 'pulled') pulled(e.data.startedAt, e.data.landed);
		else if (e.data?.type === 'outbox') onOutbox(e.data.summary);
	});
	if (person !== undefined)
		worker.postMessage({ type: 'person', userId: person } satisfies DeviceIn);
	worker.addEventListener('error', (e) => {
		console.error('[device] worker error', e.message, e.filename, e.lineno);
		if (device.state !== 'ready') setState('failed');
	});
	setState('waiting');
	return worker;
}

/**
 * True once the device is ready; false at once when it cannot be (failed, or
 * no copy), and once DEVICE_START_LIMIT_MS have passed since the worker started.
 */
function whenReady(): Promise<boolean> {
	return new Promise((resolve) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const check = () => {
			const s = device.state;
			const left = workerStartedAt + DEVICE_START_LIMIT_MS - Date.now();
			if (s !== 'ready' && s !== 'waiting' && s !== 'starting') return done(false);
			if (s === 'ready') return done(true);
			if (left <= 0) return done(false);
			// The limit itself: whatever the state then, ready or not.
			timer ??= setTimeout(() => done(device.state === 'ready'), left);
		};
		const done = (ok: boolean) => {
			clearTimeout(timer);
			waiting.delete(check);
			resolve(ok);
		};
		waiting.add(check);
		check();
	});
}

async function relay(message: Extract<DeviceIn, { type: 'device-fetch' }>, port: MessagePort) {
	const fallback = (reason: string) =>
		port.postMessage({ fallback: true, reason } satisfies WireFallback);
	try {
		const w = startWorker();
		if (!w) return fallback('no device worker');
		// Another tab owns the copy: ask its device through the relay.
		if (own === 'waiting' && relayTo?.owner()?.state === 'ready') {
			const answer = (await relayTo.ask({ ...message, person })) as
				WireResponse | WireFallback | null;
			if (!answer) return fallback('no tab answered');
			if ('fallback' in answer) return port.postMessage(answer);
			return port.postMessage(answer, [answer.body]);
		}
		if (!(await whenReady())) return fallback(`device ${device.state}`);
		// The page's person goes with it: the copy answers only its own person's page.
		w.postMessage({ ...message, person } satisfies DeviceIn, [port]);
	} catch (e) {
		fallback(String(e));
	}
}

/**
 * Who is signed in on this page, from the server's own answer (`pagePerson`):
 * the device wipes its copy for null and for anyone else than its person.
 * The root layout calls it on every change; undefined (not known) is never sent.
 */
export function setPerson(userId: string | null): void {
	if (userId === person) return;
	person = userId;
	worker?.postMessage({ type: 'person', userId } satisfies DeviceIn);
}

function pull(): void {
	worker?.postMessage({ type: 'pull' } satisfies DeviceIn);
}

/**
 * The device pulled, its request having left at `startedAt`. Every pull goes
 * to the service worker, which decides by its own mark whether it covers the
 * page's last save (`DeviceClients.pulled`); the page's own note clears by the
 * same rule.
 */
function pulled(startedAt: number, landed = 0): void {
	pulls += 1;
	if (window.__device) window.__device.pulls = pulls;
	// Changes went up and the server's state came back: draw it.
	if (landed > 0) void refreshWhenSettled();
	unpulledSince = unpulledAfterPull(unpulledSince, startedAt);
	const sw = navigator.serviceWorker.controller;
	sw?.postMessage({ type: 'device-pulled', startedAt } satisfies SwIn);
	// A service worker that restarted has lost the state too: say it again.
	tellServiceWorker();
}

/** A save reached the server now: note it and pull soon. */
function saved(): void {
	unpulledSince = unpulledAfterSave(unpulledSince, Date.now());
	pullSoon();
}

/**
 * An upload landed. Uploads bypass the service worker (their progress would
 * break), so it never hears of them: the page marks itself unpulled and tells
 * it, as a write's `changed` would, before the reads the upload sets off.
 */
export function noteSaved(): void {
	if (!started) return;
	saved();
	tellServiceWorker();
}

function pullSoon(): void {
	clearTimeout(pullTimer);
	pullTimer = setTimeout(pull, PULL_AFTER_WRITE_MS);
}

function onServiceWorkerMessage(e: MessageEvent<SwOut>): void {
	const message = e.data;
	if (message?.type === 'device-fetch') {
		const port = e.ports[0];
		if (port) void relay(message, port);
	} else if (message?.type === 'changed') {
		// A write from this page or another reached the server: every page asks its
		// worker to pull, and the one holding the copy does. The service worker has
		// marked the writing page already, by its own clock.
		saved();
	} else if (message?.type === 'needs-connection') {
		window.dispatchEvent(new CustomEvent('salsa:needs-connection'));
	}
}

/**
 * Starts the device on this page: the service worker registered, the worker
 * started (at once offline, else when the page is idle), the pulls scheduled.
 * Nothing in dev, nor in a browser without service workers or workers.
 */
export function startDevice(): void {
	if (started || dev || typeof window === 'undefined') return;
	if (!('serviceWorker' in navigator) || typeof Worker === 'undefined') return;
	started = true;
	window.__device = { state: device.state, pulls, outbox: sync.summary };
	try {
		const sw = navigator.serviceWorker;
		sw.addEventListener('message', onServiceWorkerMessage);
		sw.startMessages();
		// A new build's service worker took over: tell it where this page's device is.
		sw.addEventListener('controllerchange', tellServiceWorker);
		sw.register('/service-worker.js').catch((e) =>
			console.error('[device] the service worker would not register', e)
		);

		if ('BroadcastChannel' in window) {
			relayTo = createRelay({
				channel: new BroadcastChannel('salsa-device'),
				self: crypto.randomUUID(),
				// Only the tab whose worker owns the copy answers.
				answer: (m) => (own === 'ready' ? relayAnswer(m) : null),
				onState: () => {
					if (own === 'waiting') showState();
				}
			});
		}

		if (!navigator.onLine) startWorker();
		else if ('requestIdleCallback' in window)
			requestIdleCallback(() => startWorker(), { timeout: 2000 });
		else setTimeout(startWorker, 2000);

		window.addEventListener('online', pull);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') pull();
		});
		setInterval(() => {
			if (document.visibilityState === 'visible') pull();
		}, PULL_EVERY_MS);
	} catch (e) {
		console.error('[device] could not start', e);
	}
}

/** A relayed ask, answered by this page's own worker (a device-fetch on a port of its own). */
function relayAnswer(message: DeviceIn): Promise<unknown> | null {
	if (message.type !== 'device-fetch') return askWorker(message);
	if (!worker) return null;
	const w = worker;
	return new Promise((resolve) => {
		const channel = new MessageChannel();
		channel.port1.onmessage = (e) => {
			channel.port1.close();
			resolve(e.data);
		};
		w.postMessage(message, [channel.port2]);
	});
}

/** Push and pull now; the outbox afterwards (null without a device). */
export async function syncNow(): Promise<OutboxSummary | null> {
	return (await ask({ type: 'sync-now' })) as OutboxSummary | null;
}

export async function outboxList(): Promise<OutboxItem[]> {
	return ((await ask({ type: 'outbox-list' })) as OutboxItem[] | null) ?? [];
}

export async function retryEntry(id: string): Promise<number> {
	return ((await ask({ type: 'retry', id })) as number | null) ?? 0;
}

export async function discardEntry(id: string): Promise<number> {
	return ((await ask({ type: 'discard', id })) as number | null) ?? 0;
}

/** Pushes what it can, then how many changes would be lost (waiting + refused + held). */
export async function unsyncedBeforeSignOut(): Promise<number> {
	if (!started) return 0;
	const s = await syncNow();
	return s ? s.waiting + s.refused + s.held : 0;
}

/** Sign out, confirmed: the copy and this person's changes go. */
export async function forgetCopy(): Promise<void> {
	await ask({ type: 'forget' });
}
