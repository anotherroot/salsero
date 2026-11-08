import { describe, expect, it } from 'vitest';
import {
	DeviceClients,
	NETWORK_TIMEOUT_MS,
	SHELL,
	cachesToDelete,
	installOrClean,
	isNetworkFailure,
	postsChanged,
	swRoute
} from './sw-route';

const ORIGIN = 'https://salsa.test';
const PRECACHED = new Set(['/clips/uno.m4a', '/icon-salsa.svg']);
const at = (path: string, origin = ORIGIN) => new URL(path, origin);
const route = (method: string, path: string, mode: RequestMode = 'cors', origin = ORIGIN) =>
	swRoute(method, at(path, origin), mode, ORIGIN, PRECACHED);

describe('swRoute', () => {
	it('passes other origins and media', () => {
		expect(route('GET', 'https://other.test/x.js', 'cors', 'https://other.test')).toBe('pass');
		expect(route('GET', 'https://www.youtube.com/', 'navigate', 'https://www.youtube.com')).toBe(
			'pass'
		);
		expect(route('GET', '/recordings/x.mp4')).toBe('pass');
		expect(route('GET', '/audio/x.m4a')).toBe('pass');
		expect(route('GET', '/lesson-videos/x.mp4')).toBe('pass');
	});

	it('serves the build from the cache', () => {
		expect(route('GET', '/_app/immutable/entry/start.abc.js')).toBe('precached');
		expect(route('GET', '/_device/1762600000000/worker.js')).toBe('precached');
		expect(route('GET', '/_device/1762600000000/sqlite3.wasm')).toBe('precached');
		expect(route('GET', '/clips/uno.m4a')).toBe('precached');
		expect(route('GET', '/icon-salsa.svg')).toBe('precached');
		// A static file not in this build's list is the network's.
		expect(route('GET', '/clips/new.m4a')).toBe('pass');
	});

	it('asks the network for version.json, so a deploy is still seen', () => {
		expect(route('GET', '/_app/version.json')).toBe('pass');
		expect(route('GET', '/_app/version.json?x=1')).toBe('pass');
	});

	it('sends navigations to the network first', () => {
		expect(route('GET', '/salsa', 'navigate')).toBe('navigate');
		expect(route('GET', '/salsa/figures/12', 'navigate')).toBe('navigate');
		expect(route('GET', '/login', 'navigate')).toBe('navigate');
		// A form posted without JavaScript (sign in, /logout): the browser's own, as
		// today. The service worker has no page to answer a write with.
		expect(route('POST', '/login', 'navigate')).toBe('pass');
		expect(route('POST', '/logout', 'navigate')).toBe('pass');
	});

	it('reads page data and device endpoints from the device', () => {
		expect(route('GET', '/salsa/__data.json')).toBe('device-read');
		expect(route('GET', '/salsa/figures/12/__data.json?x-sveltekit-invalidated=01')).toBe(
			'device-read'
		);
		expect(route('GET', '/api/lessons/4/comments')).toBe('device-read');
		expect(route('GET', '/salsa/exercises/9/practice')).toBe('device-read');
		// The server's alone: no device answer, no offline answer either.
		expect(route('GET', '/admin/__data.json')).toBe('pass');
		expect(route('GET', '/api/device/config')).toBe('pass');
		expect(route('GET', '/salsa/figures')).toBe('pass');
		expect(route('HEAD', '/salsa/__data.json')).toBe('pass');
	});

	it('sends every write to the network', () => {
		expect(route('POST', '/salsa/exercises/9?/log')).toBe('write');
		expect(route('POST', '/api/opens')).toBe('write');
		expect(route('DELETE', '/api/comments/3')).toBe('write');
		expect(route('POST', '/api/count-takes')).toBe('write');
		// A form posted to a precached path is still a write.
		expect(route('POST', '/icon-salsa.svg')).toBe('write');
	});

	it('leaves raw-body uploads to the browser, so their progress keeps counting', () => {
		expect(route('PUT', '/api/lessons/4/videos/0b6a-uuid')).toBe('pass');
		expect(route('POST', '/api/figures/12/recordings')).toBe('pass');
		expect(route('POST', '/api/songs?dance=salsa&team=3')).toBe('pass');
	});

	it("never routes the device worker's own requests back to the device", () => {
		// Its pull: no `changed` (a pull→changed→pull loop), no `needs-connection` toast.
		expect(route('POST', '/api/sync/pull')).toBe('pass');
		// Its bundle and its WASM come from the cache, never from a device-read.
		expect(route('GET', '/_device/1762600000000/files.json')).toBe('precached');
		expect(route('GET', '/_device/1762600000000/chunks/server.js')).toBe('precached');
	});
});

describe('isNetworkFailure', () => {
	it('reads a 502 and a Cloudflare 522 as the network failing, a 404 as an answer', () => {
		for (const s of [502, 503, 504, 520, 522, 530]) {
			expect(isNetworkFailure(new Response(null, { status: s })), String(s)).toBe(true);
		}
		for (const s of [200, 201, 303, 400, 404, 409, 413, 426, 500, 501, 519, 531]) {
			expect(isNetworkFailure(new Response(null, { status: s })), String(s)).toBe(false);
		}
	});
});

describe('constants', () => {
	it('waits 4 s for the network and keeps the shell at /shell', () => {
		expect(NETWORK_TIMEOUT_MS).toBe(4000);
		expect(SHELL).toBe('/shell');
	});
});

describe('cachesToDelete', () => {
	it('keeps this build and the newest one before it, and nothing that is not ours', () => {
		const keys = ['salsa-100', 'salsa-300', 'other-1', 'salsa-200', 'salsa-90'];
		expect(cachesToDelete(keys, 'salsa-300').sort()).toEqual(['salsa-100', 'salsa-90']);
	});

	it('never deletes this build, even when a newer one is cached (a rollback)', () => {
		const keys = ['salsa-100', 'salsa-300', 'salsa-200'];
		expect(cachesToDelete(keys, 'salsa-100')).toEqual(['salsa-200']);
	});

	it('compares versions as numbers, not as text', () => {
		const keys = ['salsa-99', 'salsa-1000', 'salsa-100'];
		expect(cachesToDelete(keys, 'salsa-1000')).toEqual(['salsa-99']);
	});
});

describe('navigations to what is not a page', () => {
	it('leaves an endpoint opened in a tab to the browser, never the shell', () => {
		expect(route('GET', '/releases/salsa/salsa-1.7.apk', 'navigate')).toBe('pass');
		expect(route('GET', '/recordings/x.mp4', 'navigate')).toBe('pass');
		expect(route('GET', '/lesson-videos/x.mp4', 'navigate')).toBe('pass');
		expect(route('GET', '/health', 'navigate')).toBe('pass');
		expect(route('GET', '/manifest-salsa.webmanifest', 'navigate')).toBe('pass');
		expect(route('GET', '/api/lessons/4/comments', 'navigate')).toBe('pass');
		expect(route('GET', '/salsa/exercises/9/practice', 'navigate')).toBe('pass');
		// Pages still get the network first, then the shell.
		expect(route('GET', '/salsa/exercises/9', 'navigate')).toBe('navigate');
		expect(route('GET', '/settings', 'navigate')).toBe('navigate');
	});
});

describe('DeviceClients', () => {
	it('times a read out only when its page has a ready device', () => {
		const c = new DeviceClients();
		expect(c.timeoutFor('a')).toBeNull();
		c.setState('a', 'starting');
		expect(c.timeoutFor('a')).toBeNull();
		c.setState('a', 'ready');
		expect(c.timeoutFor('a')).toBe(NETWORK_TIMEOUT_MS);
		expect(c.timeoutFor('b')).toBeNull();
	});

	it('never times out a page whose write the device has not pulled yet', () => {
		const c = new DeviceClients();
		c.setState('a', 'ready');
		c.setState('b', 'ready');
		c.changed('a');
		expect(c.timeoutFor('a')).toBeNull();
		expect(c.timeoutFor('b')).toBe(NETWORK_TIMEOUT_MS);
		// Ready again (a state message) does not clear it; only a pull does.
		c.setState('a', 'ready');
		expect(c.timeoutFor('a')).toBeNull();
		c.pulled('a');
		expect(c.timeoutFor('a')).toBe(NETWORK_TIMEOUT_MS);
	});

	it('forgets closed pages', () => {
		const c = new DeviceClients();
		c.setState('a', 'ready');
		c.changed('b');
		c.sweep(new Set(['c']));
		expect(c.size).toBe(0);
	});
});

describe('postsChanged', () => {
	it('asks for a pull after a write the server took, not after a refusal', () => {
		expect(postsChanged({ status: 200, type: 'basic' })).toBe(true);
		expect(postsChanged({ status: 204, type: 'basic' })).toBe(true);
		expect(postsChanged({ status: 0, type: 'opaqueredirect' })).toBe(true);
		expect(postsChanged({ status: 400, type: 'basic' })).toBe(false);
		expect(postsChanged({ status: 502, type: 'basic' })).toBe(false);
	});
});

describe('installOrClean', () => {
	it('deletes this build’s cache when the install fails, and still fails', async () => {
		const removed: string[] = [];
		const remove = async (name: string) => (removed.push(name), true);
		await expect(
			installOrClean('salsa-2', remove, async () => {
				throw new Error('shell: 500');
			})
		).rejects.toThrow('shell: 500');
		expect(removed).toEqual(['salsa-2']);
	});

	it('keeps it when the install succeeds', async () => {
		const removed: string[] = [];
		await installOrClean(
			'salsa-2',
			async (n) => (removed.push(n), true),
			async () => {}
		);
		expect(removed).toEqual([]);
	});
});
