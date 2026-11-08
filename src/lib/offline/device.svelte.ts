/*
 * The page side of the device (offline phase 2): registers the service
 * worker, starts the device worker (`/_device/<version>/worker.js`), relays the
 * service worker's `device-fetch` to it, and asks it to pull. A build only:
 * in dev there is no service worker and no device.
 *
 * The service worker cannot reach a dedicated worker, so every request the
 * device answers comes through the page that owns it, with a reply port the
 * worker answers on.
 */
import { dev, version } from '$app/environment';
import type { DeviceIn, DeviceOut, DeviceState, SwIn, SwOut, WireFallback } from './protocol';
import { unpulledAfterPull, unpulledAfterSave } from './sw-route';

/** How long a relayed read waits, from the worker's start, for the device to be ready. */
export const DEVICE_START_LIMIT_MS = 10_000;
/** A pull this often while the page is open. */
export const PULL_EVERY_MS = 300_000;
/** A write reached the server: pull this long after the last one. */
const PULL_AFTER_WRITE_MS = 1000;

declare global {
	interface Window {
		/** The device's state and how many pulls have landed, for the browser walk (scripts/offline). */
		__device?: { state: DeviceState | 'off'; pulls: number };
	}
}

/** The device's state on this page; `off` until its worker starts (and for good in dev). */
export const device = $state<{ state: DeviceState | 'off' }>({ state: 'off' });

/** Whether the device answers reads on this page now. */
export function deviceReady(): boolean {
	return device.state === 'ready';
}

let started = false;
let worker: Worker | null = null;
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
	device.state = state;
	window.__device = { state, pulls };
	tellServiceWorker();
	for (const wake of [...waiting]) wake();
}

/** The service worker keeps each page's state: a read waits for the network less when the device is ready. */
function tellServiceWorker(): void {
	const message: SwIn = { type: 'device-state', state: device.state, unpulledSince };
	navigator.serviceWorker.controller?.postMessage(message);
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
		else if (e.data?.type === 'pulled') pulled(e.data.startedAt);
	});
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
		if (!(await whenReady())) return fallback(`device ${device.state}`);
		w.postMessage(message satisfies DeviceIn, [port]);
	} catch (e) {
		fallback(String(e));
	}
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
function pulled(startedAt: number): void {
	pulls += 1;
	if (window.__device) window.__device.pulls = pulls;
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
	window.__device = { state: device.state, pulls };
	try {
		const sw = navigator.serviceWorker;
		sw.addEventListener('message', onServiceWorkerMessage);
		sw.startMessages();
		// A new build's service worker took over: tell it where this page's device is.
		sw.addEventListener('controllerchange', tellServiceWorker);
		sw.register('/service-worker.js').catch((e) =>
			console.error('[device] the service worker would not register', e)
		);

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
