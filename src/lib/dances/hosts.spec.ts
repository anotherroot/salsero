import { describe, expect, it } from 'vitest';
import { hostDance, hostOf, parseDanceHosts, requestDance } from './hosts';

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
