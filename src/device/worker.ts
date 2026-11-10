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
import { PAGE_EPOCH } from '$lib/epoch';
import type { Server as KitServer, SSRManifest } from '@sveltejs/kit';
import type {
	DeviceIn,
	DeviceOut,
	KeepStatus,
	WireFallback,
	WireRequest,
	OriginalPut
} from '$lib/offline/protocol';
import { SCHEMA_TAG } from '$lib/sync/schema-tag';
import { createDevice, type Device, type DeviceRuntime, type Responder } from './core';
import { mediaKeeper, sweepOriginals, type PassOut } from './media';
import { withStored } from '$lib/offline/kept-status';
import {
	opfsMediaStore,
	ORIGINALS,
	SONG_KINDS,
	VIDEO_KINDS,
	type MediaStore
} from '$lib/offline/media-store';
import {
	canTellWifi,
	freeOf,
	isLow,
	linkOf,
	onLinkChange,
	videosMayCome
} from '$lib/offline/network';
import { migrateDevice } from './migrate';
import { deviceMigrations } from './migrations';
import { openCopy } from './pool';
import { installCapture } from './capture';
import { ensureDeviceKey } from './apply';
import { PUSH_RETRY_MS } from '$lib/sync/outbox';
import Database, { initDeviceSqlite, openPool, pausePool } from './sqlite-shim';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const LOCK = 'salsa-device';
const DB_PATH = '/salsa.db';
/** The server code's `DATA_DIR`: media paths resolve under it and find nothing (the media store is the service worker's to serve). */
const DATA_DIR = '/device';

const post = (message: DeviceOut) => scope.postMessage(message);

let device: Device | null = null;

/** The media store (offline phase 4a), opened once; null where this browser has none. */
let mediaStore: Promise<MediaStore | null> | undefined;
const store = () => (mediaStore ??= opfsMediaStore());

/** What the worker's navigator says about the connection (not in TypeScript's lib). */
const nav = navigator as unknown as {
	connection?: { type?: string; addEventListener?(type: 'change', f: () => void): void };
};

async function free(): Promise<number | null> {
	try {
		return freeOf(await navigator.storage.estimate());
	} catch {
		return null;
	}
}

/** The last pass's result, the file in flight, and the status last posted (offline phase 4b). */
let lastPass: PassOut | null = null;
let inFlight: KeepStatus['inFlight'] = null;
let lastStatus: KeepStatus | null = null;
let progressPostedAt = 0;

/**
 * The songs (4a) and kept videos (4b) on the phone: one pass at a time;
 * `restart` after a settings or connection change; `clear` stops a pass in
 * flight before it empties the store.
 */
const media = mediaKeeper({
	store,
	wanted: () => (device && device.state() === 'ready' ? device.wantedMedia() : null),
	fetchMedia: (path, signal, range) =>
		fetch(path, {
			credentials: 'same-origin',
			signal,
			headers: range ? { Range: `bytes=${range}-` } : undefined
		}),
	online: () => navigator.onLine,
	videosMayCome: () => videosMayCome(linkOf(nav), device?.keepSettings().wifiOnly ?? true),
	free,
	onProgress: (key, received, total) => {
		inFlight = received < total ? { key, received, total } : null;
		// The whole status is costly (every file's meta): only the progress changes here.
		const now = Date.now();
		if (lastStatus && (inFlight === null || now - progressPostedAt >= 1000)) {
			progressPostedAt = now;
			// Something is coming, so nothing waits for Wi-Fi or a connection now.
			post({ type: 'keep', status: { ...lastStatus, inFlight, waiting: null } });
		}
	},
	onStored: (f) => {
		// A video landed: counted at once, so a space goes up file by file (a full scan waits for the pass's end).
		if (!lastStatus || !device || !VIDEO_KINDS.includes(f.kind)) return;
		const next = withStored(lastStatus, `${f.kind}/${f.file}`, f.size ?? 0);
		inFlight = null;
		lastStatus = { ...next, ...device.keepRows(new Set(next.held)) };
		post({ type: 'keep', status: { ...lastStatus, waiting: null } });
	},
	onPass: (out) => {
		lastPass = out;
		inFlight = null;
		void postKeep();
	},
	log: console
});
const syncSongs = () => media.sync();
nav.connection?.addEventListener?.(
	'change',
	onLinkChange(nav, () => void media.restart())
);

/** What the On this phone page shows; null without a ready copy or a store. */
async function keepStatus(): Promise<KeepStatus | null> {
	if (!device || device.state() !== 'ready') return null;
	const s = await store();
	if (!s) return null;
	const held = (await s.list())
		.filter((f) => VIDEO_KINDS.includes(f.kind))
		.map((f) => `${f.kind}/${f.file}`);
	const partial: Record<string, number> = {};
	for (const p of await s.parts()) {
		if (VIDEO_KINDS.includes(p.kind))
			partial[`${p.kind}/${p.file}`] = await s.partSize(p.kind, p.file);
	}
	const room = await free();
	const scope = device.originalsScope();
	const originals = (await s.list(ORIGINALS)).filter((f) => f.owner === scope.person);
	let originalBytes = 0;
	for (const f of originals) originalBytes += (await s.read('originals', f.file))?.body.size ?? 0;
	return {
		settings: device.keepSettings(),
		...device.keepRows(new Set(held)),
		held,
		partial,
		inFlight,
		waiting: lastPass?.waiting ?? null,
		canTellWifi: canTellWifi(nav),
		bytes: {
			songs: await s.usage(SONG_KINDS),
			videos: await s.usage(VIDEO_KINDS),
			originals: originalBytes
		},
		slot: scope.slot,
		originals: originals.map((f) => f.file),
		devices: scope.devices,
		free: room,
		low: isLow(room)
	};
}

async function postKeep(): Promise<KeepStatus | null> {
	const status = await keepStatus().catch((e) => {
		console.warn('[device] media status', String(e));
		return null;
	});
	lastStatus = status;
	if (status) post({ type: 'keep', status });
	return status;
}

/** The page's person, kept for a device that opens later (`Device.person`). */
let person: string | null | undefined = undefined;

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
		migrate: (d) => {
			migrateDevice(d, deviceMigrations());
			installCapture(d);
			ensureDeviceKey(d, () => crypto.randomUUID());
		},
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
		fetchPush: (body) =>
			fetch('/api/sync/push', {
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
		epoch: PAGE_EPOCH,
		newId: () => crypto.randomUUID(),
		clearMedia: () => media.clear(),
		onRecorded: () => {
			if (device) post({ type: 'outbox', summary: device.summary() });
			syncSoon();
		},
		log: console
	});
}

let soon: ReturnType<typeof setTimeout> | undefined;
let retry: ReturnType<typeof setTimeout> | undefined;

/** A sync shortly after a write, debounced: a run of saves goes up together. */
function syncSoon(): void {
	clearTimeout(soon);
	soon = setTimeout(() => void syncNow(), 300);
}

/** A sync now; one that could not reach the server while the browser says online tries again later. */
async function syncNow(): Promise<void> {
	if (!device) return;
	clearTimeout(retry);
	const out = await device.sync();
	if (out !== 'offline') {
		void syncSongs();
		void sweepMine();
	}
	if (out === 'offline' && navigator.onLine)
		retry = setTimeout(() => void syncNow(), PUSH_RETRY_MS);
}

scope.addEventListener('online', () => void syncNow());

/** After a sync that reached the server: the person's originals whose row was deleted go (offline phase 4c). */
async function sweepMine(): Promise<void> {
	const s = await store();
	if (!s || !device || device.state() !== 'ready') return;
	const { person, files } = device.originalsScope();
	if (!person) return;
	try {
		const gone = await sweepOriginals({ store: s, person, pulledOnline: true, rowFiles: files });
		if (gone.length > 0) void postKeep();
	} catch (e) {
		console.warn('[device] originals sweep', String(e));
	}
}

/** A person's own video kept only here (offline phase 4c): stored whole under the row's file name. */
async function putOriginal(file: string, mime: string, blob: Blob): Promise<OriginalPut> {
	const s = await store();
	const person = device?.originalsScope().person ?? null;
	if (!s || !person) return { ok: false, reason: 'store' };
	const room = await free();
	if (room !== null && blob.size > room) return { ok: false, reason: 'space' };
	try {
		await s.write(
			{ kind: 'originals', file, mime, size: blob.size, owner: person },
			new Response(blob)
		);
	} catch (e) {
		console.warn('[device] original not stored', String(e));
		return {
			ok: false,
			reason: (e as DOMException)?.name === 'QuotaExceededError' ? 'space' : 'store'
		};
	}
	void postKeep();
	return { ok: true };
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
		if (person !== undefined) await device.person(person);
		await device.start();
		void syncSongs();
		// Held for the worker's life: closing the tab ends the worker and frees it.
		await new Promise<never>(() => {});
	});
}

async function reply(
	port: MessagePort,
	request: WireRequest,
	asker: string | null | undefined
): Promise<void> {
	let out;
	try {
		out = device
			? await device.answer(request, asker)
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
		if (port) void reply(port, message.request, message.person);
	} else if (message?.type === 'person') {
		person = message.userId;
		void device?.person(message.userId).then(() => syncSongs());
	} else if (message?.type === 'pull') {
		// Before the lock is ours there is nothing to pull into; start pulls anyway.
		void syncNow();
	} else if (message && e.ports[0]) {
		void answerPort(e.ports[0], message);
	}
});

/** The Sync page's questions, each answered on its port; null when no device is open. */
async function answerPort(port: MessagePort, message: DeviceIn): Promise<void> {
	let out: unknown = null;
	try {
		if (device) {
			if (message.type === 'outbox-list') out = await device.outboxList();
			else if (message.type === 'retry') out = await device.retry(message.id);
			else if (message.type === 'discard') out = await device.discard(message.id);
			else if (message.type === 'resolve') out = await device.resolve(message.id);
			else if (message.type === 'sync-now') {
				await syncNow();
				out = device.summary();
			} else if (message.type === 'forget') {
				await device.forget();
				out = true;
			} else if (message.type === 'original-put') {
				out = await putOriginal(message.file, message.mime, message.blob);
			} else if (message.type === 'original-get') {
				const held = await (await store())?.read('originals', message.file);
				out = { blob: held ? held.body : null };
			} else if (message.type === 'original-drop') {
				await (await store())?.remove('originals', message.file);
				void postKeep();
				out = { ok: true };
			} else if (message.type === 'keep-get') {
				out = lastStatus ?? (await postKeep());
			} else if (message.type === 'keep-set') {
				device.keepSet(message.change);
				if ('clear' in message.change) await media.clear(VIDEO_KINDS);
				out = await postKeep();
				void media.restart();
			}
		}
	} catch (e) {
		console.error('[device] answering the page failed', message.type, e);
		out = null;
	}
	port.postMessage(out);
}

scope.addEventListener('error', (e) => console.error('[device] uncaught', e.message, e.error));
scope.addEventListener('unhandledrejection', (e) =>
	console.error('[device] unhandled rejection', e.reason)
);

run().catch((e) => {
	console.error('[device] start failed', e);
	post({ type: 'state', state: 'failed' });
});
