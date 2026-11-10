import { describe, expect, it } from 'vitest';
import {
	DeviceClients,
	NETWORK_TIMEOUT_MS,
	SHELL,
	cachesToDelete,
	changedTo,
	installOrClean,
	isNetworkFailure,
	navigationTimeout,
	postsChanged,
	pullCovers,
	unpulledAfterPull,
	unpulledAfterSave,
	swRoute,
	QUIET_HEADER,
	tellsNeedsConnection,
	holdsUpdate,
	OUTBOX_STATE_CACHE,
	CACHE_PREFIX,
	deviceFailed,
	navigatePlan,
	readPlan
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
		expect(route('GET', '/lesson-videos/x.mp4')).toBe('pass');
	});

	it('songs and count takes: the phone first (offline phase 4a)', () => {
		const SONG = '/audio/54e60e0a-b733-4b4b-aef7-477f3ae68086.m4a';
		const TAKE = '/count/54e60e0a-b733-4b4b-aef7-477f3ae68086.wav';
		for (const mode of ['cors', 'no-cors', 'same-origin'] as RequestMode[]) {
			expect(route('GET', SONG, mode), mode).toBe('media');
			expect(route('GET', TAKE, mode), mode).toBe('media');
		}
		expect(route('HEAD', SONG)).toBe('pass');
		expect(route('POST', SONG)).toBe('write');
		expect(route('GET', SONG, 'navigate')).toBe('pass');
		// Videos are 4b and 4c: the network, as before.
		expect(route('GET', '/recordings/x.mp4')).toBe('pass');
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
		expect(route('GET', '/salsa/songs/9/grid')).toBe('device-read');
		// A network page's data is the server's alone; offline it gets "needs a
		// connection" (the walk: a failed fetch left the shell with no layout data).
		expect(route('GET', '/admin/__data.json')).toBe('network-read');
		expect(route('GET', '/salsa/groups/3/people/__data.json')).toBe('network-read');
		// The server's alone: no device answer, no offline answer either.
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
		expect(route('GET', '/salsa/songs/9/grid', 'navigate')).toBe('pass');
		// Pages still get the network first, then the shell.
		expect(route('GET', '/salsa/exercises/9', 'navigate')).toBe('navigate');
		expect(route('GET', '/settings', 'navigate')).toBe('navigate');
	});
});

describe('DeviceClients', () => {
	it('times a read out only when its page has a ready device', () => {
		const c = new DeviceClients();
		expect(c.timeoutFor('a')).toBeNull();
		c.setState('a', 'starting', null);
		expect(c.timeoutFor('a')).toBeNull();
		c.setState('a', 'ready', null);
		expect(c.timeoutFor('a')).toBe(NETWORK_TIMEOUT_MS);
		expect(c.timeoutFor('b')).toBeNull();
	});

	it('never times out a page whose write the device has not pulled yet', () => {
		const c = new DeviceClients();
		c.setState('a', 'ready', null);
		c.setState('b', 'ready', null);
		c.changed('a', 1000);
		expect(c.timeoutFor('a')).toBeNull();
		expect(c.timeoutFor('b')).toBe(NETWORK_TIMEOUT_MS);
		// Ready again with nothing unpulled on the page's side does not clear it.
		c.setState('a', 'ready', null);
		expect(c.timeoutFor('a')).toBeNull();
		c.pulled('a', 1000);
		expect(c.timeoutFor('a')).toBe(NETWORK_TIMEOUT_MS);
	});

	it('clears only for a pull that left after the write landed, whatever the message order', () => {
		const c = new DeviceClients();
		c.setState('a', 'ready', null);
		c.changed('a', 1000);
		// Already out when the write landed.
		c.pulled('a', 999);
		expect(c.timeoutFor('a')).toBeNull();
		// A second write before the covering pull: only a pull after both clears.
		c.changed('a', 2000);
		c.pulled('a', 1500);
		expect(c.timeoutFor('a')).toBeNull();
		// An older write noted late never moves the mark back.
		c.changed('a', 1200);
		c.pulled('a', 2000);
		expect(c.timeoutFor('a')).toBe(NETWORK_TIMEOUT_MS);
	});

	it("learns a page's unpulled save from its state, after a restart or a replacement", () => {
		const c = new DeviceClients();
		c.setState('a', 'ready', 1000);
		expect(c.timeoutFor('a')).toBeNull();
		c.pulled('a', 900);
		expect(c.timeoutFor('a')).toBeNull();
		c.pulled('a', 1000);
		expect(c.timeoutFor('a')).toBe(NETWORK_TIMEOUT_MS);
	});

	it('forgets closed pages', () => {
		const c = new DeviceClients();
		c.setState('a', 'ready', null);
		c.changed('b', 1);
		c.sweep(new Set(['c']));
		expect(c.size).toBe(0);
	});
});

describe('a navigation', () => {
	it('is timed out only while an open page has a ready device with nothing unpulled', () => {
		const c = new DeviceClients();
		const open = new Set(['a', 'b']);
		expect(c.anyAnswers(open)).toBe(false);
		c.setState('a', 'waiting', null);
		c.setState('b', 'starting', null);
		expect(c.anyAnswers(open)).toBe(false);
		c.setState('b', 'ready', null);
		expect(c.anyAnswers(open)).toBe(true);
		// A closed page's ready device answers nothing.
		expect(c.anyAnswers(new Set(['a']))).toBe(false);
		// Its save not pulled yet: the copy would draw the page from before it.
		c.changed('b', 1000);
		expect(c.anyAnswers(open)).toBe(false);
		c.pulled('b', 1000);
		expect(c.anyAnswers(open)).toBe(true);
	});

	it('waits as long as it takes with no device to answer, or no shell', () => {
		expect(navigationTimeout('/salsa/figures', { device: true, shell: true })).toBe(
			NETWORK_TIMEOUT_MS
		);
		expect(navigationTimeout('/salsa/figures', { device: false, shell: true })).toBeNull();
		expect(navigationTimeout('/salsa/figures', { device: true, shell: false })).toBeNull();
	});

	it('never times out a network page: the shell cannot draw it', () => {
		for (const path of [
			'/login',
			'/admin',
			'/join',
			'/salsa/groups/4/people',
			'/settings/storage'
		]) {
			expect(navigationTimeout(path, { device: true, shell: true }), path).toBeNull();
		}
	});
});

describe("the page's unpulled save", () => {
	it('keeps the latest save, and clears for a pull that left after it', () => {
		expect(unpulledAfterSave(null, 1000)).toBe(1000);
		expect(unpulledAfterSave(1000, 2000)).toBe(2000);
		expect(unpulledAfterSave(2000, 1500)).toBe(2000);
		expect(unpulledAfterPull(1000, 999)).toBe(1000);
		expect(unpulledAfterPull(1000, 1000)).toBeNull();
		expect(unpulledAfterPull(null, 5)).toBeNull();
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

describe('changedTo', () => {
	it('tells every open page a write landed: the one holding the copy may be another tab', () => {
		expect(changedTo('a', ['b', 'a', 'c']).sort()).toEqual(['a', 'b', 'c']);
		// A page still loading is not listed yet; it is told all the same.
		expect(changedTo('new', ['b']).sort()).toEqual(['b', 'new']);
		expect(changedTo('', ['b'])).toEqual(['b']);
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

describe('pullCovers', () => {
	it('counts a pull whose request left after the page saw its write land', () => {
		expect(pullCovers(1000, 1000)).toBe(true);
		expect(pullCovers(1500, 1000)).toBe(true);
		// Already out when the write landed: it may not hold it.
		expect(pullCovers(999, 1000)).toBe(false);
		// No write yet: any pull will do.
		expect(pullCovers(5, 0)).toBe(true);
	});
});

describe('tellsNeedsConnection', () => {
	it("says so for the person's writes, not for a quiet one", () => {
		expect(tellsNeedsConnection(new Headers({ 'x-sveltekit-action': 'true' }))).toBe(true);
		expect(tellsNeedsConnection(new Headers({ [QUIET_HEADER]: '1' }))).toBe(false);
	});
});

describe('writes and the outbox (offline phase 3)', () => {
	it('reads from the device while its outbox waits, online too', () => {
		const d = new DeviceClients();
		d.setState('a', 'ready', null, 0, 0);
		expect(d.readsFromDevice('a')).toBe(false);
		d.setState('a', 'ready', null, 2, 5);
		expect(d.readsFromDevice('a')).toBe(true);
		d.setState('a', 'ready', null, 0, 5);
		expect(d.readsFromDevice('a')).toBe(false);
	});

	it('keeps reading from the device after a device write until a state carries that entry', () => {
		const d = new DeviceClients();
		d.setState('a', 'ready', null, 0, 4);
		d.wrote('a', 5);
		expect(d.readsFromDevice('a')).toBe(true);
		d.setState('a', 'ready', null, 0, 4);
		expect(d.readsFromDevice('a')).toBe(true);
		d.setState('a', 'ready', null, 0, 5);
		expect(d.readsFromDevice('a')).toBe(false);
	});

	it('tries the device for a write when it knows nothing of the page', () => {
		expect(new DeviceClients().writesToDevice('unknown')).toBe(true);
	});

	it('never sends a write to a device that is waiting or failed', () => {
		const d = new DeviceClients();
		for (const state of ['waiting', 'failed', 'empty', 'starting', 'off'] as const) {
			d.setState('a', state, null);
			expect(d.writesToDevice('a'), state).toBe(false);
		}
		d.setState('a', 'ready', null);
		expect(d.writesToDevice('a')).toBe(true);
	});

	it('holds an update only for older entries, and only online', () => {
		expect(holdsUpdate([11, 12], 12, true)).toBe(true);
		expect(holdsUpdate([12], 12, true)).toBe(false);
		expect(holdsUpdate([11], 12, false)).toBe(false);
		expect(holdsUpdate([], 12, true)).toBe(false);
	});

	it('passes the push', () => {
		expect(
			swRoute(
				'POST',
				new URL('https://salsa.test/api/sync/push'),
				'cors',
				'https://salsa.test',
				new Set()
			)
		).toBe('pass');
	});

	it('never deletes the outbox state cache', () => {
		expect(OUTBOX_STATE_CACHE.startsWith(CACHE_PREFIX)).toBe(false);
		expect(
			cachesToDelete([OUTBOX_STATE_CACHE, 'salsa-1', 'salsa-2', 'salsa-3'], 'salsa-3')
		).not.toContain(OUTBOX_STATE_CACHE);
	});
});

describe('the AI connector', () => {
	it('stays out of the connector and its sign-in entirely', () => {
		expect(route('POST', '/mcp')).toBe('pass');
		expect(route('GET', '/oauth/authorize?client_id=x', 'navigate')).toBe('pass');
		expect(route('POST', '/oauth/authorize?/approve', 'navigate')).toBe('pass');
		expect(route('POST', '/oauth/token')).toBe('pass');
		expect(route('GET', '/.well-known/oauth-authorization-server')).toBe('pass');
	});
});

describe('device first (online reads)', () => {
	it('a ready page with nothing unpulled reads the device first', () =>
		expect(readPlan({ networkFirst: false, fromDevice: false, deviceFirst: true })).toBe(
			'device-then-network'
		));

	it('changes waiting read the device, as before', () =>
		expect(readPlan({ networkFirst: true, fromDevice: true, deviceFirst: false })).toBe('device'));

	it('Settings reads the network first', () =>
		expect(readPlan({ networkFirst: true, fromDevice: false, deviceFirst: true })).toBe(
			'network-then-device'
		));

	it('a page whose device is not ready reads the network first', () =>
		expect(readPlan({ networkFirst: false, fromDevice: false, deviceFirst: false })).toBe(
			'network-then-device'
		));

	it('a page dirty from a server save reads the network until a pull covers it', () => {
		const d = new DeviceClients();
		d.setState('p', 'ready', null);
		expect(d.readsDeviceFirst('p')).toBe(true);
		d.changed('p', 100);
		expect(d.readsDeviceFirst('p')).toBe(false);
		d.pulled('p', 100);
		expect(d.readsDeviceFirst('p')).toBe(true);
	});

	it('a starting, empty or unknown device reads the network', () => {
		const d = new DeviceClients();
		d.setState('s', 'starting', null);
		d.setState('e', 'empty', null);
		expect(d.readsDeviceFirst('s')).toBe(false);
		expect(d.readsDeviceFirst('e')).toBe(false);
		expect(d.readsDeviceFirst('nobody')).toBe(false);
	});

	it("the device's own failure goes to the network, a page's answer does not", () => {
		expect(deviceFailed(null)).toBe(true);
		expect(deviceFailed(new Response('', { status: 500 }))).toBe(true);
		expect(deviceFailed(new Response('', { status: 503 }))).toBe(true);
		expect(deviceFailed(new Response('', { status: 404 }))).toBe(false);
		expect(deviceFailed(new Response('', { status: 200 }))).toBe(false);
	});
});

describe('the first page of an open (device first, step 2)', () => {
	const base = { shell: true, copy: true, networkPage: false, waiting: 0, online: true };
	it('draws from the shell when a copy is on this browser', () =>
		expect(navigatePlan(base)).toBe('shell'));
	it('asks the network without a copy', () =>
		expect(navigatePlan({ ...base, copy: false })).toBe('network'));
	it('asks the network for a network page', () =>
		expect(navigatePlan({ ...base, networkPage: true })).toBe('network'));
	it('draws from the shell while changes wait, copy or not', () =>
		expect(navigatePlan({ ...base, copy: false, waiting: 2 })).toBe('shell'));
	it('asks the network without a cached shell', () =>
		expect(navigatePlan({ ...base, shell: false })).toBe('network'));
	it('draws from the shell offline', () =>
		expect(navigatePlan({ ...base, copy: false, online: false })).toBe('shell'));

	it('a page just opened reads its device first when a copy is there, as it starts', () => {
		const d = new DeviceClients();
		expect(d.readsDeviceFirst('new', true)).toBe(true);
		expect(d.readsDeviceFirst('new', false)).toBe(false);
		d.setState('s', 'starting', null);
		expect(d.readsDeviceFirst('s', true)).toBe(true);
		d.setState('e', 'empty', null);
		expect(d.readsDeviceFirst('e', true)).toBe(false);
		d.setState('f', 'failed', null);
		expect(d.readsDeviceFirst('f', true)).toBe(false);
		d.setState('w', 'ready', null);
		d.changed('w', 5);
		expect(d.readsDeviceFirst('w', true)).toBe(false);
	});
});
