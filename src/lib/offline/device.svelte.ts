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

/** How long a relayed read waits, from the worker's start, for the device to be ready. */
export const DEVICE_START_LIMIT_MS = 10_000;
/** A pull this often while the page is open. */
export const PULL_EVERY_MS = 300_000;
/** A write reached the server: pull this long after the last one. */
const PULL_AFTER_WRITE_MS = 1000;

declare global {
	interface Window {
		/** The device's state, for the browser walk. */
		__device?: { state: DeviceState | 'off' };
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
/** Relayed reads waiting for the device's state to settle. */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- callbacks, never drawn
const waiting = new Set<() => void>();

function setState(state: DeviceState | 'off'): void {
	device.state = state;
	window.__device = { state };
	tellServiceWorker();
	for (const wake of [...waiting]) wake();
}

/** The service worker keeps each page's state: a read waits for the network less when the device is ready. */
function tellServiceWorker(): void {
	const message: SwIn = { type: 'device-state', state: device.state };
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
		pullSoon();
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
	window.__device = { state: device.state };
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
