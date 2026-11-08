/// <reference lib="webworker" />
/*
 * The device worker (offline phase 2): a dedicated worker that holds the
 * person's copy in SQLite WASM on OPFS and answers the page's reads with the
 * app's own server code when the network fails. Built by
 * vite.device.config.ts into /_device/<version>/worker.js; the page starts it
 * and relays the service worker's requests to it (`$lib/offline/protocol`).
 *
 * One tab owns the copy: the worker waits for the `salsa-device` lock and
 * holds it for its life. A second tab's worker says `waiting` and takes over
 * when the first closes; its requests go to the network meanwhile.
 */
import type { Server as KitServer, SSRManifest } from '@sveltejs/kit';
import type { DeviceIn, DeviceOut, WireFallback, WireRequest } from '$lib/offline/protocol';
import { SCHEMA_TAG } from '$lib/sync/schema-tag';
import { createDevice, type Device, type DeviceRuntime, type Responder } from './core';
import { migrateDevice } from './migrate';
import { deviceMigrations } from './migrations';
import { openCopy } from './pool';
import Database, { initDeviceSqlite, openPool, pausePool } from './sqlite-shim';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const LOCK = 'salsa-device';
const DB_PATH = '/salsa.db';
/** The server code's `DATA_DIR`: media paths resolve under it and find nothing (phase 4). */
const DATA_DIR = '/device';

const post = (message: DeviceOut) => scope.postMessage(message);

let device: Device | null = null;

async function startServer(): Promise<Responder> {
	// The app's own server, as `vite build` left it. Loaded here, not at the top,
	// so a failure to load it says `failed` instead of killing the worker.
	const [{ Server }, { manifest }] = await Promise.all([
		import('../../.svelte-kit/output/server/index.js' as string) as Promise<{
			Server: typeof KitServer;
		}>,
		import('../../.svelte-kit/output/server/manifest.js' as string) as Promise<{
			manifest: SSRManifest;
		}>
	]);
	const server = new Server(manifest);
	await server.init({ env: { DATABASE_PATH: DB_PATH, DATA_DIR } });
	return (request) => server.respond(request, { getClientAddress: () => '127.0.0.1' });
}

async function open(): Promise<Device> {
	// sqlite3.wasm sits beside this file, in its own version's directory.
	await initDeviceSqlite({ locateFile: (file) => new URL(file, scope.location.href).href });
	// Retried while the last tab's worker lets go; given back if a later step fails.
	const db = await openCopy({
		pool: () => openPool('salsa'),
		db: () => new Database(DB_PATH),
		migrate: (d) => migrateDevice(d, deviceMigrations()),
		release: pausePool
	});
	return createDevice({
		db,
		schema: SCHEMA_TAG,
		fetchPull: (body) =>
			fetch('/api/sync/pull', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'content-type': 'application/json' },
				body
			}),
		startServer,
		setRuntime: (runtime: DeviceRuntime) => {
			(globalThis as { __salsaDevice?: DeviceRuntime }).__salsaDevice = runtime;
		},
		post,
		online: () => navigator.onLine,
		userAgent: navigator.userAgent,
		now: () => Date.now(),
		log: console
	});
}

async function run(): Promise<void> {
	post({ type: 'state', state: 'waiting' });
	if (!navigator.locks) throw new Error('no Web Locks in this browser');
	await navigator.locks.request(LOCK, async () => {
		try {
			device = await open();
		} catch (e) {
			// The lock goes back: another tab may yet open the copy.
			console.error('[device] could not open the copy', e);
			post({ type: 'state', state: 'failed' });
			return;
		}
		await device.start();
		// Held for the worker's life: closing the tab ends the worker and frees it.
		await new Promise<never>(() => {});
	});
}

async function reply(port: MessagePort, request: WireRequest): Promise<void> {
	let out;
	try {
		out = device
			? await device.answer(request)
			: ({ fallback: true, reason: 'device waiting' } satisfies WireFallback);
	} catch (e) {
		out = { fallback: true, reason: String(e) } satisfies WireFallback;
	}
	if ('fallback' in out) port.postMessage(out);
	else port.postMessage(out, [out.body]);
}

scope.addEventListener('message', (e: MessageEvent<DeviceIn>) => {
	const message = e.data;
	if (message?.type === 'device-fetch') {
		const port = e.ports[0];
		if (port) void reply(port, message.request);
	} else if (message?.type === 'pull') {
		// Before the lock is ours there is nothing to pull into; start pulls anyway.
		void device?.pull();
	}
});

scope.addEventListener('error', (e) => console.error('[device] uncaught', e.message, e.error));
scope.addEventListener('unhandledrejection', (e) =>
	console.error('[device] unhandled rejection', e.reason)
);

run().catch((e) => {
	console.error('[device] start failed', e);
	post({ type: 'state', state: 'failed' });
});
