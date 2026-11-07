import { describe, expect, it } from 'vitest';
import {
	hostDance,
	hostOf,
	hostRedirect,
	inviteLink,
	parseDanceHosts,
	requestDance
} from './hosts';

const MAP = 'salsa.anotherroot.eu=salsa, bachata.anotherroot.eu=bachata';

describe('parseDanceHosts', () => {
	it('reads host=dance pairs and finds a host case-blind, without its port', () => {
		const m = parseDanceHosts(MAP);
		expect(m.size).toBe(2);
		expect(hostDance(m, 'Bachata.AnotherRoot.eu:443')).toBe('bachata');
		expect(hostDance(m, 'salsa.anotherroot.eu')).toBe('salsa');
		expect(hostDance(m, 'wt-1-x.salsa.localhost')).toBeNull();
	});

	it('drops an unknown dance and an empty host', () => {
		expect(parseDanceHosts('x=tango,=salsa,').size).toBe(0);
		expect(parseDanceHosts(undefined).size).toBe(0);
		expect(parseDanceHosts('').size).toBe(0);
	});
});

describe('hostOf', () => {
	it('is the host a dance is served on, or null', () => {
		expect(hostOf(parseDanceHosts(MAP), 'bachata')).toBe('bachata.anotherroot.eu');
		expect(hostOf(new Map(), 'salsa')).toBeNull();
	});
});

describe('requestDance', () => {
	const none = { userDance: null, hostDance: null, path: '/', next: null, query: null };

	it('is the account’s dance first, whatever the host', () => {
		expect(requestDance({ ...none, userDance: 'bachata', hostDance: 'salsa' })).toBe('bachata');
	});

	it('is the host’s dance with nobody signed in, over the path', () => {
		expect(requestDance({ ...none, hostDance: 'salsa', path: '/bachata/moves' })).toBe('salsa');
	});

	it('falls back to the path, then next, then the query, then salsa', () => {
		expect(requestDance({ ...none, path: '/bachata/moves' })).toBe('bachata');
		expect(requestDance({ ...none, path: '/login', next: '/bachata' })).toBe('bachata');
		expect(requestDance({ ...none, path: '/login', query: 'bachata' })).toBe('bachata');
		expect(requestDance({ ...none, path: '/login', query: 'tango' })).toBe('salsa');
	});
});

describe('hostRedirect', () => {
	const hosts = parseDanceHosts(MAP);
	const at = (
		host: string,
		path: string,
		over: Partial<{
			method: string;
			search: string;
			userDance: 'salsa' | 'bachata' | null;
			protocol: string;
		}> = {}
	) =>
		hostRedirect({
			hosts,
			host,
			path,
			protocol: over.protocol ?? 'https:',
			search: over.search ?? '',
			method: over.method ?? 'GET',
			userDance: over.userDance ?? null
		});

	// Catches: the other dance's pages served on a dance's own host.
	it("sends the other dance's page to its own host, keeping the query", () => {
		expect(at('bachata.anotherroot.eu', '/salsa/moves', { search: '?x=1' })).toEqual({
			kind: 'redirect',
			to: 'https://salsa.anotherroot.eu/salsa/moves?x=1'
		});
	});

	// Catches: a form POST bounced across hosts, where it would arrive as a GET.
	it("is missing for a POST to the other dance's path", () => {
		expect(at('bachata.anotherroot.eu', '/salsa/moves', { method: 'POST' })).toEqual({
			kind: 'missing'
		});
	});

	// Catches: an old session of the other dance's account stuck on the wrong host,
	// and a redirect loop (its own host would send a /bachata path straight back).
	it('sends a signed-in account of the other dance to its own host', () => {
		expect(at('bachata.anotherroot.eu', '/bachata/moves', { userDance: 'salsa' })).toEqual({
			kind: 'redirect',
			to: 'https://salsa.anotherroot.eu/'
		});
		expect(at('salsa.anotherroot.eu', '/settings', { userDance: 'bachata' })).toEqual({
			kind: 'redirect',
			to: 'https://bachata.anotherroot.eu/settings'
		});
	});

	// Catches: the worker, the update check, the APKs or health bounced or refused.
	it('passes what both hosts serve', () => {
		for (const path of [
			'/api/worker/songs',
			'/api/app-update/bachata',
			'/releases/bachata/7.apk',
			'/health',
			'/_app/immutable/x.js'
		]) {
			expect(at('salsa.anotherroot.eu', path, { userDance: 'bachata' })).toEqual({ kind: 'pass' });
		}
	});

	// Catches: an API call from the other dance's account answered with a redirect.
	it("is missing for the other dance's account on the API", () => {
		expect(at('salsa.anotherroot.eu', '/api/opens', { userDance: 'bachata' })).toEqual({
			kind: 'missing'
		});
	});

	it("passes its own dance's pages and every request on an unmapped host", () => {
		expect(at('salsa.anotherroot.eu', '/salsa/moves', { userDance: 'salsa' })).toEqual({
			kind: 'pass'
		});
		expect(at('salsa.anotherroot.eu', '/login')).toEqual({ kind: 'pass' });
		expect(at('wt-1-x.salsa.localhost:5173', '/bachata', { userDance: 'salsa' })).toEqual({
			kind: 'pass'
		});
	});
});

describe('hostRedirect, signing out and local hosts', () => {
	// Catches: a stale session of the other dance's account that cannot sign out
	// on this host (its POST /logout was a 404).
	it("lets the other dance's account sign out here", () => {
		const hosts = parseDanceHosts(MAP);
		for (const method of ['POST', 'GET']) {
			expect(
				hostRedirect({
					hosts,
					host: 'bachata.anotherroot.eu',
					protocol: 'https:',
					path: '/logout',
					search: '',
					method,
					userDance: 'salsa'
				})
			).toEqual({ kind: 'pass' });
		}
	});

	// Catches: a mapped local host (http, a port) redirected to https without its port.
	it('keeps the protocol and the port', () => {
		expect(
			hostRedirect({
				hosts: parseDanceHosts('salsa.localhost=salsa,bachata.localhost=bachata'),
				host: 'bachata.localhost:5173',
				protocol: 'http:',
				path: '/salsa/moves',
				search: '',
				method: 'GET',
				userDance: null
			})
		).toEqual({ kind: 'redirect', to: 'http://salsa.localhost:5173/salsa/moves' });
	});
});

describe('inviteLink', () => {
	// Catches: an invite opened on the wrong host, or (dev) a bachata invite read as salsa's.
	it("points at the dance's own host, else names the dance", () => {
		expect(
			inviteLink({
				hosts: parseDanceHosts(MAP),
				dance: 'bachata',
				protocol: 'https:',
				host: 'bachata.anotherroot.eu',
				code: 'abc'
			})
		).toBe('https://bachata.anotherroot.eu/join?code=abc');
		expect(
			inviteLink({
				hosts: parseDanceHosts(undefined),
				dance: 'bachata',
				protocol: 'http:',
				host: 'wt-1-x.salsa.localhost:5173',
				code: 'abc'
			})
		).toBe('http://wt-1-x.salsa.localhost:5173/join?code=abc&dance=bachata');
	});
});
