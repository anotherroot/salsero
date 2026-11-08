/*
 * The messages between the service worker, the page and the device worker
 * (offline phase 2). PURE types, client-safe: the worker, the service worker
 * and the page all import them.
 */

/** A request as it crosses a `MessagePort`: the service worker's `Request`, taken apart. */
export type WireRequest = {
	url: string;
	method: string;
	headers: [string, string][];
	body: ArrayBuffer | null;
};

/** The device's answer, taken apart the same way. */
export type WireResponse = { status: number; headers: [string, string][]; body: ArrayBuffer };

/** The device cannot answer: the service worker gives its own offline answer. */
export type WireFallback = { fallback: true; reason: string };

/**
 * The device worker's state:
 * - `waiting`: another tab holds the copy; requests go to the network;
 * - `starting`: SQLite, the migrations, and the first pull when there is no copy yet;
 * - `empty`: no copy (never pulled, or signed out) and nothing to pull it from;
 * - `ready`: the copy answers;
 * - `failed`: the worker could not start.
 */
export type DeviceState = 'waiting' | 'starting' | 'empty' | 'ready' | 'failed';

/** To the worker. `device-fetch` carries a reply port: `WireResponse` or `WireFallback` comes back on it. */
export type DeviceIn = { type: 'device-fetch'; request: WireRequest } | { type: 'pull' };

/** From the worker. */
export type DeviceOut = { type: 'state'; state: DeviceState } | { type: 'pulled'; cursor: number };

/**
 * From the service worker to the page. `device-fetch` carries a reply port and
 * is relayed to the worker as is (a `DeviceIn`); `changed`: a write reached the
 * server, pull soon; `needs-connection`: a write could not, say so.
 */
export type SwOut =
	| { type: 'device-fetch'; request: WireRequest }
	| { type: 'changed' }
	| { type: 'needs-connection' };

/**
 * From the page to the service worker: its device's state, on every change
 * (`off`: none started); `device-pulled`: the device has pulled since the page's
 * last write (`changed`), so its reads may be timed out again.
 */
export type SwIn = { type: 'device-state'; state: DeviceState | 'off' } | { type: 'device-pulled' };
